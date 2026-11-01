import { Timestamp } from 'firebase-admin/firestore';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getAdminDb } from '@/lib/firebase-admin';
import { migrateLearningTimes } from '@/lib/learning-time-migration';
import { readHistoryItem } from '@/lib/history-schema';
vi.mock('server-only', () => ({}));
afterEach(() => vi.restoreAllMocks());
beforeEach(async () => {
  await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-shark-empti/databases/(default)/documents`, { method: 'DELETE' });
});

it('converts legacy timestamps with missing parents, preserves instants/content and is dry-run safe and repeatable', async () => {
  const db = getAdminDb();
  const iso = '2026-09-03T12:00:00.000Z';
  for (const [group, field] of [['history', 'date'], ['flashcards', 'createdAt'], ['practice', 'createdAt']]) {
    await db.doc(`users/missing/${group}/legacy`).set({ [field]: iso, content: 'Preserved' });
    await db.doc(`users/missing/${group}/current`).set({ [field]: Timestamp.fromDate(new Date(iso)) });
  }
  await db.doc('users/missing/history/invalid').set({ date: 'not-a-date' });
  await db.doc('users/other/private/root/history/shadow').set({ date: iso });
  expect(await migrateLearningTimes(db)).toEqual({ scanned: 7, canonical: 3, convertible: 3, invalid: 1, converted: 0 });
  expect((await db.doc('users/missing/history/legacy').get()).get('date')).toBe(iso);
  expect((await migrateLearningTimes(db, true)).converted).toBe(3);
  const migrated = (await db.doc('users/missing/history/legacy').get()).data()!;
  expect(migrated.date.toMillis()).toBe(Date.parse(iso)); expect(migrated.content).toBe('Preserved');
  expect((await db.doc('users/other/private/root/history/shadow').get()).get('date')).toBe(iso);
  expect((await migrateLearningTimes(db, true)).converted).toBe(0);
});

it('type-specific queries include only their format and merge by normalized chronology', async () => {
  const db = getAdminDb(), source = db.collection('users/learner/history');
  const data = { config: { topic: 'Time' }, quizResults: [] };
  await source.doc('old').set({ ...data, date: '2026-09-01T00:00:00.000Z' });
  await source.doc('new').set({ ...data, date: Timestamp.fromDate(new Date('2026-09-03T00:00:00Z')) });
  const current = await source.where('date', '<=', Timestamp.fromMillis(253_402_300_799_999)).orderBy('date', 'desc').get();
  const legacy = await source.where('date', '>=', '').orderBy('date', 'desc').get();
  expect(current.docs.map(doc => doc.id)).toEqual(['new']); expect(legacy.docs.map(doc => doc.id)).toEqual(['old']);
  expect([...current.docs, ...legacy.docs].map(doc => readHistoryItem(doc.id, doc.data())!).sort((a, b) => b.date - a.date).map(item => item.id)).toEqual(['new', 'old']);
});

it('converts an offset ISO instant before it enters the chronologically ordered history feed', async () => {
  const db = getAdminDb(), ref = db.doc('users/learner/history/offset');
  const value = '2026-09-03T19:00:00+07:00';
  await ref.set({ date: value, config: { topic: 'Time' }, quizResults: [] });
  expect(readHistoryItem('offset', (await ref.get()).data())).toBeNull();
  expect((await migrateLearningTimes(db, true)).converted).toBe(1);
  expect(readHistoryItem('offset', (await ref.get()).data())?.date).toBe(Date.parse('2026-09-03T12:00:00Z'));
});

it('refuses conversion under an active backup barrier or account deletion lock', async () => {
  const db = getAdminDb();
  await db.doc('users/learner/history/legacy').set({ date: '2026-09-03' });
  await db.doc('_serviceState/maintenance').set({ active: true, expiresAtMs: Date.now() + 60000 });
  await expect(migrateLearningTimes(db, true)).rejects.toThrow('write barrier');
  await db.doc('_serviceState/maintenance').delete();
  await db.doc('_accountLocks/learner').set({ status: 'deleting' });
  await expect(migrateLearningTimes(db, true)).rejects.toThrow('write barrier');
  expect((await db.doc('users/learner/history/legacy').get()).get('date')).toBe('2026-09-03');
});

it('continues beyond a full migration page without skipping records whose indexed type changes', async () => {
  const db = getAdminDb(), batch = db.batch();
  for (let index = 0; index < 105; index++) batch.set(db.doc('users/missing/history/' + String(index).padStart(3, '0')), { date: '2026-09-03' });
  await batch.commit();
  const transactions = vi.spyOn(db, 'runTransaction');
  expect((await migrateLearningTimes(db, true)).converted).toBe(105);
  expect(transactions).toHaveBeenCalledTimes(6);
  expect((await migrateLearningTimes(db)).canonical).toBe(105);
});
it('shares each bounded transaction across owners and aborts the whole batch when one owner is locked', async () => {
  const db = getAdminDb();
  const first = db.doc('users/first/history/legacy'), second = db.doc('users/second/history/legacy');
  await first.set({ date: '2026-09-03', content: 'First' });
  await second.set({ date: '2026-09-03', content: 'Second' });
  await db.doc('_accountLocks/second').set({ status: 'deleting' });
  const transactions = vi.spyOn(db, 'runTransaction');
  expect((await migrateLearningTimes(db)).convertible).toBe(2);
  expect(transactions).not.toHaveBeenCalled();
  await expect(migrateLearningTimes(db, true)).rejects.toThrow('write barrier');
  expect((await first.get()).get('date')).toBe('2026-09-03');
  expect((await second.get()).get('date')).toBe('2026-09-03');
  await db.doc('_accountLocks/second').delete();
  expect((await migrateLearningTimes(db, true)).converted).toBe(2);
  expect((await first.get()).get('content')).toBe('First');
  expect((await second.get()).get('content')).toBe('Second');
});
it('rereads candidates after scanning and preserves concurrent canonicalization, deletion and invalidation', async () => {
  const db = getAdminDb(), refs = ['canonical', 'deleted', 'invalid'].map(id => db.doc('users/learner/history/' + id));
  await Promise.all(refs.map(ref => ref.set({ date: '2026-09-03' })));
  const original = db.runTransaction.bind(db);
  vi.spyOn(db, 'runTransaction').mockImplementationOnce(async (callback, options) => {
    await refs[0].update({ date: Timestamp.fromMillis(123456789) });
    await refs[1].delete(); await refs[2].update({ date: 'Invalid after scan' });
    return original(callback, options);
  });
  expect(await migrateLearningTimes(db, true)).toMatchObject({ scanned: 3, convertible: 3, converted: 0 });
  expect((await refs[0].get()).get('date').toMillis()).toBe(123456789);
  expect((await refs[1].get()).exists).toBe(false);
  expect((await refs[2].get()).get('date')).toBe('Invalid after scan');
});
it('stops later chunks on a newly active barrier and safely resumes already committed pages', async () => {
  const db = getAdminDb(), batch = db.batch();
  for (let index = 0; index < 25; index++) batch.set(db.doc('users/learner/history/' + String(index).padStart(2, '0')), { date: '2026-09-03' });
  await batch.commit();
  const original = db.runTransaction.bind(db);
  vi.spyOn(db, 'runTransaction').mockImplementationOnce(async (callback, options) => {
    const result = await original(callback, options);
    await db.doc('_serviceState/maintenance').set({ active: true, expiresAtMs: Date.now() + 60000 });
    return result;
  });
  await expect(migrateLearningTimes(db, true)).rejects.toThrow('write barrier');
  expect(await migrateLearningTimes(db)).toMatchObject({ canonical: 20, convertible: 5 });
  await db.doc('_serviceState/maintenance').delete();
  expect((await migrateLearningTimes(db, true)).converted).toBe(5);
});

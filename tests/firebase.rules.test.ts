import { assertFails,assertSucceeds,initializeTestEnvironment,RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { type Firestore,disableNetwork,enableNetwork,collection,deleteDoc,deleteField,doc,getDoc,getDocs,query,serverTimestamp,setDoc,updateDoc,where } from 'firebase/firestore';
import fs from 'node:fs';
import { afterAll,afterEach,beforeAll,describe,it,expect } from 'vitest';
import { recordActiveDay } from '@/firebase/firestore/record-active-day';
import { arenaLeaderboardQuery } from '@/lib/arena-leaderboard';
import { currentServicePolicy } from '@/lib/service-policy';
import { forumReactionId } from '@/lib/community-privacy';

let testEnv: RulesTestEnvironment;
const validPost = () => ({ authorId: 'author', authorName: 'Author', authorPhoto: '', createdAt: serverTimestamp(), title: 'Math', content: 'Valid content', subject: 'math', likesCount: 0, likedBy: [], commentsCount: 0 });
const validProfile = () => ({ displayName: 'Learner', photoURL: '', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
const validNotes = (content: string) => ({ content, updatedAt: serverTimestamp() });
const publicPost = () => { const { likedBy: _members, ...metadata } = validPost(); return { ...metadata, privacyVersion: 1 }; };

beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Firestore Emulator is required');
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-shark-empti',
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8') },
  });
  // Integration files share the Emulator project; start this file in isolation.
  await testEnv.clearFirestore();
});
afterEach(async () => testEnv?.clearFirestore());
afterAll(async () => testEnv?.cleanup());
async function seedConsent(uid: string) {
  await testEnv.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), '_serviceConsents/' + uid), { ...currentServicePolicy, acceptedAt: serverTimestamp() }));
}

describe('Firestore access policy', () => {
  it('publishes marked metadata while denying canonical membership, raw ranking ownership and unmarked projections', async () => {
    const rankingId = '11111111-1111-4111-8111-111111111111';
    await testEnv.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      await setDoc(doc(db, 'posts/source'), { ...validPost(), likedBy: ['victim'], likesCount: 1 });
      await setDoc(doc(db, 'forumPosts/visible'), publicPost());
      await setDoc(doc(db, 'forumPosts/unmarked'), { legacyPrivate: 'preserve' });
      await setDoc(doc(db, 'arenaExams/exam'), { schemaVersion: 2 });
      await setDoc(doc(db, 'arenaExams/exam/attempts/legacy-owner'), { userId: 'victim' });
      await setDoc(doc(db, 'arenaExams/exam/rankings/' + rankingId), { privacyVersion: 1, score: 100 });
      await setDoc(doc(db, 'users/learner/arenaRankings/exam'), { rankingId, privacyVersion: 1 });
    });
    const guest = testEnv.unauthenticatedContext().firestore(), owner = testEnv.authenticatedContext('learner').firestore();
    await assertFails(getDoc(doc(guest, 'posts/source'))); await assertFails(getDoc(doc(owner, 'posts/source')));
    await assertFails(getDocs(collection(guest, 'posts'))); await assertFails(getDoc(doc(guest, 'forumPosts/unmarked')));
    await assertFails(getDocs(collection(guest, 'forumPosts')));
    const visible = await assertSucceeds(getDocs(query(collection(guest, 'forumPosts'), where('privacyVersion', '==', 1))));
    expect(visible.docs.map(row => row.id)).toEqual(['visible']); expect(visible.docs[0].get('likedBy')).toBeUndefined();
    await assertFails(getDoc(doc(owner, 'arenaExams/exam/attempts/legacy-owner')));
    await assertFails(getDocs(collection(guest, 'arenaExams/exam/attempts')));
    await assertSucceeds(getDoc(doc(guest, 'arenaExams/exam/rankings/' + rankingId)));
    const pointer = doc(owner, 'users/learner/arenaRankings/exam'); await assertSucceeds(getDoc(pointer));
    await assertFails(getDoc(doc(guest, pointer.path))); await assertFails(getDoc(doc(testEnv.authenticatedContext('other').firestore(), pointer.path)));
    await seedConsent('learner'); await assertFails(updateDoc(pointer, { rankingId: 'forged' })); await assertFails(deleteDoc(pointer));
    await assertFails(setDoc(doc(owner, 'forumPosts/forged'), publicPost()));
  });
  it('keeps the server-owned reaction view private to its account and rejects direct creation/update', async () => {
    const path = 'users/learner/forumReactions/' + await forumReactionId({ postId: 'post' });
    await testEnv.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), path), { postId: 'post', liked: true, privacyVersion: 1 }));
    const owner = testEnv.authenticatedContext('learner').firestore();
    await assertSucceeds(getDoc(doc(owner, path)));
    await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), path)));
    await assertFails(getDoc(doc(testEnv.authenticatedContext('other').firestore(), path)));
    await seedConsent('learner');
    await assertFails(updateDoc(doc(owner, path), { liked: false }));
    await assertFails(deleteDoc(doc(owner, path)));
    await assertFails(setDoc(doc(owner, 'users/learner/forumReactions/forged'), { postId: 'post', liked: true, privacyVersion: 1 }));
  });
  it('F02 rejects unrecognized private paths and direct complex learning writes even for an acknowledged owner', async () => {
    await seedConsent('learner');
    const db = testEnv.authenticatedContext('learner').firestore();
    await assertFails(setDoc(doc(db, 'users/learner/arbitrary/record'), { content: 'Unknown structure' }));
    await assertFails(setDoc(doc(db, 'users/learner/notes/main/deep/record'), { content: 'Unknown descendant' }));
    await assertFails(setDoc(doc(db, 'users/learner/history/bad'), { date: serverTimestamp(), quizResults: [null] }));
  });
  it('F02 rejects malformed profile fields rather than relying only on their public field names', async () => {
    const db = testEnv.authenticatedContext('learner').firestore();
    const ref = doc(db, 'users/learner');
    for (const patch of [{ displayName: { private: 'Nested content' } }, { displayName: 'x'.repeat(201) },
      { displayName: ' \n\t' }, { photoURL: 'javascript:alert(1)' }, { photoURL: 'https://' + 'x'.repeat(2048) },
      { bio: {} }, { bio: 'x'.repeat(20001) }, { sharkCoins: 1 }, { unknown: true }, { createdAt: 'yesterday' }]) {
      await assertFails(setDoc(ref, { ...validProfile(), ...patch }));
    }
    await assertSucceeds(setDoc(ref, { ...validProfile(), displayName: 'x'.repeat(200), photoURL: 'HTTPS://example.invalid/photo', bio: 'x'.repeat(20000) }));
    const createdAt = (await getDoc(ref)).get('createdAt');
    for (const patch of [{ displayName: 1 }, { bio: 'x'.repeat(20001) }, { photoURL: 'data:text/plain,bad' },
      { createdAt: new Date(1) }, { updatedAt: new Date(1) }, { sharkCoins: 1 }, { unknown: true }]) {
      await assertFails(updateDoc(ref, { updatedAt: serverTimestamp(), ...patch }));
    }
    await assertSucceeds(updateDoc(ref, { bio: '', updatedAt: serverTimestamp() }));
    expect((await getDoc(ref)).get('createdAt').isEqual(createdAt)).toBe(true);
  });
  it('F02 limits notes to the documented path and bounds changes without erasing legacy fields', async () => {
    await seedConsent('learner');
    const db = testEnv.authenticatedContext('learner').firestore(), ref = doc(db, 'users/learner/notes/main');
    for (const value of [{ content: {} }, { content: 'x'.repeat(20001) }, { content: 'Valid', unknown: true }, { content: 'Valid', updatedAt: new Date(1) }]) {
      await assertFails(setDoc(ref, { updatedAt: serverTimestamp(), ...value }));
    }
    await assertFails(setDoc(doc(db, 'users/learner/notes/other'), validNotes('Unexpected document')));
    await assertSucceeds(setDoc(ref, validNotes('x'.repeat(20000))));
    await testEnv.withSecurityRulesDisabled(context => updateDoc(doc(context.firestore(), ref.path), { preserved: { private: 'Legacy' } }));
    await assertSucceeds(updateDoc(ref, validNotes('')));
    await assertFails(updateDoc(ref, { preserved: deleteField(), updatedAt: serverTimestamp() }));
    expect((await getDoc(ref)).get('preserved')).toEqual({ private: 'Legacy' });
  });
  it('F02 requires a single real activity date and prevents replacing existing leaves', async () => {
    await seedConsent('learner');
    const db = testEnv.authenticatedContext('learner').firestore(), ref = doc(db, 'users/learner/activity/main');
    for (const activeDays of [{}, { '2026-02-29': true }, { '2026-04-31': true }, { '1900-02-29': true },
      { '2026-11-01': 'true' }, { '2026-11-01': { nested: true } }, { secret: true }, { '2026-11-01': true, '2026-11-02': true }]) {
      await assertFails(setDoc(ref, { activeDays, updatedAt: serverTimestamp() }));
    }
    await assertSucceeds(recordActiveDay(db as unknown as Firestore, 'learner', '2000-02-29'));
    await assertSucceeds(recordActiveDay(db as unknown as Firestore, 'learner', '2024-02-29'));
    await assertFails(updateDoc(ref, { 'activeDays.2000-02-29': false, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { 'activeDays.2000-02-29': deleteField(), updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { activeDays: { '2026-11-01': true }, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { arbitrary: true, updatedAt: serverTimestamp() }));
    await testEnv.withSecurityRulesDisabled(context => updateDoc(doc(context.firestore(), ref.path), { 'activeDays.legacy': 'Retain' }));
    await assertSucceeds(recordActiveDay(db as unknown as Firestore, 'learner', '2026-11-01'));
    expect((await getDoc(ref)).get('activeDays.legacy')).toBe('Retain');
  });
  it('F02 bounds activity growth while retaining oversized legacy maps for owner access', async () => {
    await seedConsent('learner');
    const days = Object.fromEntries(Array.from({ length: 5000 }, (_, i) => [new Date(Date.UTC(2000, 0, i + 1)).toISOString().slice(0, 10), true]));
    await testEnv.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), 'users/learner/activity/main'), { activeDays: days }));
    const db = testEnv.authenticatedContext('learner').firestore() as unknown as Firestore;
    await assertSucceeds(recordActiveDay(db, 'learner', '2000-01-01'));
    await assertFails(recordActiveDay(db, 'learner', '2026-11-01'));
    await testEnv.withSecurityRulesDisabled(context => updateDoc(doc(context.firestore(), 'users/learner/activity/main'), { 'activeDays.legacy': 'Retain' }));
    await assertSucceeds(recordActiveDay(db, 'learner', '2000-01-01'));
    expect(Object.keys((await getDoc(doc(db, 'users/learner/activity/main'))).get('activeDays'))).toHaveLength(5001);
  });
  it('F02 preserves owner access and explicit deletion of unknown legacy descendants without renewed consent', async () => {
    await testEnv.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), 'users/legacy/unknown/record/deep/private'), { private: 'Retain' }));
    const owner = doc(testEnv.authenticatedContext('legacy').firestore(), 'users/legacy/unknown/record/deep/private');
    await assertFails(getDoc(doc(testEnv.authenticatedContext('other').firestore(), owner.path)));
    await assertSucceeds(getDoc(owner));
    await assertFails(updateDoc(owner, { private: 'Rejected' }));
    await assertSucceeds(deleteDoc(owner));
  });
  it('requires server-owned current consent for learning writes while allowing owner reads and profile provisioning', async () => {
    const db = testEnv.authenticatedContext('unconfirmed').firestore();
    await assertSucceeds(setDoc(doc(db, 'users/unconfirmed'), { ...validProfile(), displayName: 'New learner' }));
    await assertFails(setDoc(doc(db, 'users/unconfirmed/preferences/service'), { ...currentServicePolicy, acceptedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(db, 'users/unconfirmed/notes/main'), validNotes('Private')));
    await assertFails(setDoc(doc(db, '_serviceConsents/unconfirmed'), { ...currentServicePolicy, acceptedAt: serverTimestamp() }));
    await assertFails(getDoc(doc(db, '_serviceConsents/unconfirmed')));
    await seedConsent('unconfirmed');
    await assertSucceeds(setDoc(doc(db, 'users/unconfirmed/notes/main'), validNotes('Private')));
    await testEnv.withSecurityRulesDisabled(context => updateDoc(doc(context.firestore(), '_serviceConsents/unconfirmed'), { policyVersion: 'old' }));
    await assertFails(updateDoc(doc(db, 'users/unconfirmed/notes/main'), validNotes('Rejected')));
    await assertSucceeds(getDoc(doc(db, 'users/unconfirmed/notes/main')));
  });
  it.each([['history', 'date'], ['flashcards', 'createdAt'], ['practice', 'createdAt']])('requires server APIs for %s writes while retaining legacy reads and deletion', async (group, field) => {
    await seedConsent('learner');
    const db = testEnv.authenticatedContext('learner').firestore();
    const reference = doc(db, `users/learner/${group}/time`);
    await assertFails(setDoc(reference, { [field]: '2026-09-03T12:00:00Z' }));
    await assertFails(setDoc(reference, { [field]: Date.now() }));
    await assertFails(setDoc(reference, { unrelated: true }));
    await testEnv.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), reference.path), { [field]: '2026-09-03T12:00:00Z' }));
    await assertSucceeds(getDoc(reference));
    await assertFails(updateDoc(reference, { [field]: serverTimestamp() }));
    await assertFails(updateDoc(reference, { [field]: 'invalid' }));
    await assertSucceeds(deleteDoc(reference));
  });
  it('blocks new private writes under deletion or an active backup barrier while preserving owner reads', async () => {
    await seedConsent('learner');
    const db = testEnv.authenticatedContext('learner').firestore();
    await assertSucceeds(setDoc(doc(db, 'users/learner/notes/main'), validNotes('Owned')));
    await testEnv.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), '_accountLocks/learner'), { status: 'deleting' }));
    await assertSucceeds(getDoc(doc(db, 'users/learner/notes/main')));
    await assertFails(setDoc(doc(db, 'users/learner/notes/main'), validNotes('Rejected')));
    await testEnv.withSecurityRulesDisabled(async context => {
      await deleteDoc(doc(context.firestore(), '_accountLocks/learner'));
      await setDoc(doc(context.firestore(), '_serviceState/maintenance'), { active: true, expiresAtMs: Date.now() + 60000 });
    });
    await assertFails(updateDoc(doc(db, 'users/learner/notes/main'), validNotes('Rejected')));
    await testEnv.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), '_serviceState/maintenance'), { active: true, expiresAtMs: 1 }));
    await assertSucceeds(updateDoc(doc(db, 'users/learner/notes/main'), validNotes('Allowed after expiry')));
    for (const collection of ['_accountJobs', '_accountLocks', '_deletionJournal', '_jobWorkerState', '_jobBudgets', '_serviceState']) {
      await assertFails(getDoc(doc(db, collection + '/private')));
      await assertFails(setDoc(doc(db, collection + '/forged'), { active: false }));
    }
  });
  it('orders all tied Arena scores by duration and ID before limiting, excluding legacy timing', async () => {
    await testEnv.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      await setDoc(doc(db, 'arenaExams/exam'), { schemaVersion: 2 });
      for (let i = 0; i < 15; i++) await setDoc(doc(db, 'arenaExams/exam/rankings', `a${String(i).padStart(2, '0')}`), {
        privacyVersion: 1, timingVersion: 1, rankingVersion: 2, score: 100, duration: 15 - i,
      });
      await setDoc(doc(db, 'arenaExams/exam/rankings/z-tie'), { privacyVersion: 1, timingVersion: 1, rankingVersion: 2, score: 100, duration: 1 });
      await setDoc(doc(db, 'arenaExams/exam/rankings/legacy'), { score: 100, duration: 0 });
    });
    const result = await getDocs(arenaLeaderboardQuery(testEnv.unauthenticatedContext().firestore() as unknown as Firestore, 'exam'));
    expect(result.docs.map(row => row.id)).toEqual(['a14', 'z-tie', 'a13', 'a12', 'a11', 'a10', 'a09', 'a08', 'a07', 'a06']);
  });
  it('denies browser access to server timing sessions', async () => {
    const db = testEnv.authenticatedContext('learner').firestore();
    await assertFails(setDoc(doc(db, '_arenaSessions/forged'), { startedAtMs: 0 }));
    await assertFails(getDoc(doc(db, '_arenaSessions/forged')));
  });
  it.each([false, true])('preserves independently queued days from two stale clients (reverse=%s)', async reverse => {
    await seedConsent('learner');
    const first = testEnv.authenticatedContext('learner').firestore() as unknown as Firestore;
    const second = testEnv.authenticatedContext('learner').firestore() as unknown as Firestore;
    await recordActiveDay(first, 'learner', '2026-09-01');
    const firstSnapshot = (await getDoc(doc(first, 'users/learner/activity/main'))).data();
    const secondSnapshot = (await getDoc(doc(second, 'users/learner/activity/main'))).data();
    expect(firstSnapshot?.activeDays).toEqual(secondSnapshot?.activeDays);
    const writes = [() => recordActiveDay(first, 'learner', '2026-09-02'), () => recordActiveDay(second, 'learner', '2026-09-03')];
    for (const write of reverse ? writes.reverse() : writes) await write();
    expect((await getDoc(doc(first, 'users/learner/activity/main'))).data()?.activeDays).toEqual({ '2026-09-01': true, '2026-09-02': true, '2026-09-03': true });
    await assertFails(recordActiveDay(second, 'someone-else', '2026-09-04'));
  });
  it('merges an offline activity write after another device records a different day', async () => {
    await seedConsent('learner');
    const first = testEnv.authenticatedContext('learner').firestore() as unknown as Firestore;
    const second = testEnv.authenticatedContext('learner').firestore() as unknown as Firestore;
    await recordActiveDay(first, 'learner', '2026-09-01');
    await getDoc(doc(second, 'users/learner/activity/main'));
    await disableNetwork(second);
    const queued = recordActiveDay(second, 'learner', '2026-09-02');
    await recordActiveDay(first, 'learner', '2026-09-03');
    await enableNetwork(second);
    await queued;
    expect((await getDoc(doc(first, 'users/learner/activity/main'))).data()?.activeDays).toEqual({ '2026-09-01': true, '2026-09-02': true, '2026-09-03': true });
  });
  it('allows signed-in profile reads but protects private learning history', async () => {
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'users', 'learner-a'), { displayName: 'Learner A' });
      await setDoc(doc(context.firestore(), 'users', 'learner-a', 'history', 'session-1'), { score: 80 });
    });
    const otherUser = testEnv.authenticatedContext('learner-b').firestore();
    await assertSucceeds(getDoc(doc(otherUser, 'users', 'learner-a')));
    await assertFails(getDoc(doc(otherUser, 'users', 'learner-a', 'history', 'session-1')));
  });

  it('denies profile enumeration and legacy private fields while retaining owner and safe UID lookup', async () => {
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'users/private'), { displayName: 'Private', email: 'private@example.invalid' });
      await setDoc(doc(context.firestore(), 'users/public'), { displayName: 'Public', bio: 'Hello' });
    });
    const other = testEnv.authenticatedContext('other').firestore();
    const owner = testEnv.authenticatedContext('private').firestore();
    await assertFails(getDoc(doc(other, 'users/private')));
    await assertFails(getDocs(collection(other, 'users')));
    await assertSucceeds(getDoc(doc(owner, 'users/private')));
    await assertSucceeds(getDoc(doc(other, 'users/public')));
    await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'users/public')));
    await assertFails(setDoc(doc(other, 'users/other'), { displayName: 'Other', email: 'no@example.invalid' }));
    await assertSucceeds(updateDoc(doc(owner, 'users/private'), { email: deleteField(), bio: 'Repaired', updatedAt: serverTimestamp() }));
    await assertSucceeds(getDoc(doc(other, 'users/private')));
  });

  it('denies root profile deletion/recreation and preserves server coin state and private descendants', async () => {
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'users/learner'), { displayName: 'Learner', sharkCoins: 100 });
      await setDoc(doc(context.firestore(), 'users/learner/history/session'), { score: 80 });
    });
    const owner = testEnv.authenticatedContext('learner').firestore();
    await assertFails(deleteDoc(doc(owner, 'users/learner')));
    await assertFails(setDoc(doc(owner, 'users/learner'), { displayName: 'Reset' }));
    await assertFails(updateDoc(doc(owner, 'users/learner'), { sharkCoins: deleteField(), updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(owner, 'users/learner'), { bio: 'Valid edit', updatedAt: serverTimestamp() }));
    expect((await getDoc(doc(owner, 'users/learner'))).get('sharkCoins')).toBe(100);
    expect((await getDoc(doc(owner, 'users/learner/history/session'))).exists()).toBe(true);
  });

  it('requires the budgeted API for creation but preserves anonymous public reading', async () => {
    const author = testEnv.authenticatedContext('author').firestore();
    await assertFails(setDoc(doc(author, 'posts', 'post-1'), validPost()));
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'posts/post-1'), validPost());
      await setDoc(doc(context.firestore(), 'forumPosts/post-1'), publicPost());
    });
    const anonymous = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anonymous, 'posts/post-1')));
    await assertSucceeds(getDoc(doc(anonymous, 'forumPosts/post-1')));
  });

  it('blocks direct reactions and protected client writes', async () => {
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'posts', 'post-1'), validPost());
      await setDoc(doc(context.firestore(), 'users', 'learner'), { sharkCoins: 10 });
      await setDoc(doc(context.firestore(), 'arenaExams', 'exam-1'), { authorId: 'author', totalAttempts: 0 });
    });
    const learner = testEnv.authenticatedContext('learner').firestore();
    await assertFails(updateDoc(doc(learner, 'posts', 'post-1'), { likedBy: ['learner'], likesCount: 1 }));
    await assertFails(updateDoc(doc(learner, 'users', 'learner'), { sharkCoins: 999 }));
    await assertFails(setDoc(doc(learner, 'arenaExams', 'exam-1', 'attempts', 'attempt-1'), { userId: 'learner' }));
    await assertFails(setDoc(doc(learner, 'posts', 'post-1', 'comments', 'comment-1'), { authorId: 'learner', content: 'Hi' }));
    await assertFails(deleteDoc(doc(learner, 'posts', 'post-1', 'comments', 'comment-1')));
  });

  it('does not let authors forge counters, likes or ownership', async () => {
    const author = testEnv.authenticatedContext('author').firestore();
    const post = doc(author, 'posts', 'author-post');
    const data = validPost();
    await assertFails(setDoc(post, { ...data, likesCount: 1, likedBy: ['victim'] }));
    await assertFails(setDoc(post, { ...data, commentsCount: 3 }));
    await assertFails(setDoc(post, data));
    await testEnv.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), 'posts/author-post'), data));
    await assertFails(updateDoc(post, { content: 'Updated content' }));
    await assertFails(updateDoc(post, { content: '' }));
    await assertFails(updateDoc(post, { title: 123 }));
    await assertFails(updateDoc(post, { authorId: 'victim' }));
    await assertFails(updateDoc(post, { commentsCount: 5 }));
    await assertFails(updateDoc(post, { likedBy: ['victim'], likesCount: 1 }));
    await assertFails(updateDoc(post, { likedBy: ['author', 'author'], likesCount: 2 }));
    await assertFails(updateDoc(post, { likedBy: ['author'], likesCount: 1 }));
  });

  it.each(Object.keys(validPost()))('rejects omission of required post field %s on create and update', async key => {
    const ref = doc(testEnv.authenticatedContext('author').firestore(), 'posts', 'post');
    const data: Record<string, unknown> = validPost(); delete data[key];
    await assertFails(setDoc(ref, data));
    await assertFails(setDoc(ref, validPost()));
    await assertFails(updateDoc(ref, { [key]: deleteField() }));
  });

  it('enforces text boundaries and rejects unknown or mistyped fields', async () => {
    const ref = doc(testEnv.authenticatedContext('author').firestore(), 'posts', 'post');
    await assertFails(setDoc(ref, { ...validPost(), title: 'x'.repeat(200), content: 'x'.repeat(20000), subject: 's'.repeat(100), authorName: 'a'.repeat(200) }));
    await assertFails(updateDoc(ref, { content: 'line one\nline two', updatedAt: serverTimestamp() }));
    for (const patch of [{ title: 'x'.repeat(201) }, { content: 'x'.repeat(20001) }, { subject: 's'.repeat(101) }, { content: ' \n\t ' }, { unknown: true }, { updatedAt: 'yesterday' }]) {
      await assertFails(updateDoc(ref, patch));
    }
    await assertFails(setDoc(doc(ref.parent, 'extra'), { ...validPost(), arbitrary: 1 }));
    await assertFails(setDoc(doc(ref.parent, 'bad-photo'), { ...validPost(), authorPhoto: 'javascript:alert(1)' }));
    await assertFails(setDoc(doc(ref.parent, 'bad-time'), { ...validPost(), createdAt: 'date' }));
    await assertFails(deleteDoc(ref));
  });

  it('requires live parents for comment reads and updates including legacy orphans', async () => {
    const comment = { postId: 'post', authorId: 'author', authorName: 'Author', authorPhoto: '', createdAt: serverTimestamp(), content: 'Comment', likesCount: 0, likedBy: [] };
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'posts/post'), validPost());
      await setDoc(doc(context.firestore(), 'posts/post/comments/comment'), comment);
      await setDoc(doc(context.firestore(), 'posts/orphan/comments/comment'), { ...comment, postId: 'orphan' });
      await setDoc(doc(context.firestore(), 'forumPosts/post'), publicPost());
      const { likedBy: _members, ...metadata } = comment;
      await setDoc(doc(context.firestore(), 'forumPosts/post/comments/comment'), { ...metadata, privacyVersion: 1 });
      await setDoc(doc(context.firestore(), 'forumPosts/orphan/comments/comment'), { ...metadata, privacyVersion: 1 });
    });
    const anonymous = testEnv.unauthenticatedContext().firestore();
    const author = testEnv.authenticatedContext('author').firestore();
    const ref = doc(author, 'posts/post/comments/comment');
    await assertFails(getDocs(collection(anonymous, 'posts/post/comments')));
    await assertSucceeds(getDocs(query(collection(anonymous, 'forumPosts/post/comments'), where('privacyVersion', '==', 1))));
    await assertFails(getDoc(doc(anonymous, 'forumPosts/orphan/comments/comment')));
    await assertFails(updateDoc(ref, { content: 'Edited', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { likedBy: ['author'], likesCount: 1 }));
    await assertFails(updateDoc(ref, { arbitrary: true }));
    await assertFails(updateDoc(ref, { postId: 'other' }));
    await assertFails(updateDoc(ref, { authorName: 'Forged' }));
    await assertFails(getDoc(doc(anonymous, 'posts/orphan/comments/comment')));
    await assertFails(getDocs(collection(anonymous, 'posts/orphan/comments')));
    await testEnv.withSecurityRulesDisabled(context => deleteDoc(doc(context.firestore(), 'posts/post')));
    await testEnv.withSecurityRulesDisabled(context => deleteDoc(doc(context.firestore(), 'forumPosts/post')));
    await assertFails(getDoc(ref));
    await assertFails(getDocs(collection(anonymous, 'posts/post/comments')));
    await assertFails(getDocs(query(collection(anonymous, 'forumPosts/post/comments'), where('privacyVersion', '==', 1))));
    await assertFails(updateDoc(ref, { content: 'After deletion' }));
    await assertFails(setDoc(doc(author, 'posts/post/comments/new'), comment));
  });

  it('protects recovery tombstones and prevents parent ID reuse', async () => {
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), '_forumDeletions/post'), { authorId: 'author', status: 'pending' });
      await setDoc(doc(context.firestore(), 'posts/post/comments/comment'), { content: 'private leftover' });
    });
    const author = testEnv.authenticatedContext('author').firestore();
    const other = testEnv.authenticatedContext('other').firestore();
    await assertSucceeds(getDoc(doc(author, '_forumDeletions/post')));
    await assertSucceeds(getDocs(query(collection(author, '_forumDeletions'), where('authorId', '==', 'author'), where('status', '==', 'pending'))));
    await assertFails(getDoc(doc(other, '_forumDeletions/post')));
    await assertFails(getDocs(collection(author, '_forumDeletions')));
    await assertFails(updateDoc(doc(author, '_forumDeletions/post'), { status: 'complete' }));
    await assertFails(deleteDoc(doc(author, '_forumDeletions/post')));
    await assertFails(setDoc(doc(author, 'posts/post'), validPost()));
    await assertFails(getDoc(doc(author, 'posts/post/comments/comment')));
  });

  it('requires server validation for every Arena creation and structural update', async () => {
    const author = testEnv.authenticatedContext('author').firestore();
    const ref = doc(author, 'arenaExams/exam');
    for (const data of [{ authorId: 'author', totalAttempts: 0 }, { authorId: 'author', totalAttempts: 0, config: {}, questions: [] }]) await assertFails(setDoc(ref, data));
    await testEnv.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), 'arenaExams/exam'), { authorId: 'author', title: 'Exam', totalAttempts: 0 }));
    for (const patch of [{ title: 'New' }, { config: {} }, { questions: [null] }, { arbitrary: true }, { totalAttempts: 9 }]) await assertFails(updateDoc(ref, patch));
  });
});

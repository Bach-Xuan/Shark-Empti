import { randomUUID } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getAdminDb } from '@/lib/firebase-admin';
import { migrateCommunityPrivacy } from '@/lib/community-privacy-migration';
import { acquireCommunityMigrationLease, prepareCommunityMigrationGuard, releaseCommunityMigrationLease } from '@/lib/community-migration-lease';
import { forumReactionId } from '@/lib/community-privacy';
import { archiveId } from '@/lib/community-moderation';
import { projectArenaRanking, projectForumMetadata } from '@/lib/community-projections';
vi.mock('server-only', () => ({}));

const stamp = new Timestamp(1_700_000_000, 123456789);
const forum = (members: string[] = []) => ({ title: 'Post', content: 'Body', subject: 'math', authorId: 'author', authorName: 'Author', authorPhoto: '', createdAt: stamp, likesCount: members.length, likedBy: members, commentsCount: 0, privateLegacy: { preserved: true } });
const rank = (owner = 'player') => ({ examId: 'exam', userId: owner, userName: 'Learner', userPhoto: '', score: 100, duration: 3, timingVersion: 1, rankingVersion: 2, createdAt: stamp, privateLegacy: 'retained' });
const exam = () => ({ schemaVersion: 2, title: 'Exam', authorId: 'author', authorName: 'Author', authorPhoto: '', questionCount: 1, createdAt: stamp, totalAttempts: 1, config: { topic: 'Addition', subject: 'math', grade: 'none', type: 'Mixed', difficulty: 'Easy', numQuestions: '1' } });
beforeEach(async () => {
  const cleared = await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-shark-empti/databases/(default)/documents`, { method: 'DELETE' });
  expect(cleared.ok).toBe(true);
});
afterEach(() => vi.restoreAllMocks());
async function seedRank() { const db = getAdminDb(); await db.doc('arenaExams/exam').set(exam()); await db.doc('arenaExams/exam/attempts/legacy-owner-hash').set(rank()); }

it('finds unknown or orphan public projections before publishing any source, preserving them for review', async () => {
  const db = getAdminDb(), source = db.doc('posts/valid');
  await source.set(forum());
  const unknown = db.doc('forumPosts/orphan');
  await unknown.set({ privacyVersion: 1, likedBy: ['private-uid'] });
  const comment = db.doc('forumPosts/missing/comments/orphan');
  await comment.set({ privacyVersion: 1, extra: 'unknown' });
  const ranking = db.doc('arenaExams/exam/rankings/' + randomUUID());
  await ranking.set({ privacyVersion: 1, userId: 'private-uid' });
  const dry = await migrateCommunityPrivacy(db);
  expect(dry.blocked).toBe(3);
  expect(dry.reasons['public-namespace-conflict']).toBe(3);
  expect((await source.get()).exists).toBe(true);
  const applied = await migrateCommunityPrivacy(db, true);
  expect(applied.blocked).toBe(3);
  expect((await db.doc('forumPosts/valid').get()).exists).toBe(false);
  expect((await unknown.get()).get('likedBy')).toEqual(['private-uid']);
  expect((await ranking.get()).get('userId')).toBe('private-uid');
  expect((await db.doc('_serviceState/maintenance').get()).exists).toBe(false);
});

it('detects valid-looking public projections without a canonical source', async () => {
  const db = getAdminDb(), rankingId = randomUUID();
  await db.doc('forumPosts/orphan').set(projectForumMetadata(forum(), 'post')!);
  await db.doc('arenaExams/exam/rankings/' + rankingId).set(projectArenaRanking(rank())!);
  const result = await migrateCommunityPrivacy(db);
  expect(result.reasons['orphan-public-projection']).toBe(2);
  expect(result.projectionsScanned).toBe(2);
});

it('rejects an existing public ranking whose document ID equals its owner UID', async () => {
  const db = getAdminDb(), uid = randomUUID(), source = { ...rank(uid), publicId: uid };
  await db.doc('arenaExams/exam/attempts/legacy').set(source);
  await db.doc('arenaExams/exam/rankings/' + uid).set(projectArenaRanking(source)!);
  const result = await migrateCommunityPrivacy(db);
  expect(result.reasons['ranking-id-conflict']).toBe(1);
});

it('blocks public copies of hidden or tombstoned posts before converting other records', async () => {
  const db = getAdminDb();
  await db.doc('_moderationArchives/' + archiveId('posts/hidden')).set({ target: { kind: 'post', id: 'hidden' }, snapshot: forum() });
  await db.doc('forumPosts/hidden').set(projectForumMetadata(forum(), 'post')!);
  await db.doc('posts/deleted').set(forum());
  await db.doc('_forumDeletions/deleted').set({ status: 'pending' });
  await db.doc('forumPosts/deleted').set(projectForumMetadata(forum(), 'post')!);
  await db.doc('posts/valid').set(forum());
  const result = await migrateCommunityPrivacy(db, true);
  expect(result.reasons['orphan-public-projection']).toBe(2);
  expect((await db.doc('forumPosts/valid').get()).exists).toBe(false);
  expect((await db.doc('forumPosts/hidden').get()).exists).toBe(true);
});

it('inventories without writes, preserves canonical data, uses an independent ranking ID, and safely repeats', async () => {
  const db = getAdminDb(), source = forum(['liker']);
  await db.doc('posts/post').set(source); await seedRank();
  const stored = (await db.doc('posts/post').get()).data();
  const dry = await migrateCommunityPrivacy(db);
  expect(dry).toMatchObject({ scanned: 2, forumEligible: 1, arenaEligible: 1, published: 0, ownerViews: 0, blocked: 0 });
  expect((await db.doc('forumPosts/post').get()).exists).toBe(false);
  expect((await db.doc('_serviceState/maintenance').get()).exists).toBe(false);
  expect((await db.doc('arenaExams/exam/attempts/legacy-owner-hash').get()).get('publicId')).toBeUndefined();
  const applied = await migrateCommunityPrivacy(db, true); expect(applied).toMatchObject({ published: 2, ownerViews: 2, blocked: 0 });
  expect((await db.doc('posts/post').get()).data()).toEqual(stored);
  const publicPost = (await db.doc('forumPosts/post').get()).data()!;
  expect(publicPost.likedBy).toBeUndefined(); expect(publicPost.privateLegacy).toBeUndefined(); expect(publicPost.authorId).toBe('author');
  expect(publicPost.createdAt.nanoseconds).toBe(stored!.createdAt.nanoseconds);
  const original = (await db.doc('arenaExams/exam/attempts/legacy-owner-hash').get()).data()!;
  expect(original.publicId).toMatch(/^[0-9a-f-]{36}$/); expect(original.publicId).not.toBe('legacy-owner-hash'); expect(original.privateLegacy).toBe('retained');
  const publicRank = (await db.doc('arenaExams/exam/rankings/' + original.publicId).get()).data()!;
  expect(publicRank.userId).toBeUndefined(); expect(publicRank.privateLegacy).toBeUndefined(); expect(publicRank).toMatchObject({ score: 100, formerMember: false, privacyVersion: 1 });
  expect((await db.doc('users/player/arenaRankings/exam').get()).data()).toEqual({ rankingId: original.publicId, privacyVersion: 1 });
  const own = db.doc('users/liker/forumReactions/' + await forumReactionId({ postId: 'post' })), before = (await own.get()).data();
  const repeated = await migrateCommunityPrivacy(db, true); expect(repeated.blocked).toBe(0); expect(repeated.ownerViews).toBe(0);
  expect((await own.get()).data()).toEqual(before); expect((await db.collection('arenaExams/exam/rankings').get()).size).toBe(1);
  expect((await db.doc('arenaExams/exam').get()).get('totalAttempts')).toBe(1);
  expect((await db.doc('users/player').get()).exists).toBe(false);
  expect((await db.doc('_jobWorkerState/lease').get()).exists).toBe(false);
});

it('pages past 100 sources and 50 members, ignores lookalike private paths, and prunes only recognized stale owner views', async () => {
  const db = getAdminDb(), batch = db.batch(), members = Array.from({ length: 51 }, (_, index) => 'liker' + index);
  for (let i = 0; i < 101; i++) batch.set(db.doc('posts/p' + String(i).padStart(3, '0')), forum(i === 0 ? members : []));
  batch.set(db.doc('users/foreign/comments/private'), { private: true }); await batch.commit();
  const target = { postId: 'removed' }, stale = db.doc('users/former/forumReactions/' + await forumReactionId(target));
  await stale.set({ ...target, liked: true, privacyVersion: 1 });
  const result = await migrateCommunityPrivacy(db, true); expect(result).toMatchObject({ scanned: 101, forumEligible: 101, published: 101, blocked: 0 });
  expect((await db.collection('forumPosts').get()).size).toBe(101);
  expect((await db.collectionGroup('forumReactions').get()).size).toBe(51); expect((await stale.get()).exists).toBe(false);
  expect((await db.doc('users/foreign/comments/private').get()).data()).toEqual({ private: true });
});

it('prepares hidden archives and their comments for restore while keeping deleted targets and orphan comments unpublished', async () => {
  const db = getAdminDb();
  await db.doc('_moderationArchives/' + archiveId('posts/hidden')).set({ target: { kind: 'post', id: 'hidden' }, snapshot: forum(['liker']) });
  const { title: _title, subject: _subject, commentsCount: _count, ...comment } = forum();
  await db.doc('posts/hidden/comments/comment').set(comment); await db.doc('posts/orphan/comments/comment').set(comment);
  await db.doc('posts/deleted').set(forum(['liker'])); await db.doc('_forumDeletions/deleted').set({ status: 'pending' });
  const result = await migrateCommunityPrivacy(db, true); expect(result.blocked).toBe(0);
  expect((await db.doc('forumPosts/hidden').get()).exists).toBe(false);
  expect((await db.doc('_moderationArchives/' + archiveId('posts/hidden')).get()).get('privacyReady')).toBe(true);
  expect((await db.doc('forumPosts/hidden/comments/comment').get()).exists).toBe(true);
  expect((await db.doc('forumPosts/orphan/comments/comment').get()).exists).toBe(false);
  expect((await db.doc('forumPosts/deleted').get()).exists).toBe(false);
  expect((await db.doc('users/liker/forumReactions/' + await forumReactionId({ postId: 'hidden' })).get()).exists).toBe(true);
});

it.each(['account-lock', 'deletion-journal', 'public-namespace-conflict', 'private-reaction-conflict'])('preserves conflicting data and reports %s', async reason => {
  const db = getAdminDb(), source = forum(['liker']); await db.doc('posts/post').set(source);
  const stored = (await db.doc('posts/post').get()).data();
  const own = db.doc('users/liker/forumReactions/' + await forumReactionId({ postId: 'post' }));
  if (reason === 'account-lock') await db.doc('_accountLocks/author').set({ status: 'deleting' });
  if (reason === 'deletion-journal') await db.doc('_deletionJournal/author').set({ uid: 'author' });
  if (reason === 'public-namespace-conflict') await db.doc('forumPosts/post').set({ legacyUnknown: 'preserve' });
  if (reason === 'private-reaction-conflict') await own.set({ legacyUnknown: 'preserve' });
  const result = await migrateCommunityPrivacy(db, true); expect(result.reasons[reason]).toBeGreaterThan(0);
  expect((await db.doc('posts/post').get()).data()).toEqual(stored);
  if (reason === 'public-namespace-conflict') expect((await db.doc('forumPosts/post').get()).data()).toEqual({ legacyUnknown: 'preserve' });
  if (reason === 'private-reaction-conflict') expect((await own.get()).data()).toEqual({ legacyUnknown: 'preserve' });
  expect((await db.doc('_serviceState/maintenance').get()).exists).toBe(false);
});

it('does not choose between duplicate legacy ranking owners or publish practice/malformed parent exams', async () => {
  const db = getAdminDb(); await seedRank();
  await db.doc('arenaExams/exam/attempts/duplicate').set(rank());
  const duplicate = await migrateCommunityPrivacy(db, true); expect(duplicate.reasons['ambiguous-ranking-owner']).toBe(2);
  expect((await db.collection('arenaExams/exam/rankings').get()).empty).toBe(true);
  await db.doc('arenaExams/exam/attempts/duplicate').delete(); await db.doc('arenaExams/exam').update({ practiceOnly: true });
  expect((await migrateCommunityPrivacy(db, true)).arenaEligible).toBe(0);
  await db.doc('arenaExams/exam').set({ schemaVersion: 2 }); expect((await migrateCommunityPrivacy(db, true)).arenaEligible).toBe(0);
});

it('keeps independently anonymized former rankings and blocks a forged private pointer', async () => {
  const db = getAdminDb(); await seedRank();
  await db.doc('users/player/arenaRankings/exam').set({ rankingId: randomUUID(), privacyVersion: 1 });
  expect((await migrateCommunityPrivacy(db, true)).reasons['private-ranking-conflict']).toBe(1);
  await db.doc('arenaExams/exam/attempts/legacy-owner-hash').set(rank('__deleted__'));
  await db.doc('arenaExams/exam/attempts/other-former').set(rank('__deleted__'));
  expect((await migrateCommunityPrivacy(db, true)).arenaEligible).toBe(2);
  const rows = await db.collection('arenaExams/exam/rankings').get(); expect(rows.size).toBe(2);
  for (const row of rows.docs) expect(row.data()).toMatchObject({ userName: 'Former member', userPhoto: '', formerMember: true });
});

it('prepares rankings under a hidden exam and refuses a public ID bound to multiple sources', async () => {
  const db = getAdminDb(); await seedRank();
  await db.doc('_moderationArchives/' + archiveId('arenaExams/exam')).set({ target: { kind: 'exam', id: 'exam' }, snapshot: exam() });
  await db.doc('arenaExams/exam').delete();
  expect((await migrateCommunityPrivacy(db, true)).arenaEligible).toBe(1);
  expect((await db.collection('arenaExams/exam/rankings').get()).size).toBe(1);
  const first = (await db.doc('arenaExams/exam/attempts/legacy-owner-hash').get()).data()!;
  await db.doc('arenaExams/exam/attempts/second-owner').set({ ...rank('other-player'), publicId: first.publicId });
  const before = (await db.doc('arenaExams/exam/rankings/' + first.publicId).get()).data();
  const result = await migrateCommunityPrivacy(db, true); expect(result.reasons['ranking-id-conflict']).toBe(1);
  expect((await db.doc('arenaExams/exam/rankings/' + first.publicId).get()).data()).toEqual(before);
});

it('fences active workers, refuses stale leases, and never removes a replacement fence', async () => {
  const db = getAdminDb();
  await db.doc('_jobWorkerState/lease').set({ id: 'worker', expiresAtMs: Date.now() + 60000 });
  await expect(acquireCommunityMigrationLease(db)).rejects.toThrow('active');
  await db.doc('_jobWorkerState/lease').update({ expiresAtMs: 1 });
  const lease = await acquireCommunityMigrationLease(db); await db.doc('_jobWorkerState/lease').update({ expiresAtMs: 1 });
  await expect(db.runTransaction(async tx => { const renew = await prepareCommunityMigrationGuard(tx, db, [], lease); renew(); })).rejects.toThrow('no longer valid');
  await expect(acquireCommunityMigrationLease(db)).rejects.toThrow('active');
  await db.doc('_serviceState/maintenance').update({ expiresAtMs: 1 });
  const replacement = await acquireCommunityMigrationLease(db);
  await releaseCommunityMigrationLease(db, lease);
  expect((await db.doc('_serviceState/maintenance').get()).get('id')).toBe(replacement.id);
  await releaseCommunityMigrationLease(db, replacement); expect((await db.doc('_serviceState/maintenance').get()).exists).toBe(false);
});

it('does not renew a lease that expires while the remaining reads are running', async () => {
  const db = getAdminDb(), lease = await acquireCommunityMigrationLease(db);
  await expect(db.runTransaction(async tx => {
    const renew = await prepareCommunityMigrationGuard(tx, db, [], lease);
    const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 6 * 60_000);
    try { renew(); } finally { clock.mockRestore(); }
  })).rejects.toThrow('expired before commit');
  await releaseCommunityMigrationLease(db, lease);
});

import 'server-only';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { FieldPath, type DocumentReference, type DocumentSnapshot, type Firestore, type Query } from 'firebase-admin/firestore';
import { z } from 'zod';
import { isDocumentId } from './document-id';
import { archiveId, reportTargetSchema, targetReference } from './community-moderation';
import { COMMUNITY_PRIVACY_VERSION, FORUM_REACTIONS_COLLECTION, OWN_ARENA_RANKINGS_COLLECTION, forumReactionId, ownArenaRankingSchema, ownForumReactionSchema } from './community-privacy';
import { prepareOwnForumReaction } from './forum-reaction-owner';
import { ApiError } from './server-api';
import { forumPublicReference } from './forum-publication';
import { arenaPublicReference } from './arena-publication';
import { projectArenaRanking, projectForumMetadata } from './community-projections';
import { publicArenaRankingSchema, publicForumCommentSchema, publicForumPostSchema, readArenaExam, readForumComment, readForumPost } from './public-firestore-schema';
import { acquireCommunityMigrationLease, CommunityRecordConflict, prepareCommunityMigrationGuard, releaseCommunityMigrationLease, type CommunityMigrationLease } from './community-migration-lease';

type ForumSource = { ref: DocumentReference; path: string; kind: 'post' | 'comment'; archive: boolean };
type Summary = { scanned: number; ownerViewsScanned: number; projectionsScanned: number; forumEligible: number; arenaEligible: number; published: number; ownerViews: number; excluded: number; blocked: number; reasons: Record<string, number>; samples: Array<{ path: string; reason: string }> };

/** Name-only pages avoid materializing a page of large private legacy bodies. */
async function* references(source: Query) {
  let after: DocumentReference | undefined;
  for (;;) {
    const query = source.orderBy(FieldPath.documentId()).select().limit(100);
    const page = await (after ? query.startAfter(after) : query).get();
    if (page.empty) return;
    for (const row of page.docs) yield row.ref;
    after = page.docs.at(-1)!.ref;
  }
}
function conflict(reason: string): never { throw new CommunityRecordConflict(reason); }
async function prepareMigrationReaction(...args: Parameters<typeof prepareOwnForumReaction>) {
  try { return await prepareOwnForumReaction(...args); }
  catch (error) {
    if (error instanceof ApiError && error.code === 'APP-REQUEST-CONFLICT') conflict('private-reaction-conflict');
    throw error;
  }
}
function sourceData(source: ForumSource, row: DocumentSnapshot) {
  if (!row.exists) return null;
  const pathIds = source.path.split('/').filter((_, index) => index % 2 === 1);
  if (!pathIds.every(isDocumentId)) conflict('invalid-forum-path');
  const raw = source.archive ? row.get('snapshot') : row.data();
  const parsed = source.kind === 'post' ? readForumPost(source.path.split('/').at(-1)!, raw) : readForumComment(source.path.split('/').at(-1)!, raw);
  if (!parsed || !raw || typeof raw !== 'object' || !isDocumentId(parsed.authorId)
    || parsed.authorId !== raw.authorId || parsed.likedBy.some((uid, index) => !isDocumentId(uid) || uid === '__deleted__' || uid !== raw.likedBy[index])) conflict('invalid-forum-source');
  return { raw: raw as Record<string, unknown>, parsed };
}

/** Reject unknown data in the reserved public namespace instead of destroying it. */
export function isManagedCommunityProjection(path: string, value: Record<string, unknown>): boolean {
  const parts = path.split('/');
  if (parts[0] === 'forumPosts' && (parts.length === 2 || (parts.length === 4 && parts[2] === 'comments'))) {
    const kind = parts.length === 2 ? 'post' : 'comment', schema = kind === 'post' ? publicForumPostSchema : publicForumCommentSchema;
    return schema.strict().safeParse(value).success && isDeepStrictEqual(value, projectForumMetadata(value, kind));
  }
  if (parts.length === 4 && parts[0] === 'arenaExams' && parts[2] === 'rankings') {
    if (!publicArenaRankingSchema.strict().safeParse(value).success) return false;
    const projected = projectArenaRanking({ ...value, userId: value.formerMember === true ? '__deleted__' : 'projection-validation' });
    return isDeepStrictEqual(value, projected);
  }
  return false;
}
export function isCommunityProjectionPath(path: string) {
  const parts = path.split('/');
  return parts[0] === 'forumPosts' || (parts.length === 4 && parts[0] === 'arenaExams' && parts[2] === 'rankings');
}

async function convertForum(db: Firestore, source: ForumSource, summary: Summary, lease?: CommunityMigrationLease) {
  const initial = sourceData(source, await source.ref.get());
  if (!initial) return;
  if ((await db.doc('_forumDeletions/' + source.path.split('/')[1]).get()).exists) { summary.excluded++; return; }
  summary.forumEligible++;
  const postId = source.path.split('/')[1], target = { postId, ...(source.kind === 'comment' ? { commentId: source.path.split('/')[3] } : {}) };
  for (let offset = 0; offset < initial.parsed.likedBy.length; offset += 50) {
    const uids = initial.parsed.likedBy.slice(offset, offset + 50);
    const count = await db.runTransaction(async transaction => {
      const fresh = sourceData(source, await transaction.get(source.ref));
      if (!fresh) return 0;
      const renew = await prepareCommunityMigrationGuard(transaction, db, [fresh.parsed.authorId, ...uids], lease);
      const commits = [];
      for (const uid of uids) commits.push(await prepareMigrationReaction(transaction, db, uid, target, fresh.parsed.likedBy.includes(uid), { preserveExisting: true }));
      if (lease) { renew(); return commits.filter(commit => commit()).length; }
      return 0;
    });
    if (lease) summary.ownerViews += count;
  }
  const published = await db.runTransaction(async transaction => {
    const fresh = sourceData(source, await transaction.get(source.ref));
    if (!fresh) return false;
    const renew = await prepareCommunityMigrationGuard(transaction, db, [fresh.parsed.authorId], lease);
    const publicRef = forumPublicReference(db, source.path)!, publication = await transaction.get(publicRef);
    const tombstone = await transaction.get(db.doc('_forumDeletions/' + postId));
    if (!source.archive && (await transaction.get(db.doc('_moderationArchives/' + archiveId(source.path)))).exists) conflict('archive-live-conflict');
    if (publication.exists && !isManagedCommunityProjection(publicRef.path, publication.data()!)) conflict('public-namespace-conflict');
    if (source.archive) {
      if (tombstone.exists) conflict('deleted-archive-target');
      if ((await transaction.get(db.doc(source.path))).exists) conflict('archive-live-conflict');
      if (lease) { renew(); transaction.delete(publicRef); transaction.update(source.ref, { privacyReady: true }); }
      return false;
    }
    let visible = !tombstone.exists;
    if (source.kind === 'comment') {
      const [parent, hidden] = await transaction.getAll(db.doc('posts/' + postId), db.doc('_moderationArchives/' + archiveId('posts/' + postId)));
      visible = visible && (parent.exists || (hidden.exists && hidden.get('target.kind') === 'post' && hidden.get('target.id') === postId));
    }
    if (lease) {
      renew();
      if (visible) transaction.set(publicRef, projectForumMetadata(fresh.raw, source.kind)!); else transaction.delete(publicRef);
    }
    return visible;
  });
  if (lease && published) summary.published++;
}

async function convertRank(db: Firestore, ref: DocumentReference, summary: Summary, lease?: CommunityMigrationLease) {
  const candidateId = randomUUID();
  const converted = await db.runTransaction(async transaction => {
    const current = await transaction.get(ref), value = current.data();
    if (!value || !projectArenaRanking(value)) return null;
    if (!isDocumentId(value.userId) || !isDocumentId(value.examId) || value.examId !== ref.path.split('/')[1]) conflict('invalid-ranking-owner');
    const parentRef = ref.parent.parent!;
    const [parent, archivedParent] = await transaction.getAll(parentRef, db.doc('_moderationArchives/' + archiveId(parentRef.path)));
    const hiddenTarget = reportTargetSchema.safeParse(archivedParent.get('target'));
    const parentData = parent.exists ? parent.data() : hiddenTarget.success && hiddenTarget.data.kind === 'exam' && hiddenTarget.data.id === parentRef.id ? archivedParent.get('snapshot') : undefined;
    if (!parentData || parentData.schemaVersion !== 2 || parentData.practiceOnly === true || !readArenaExam(parentRef.id, parentData)) return null;
    if (value.userId !== '__deleted__') {
      const owners = await transaction.get(ref.parent.where('userId', '==', value.userId).where('rankingVersion', '==', 2).where('timingVersion', '==', 1).select().limit(2));
      if (owners.size !== 1) conflict('ambiguous-ranking-owner');
    }
    if (value.publicId !== undefined && (!z.string().uuid().safeParse(value.publicId).success || value.publicId === value.userId)) conflict('ranking-id-conflict');
    if (value.publicId !== undefined) {
      const bindings = await transaction.get(ref.parent.where('publicId', '==', value.publicId).select().limit(2));
      if (bindings.size !== 1) conflict('ranking-id-conflict');
    }
    const publicId = value.publicId ?? candidateId;
    const renew = await prepareCommunityMigrationGuard(transaction, db, [value.userId], lease);
    const publicRef = arenaPublicReference(db, ref.path, { ...value, publicId })!, publication = await transaction.get(publicRef);
    if (publication.exists && !isManagedCommunityProjection(publicRef.path, publication.data()!)) conflict('public-namespace-conflict');
    if (publication.exists && value.publicId === undefined) conflict('ranking-id-conflict');
    const ownerRef = value.userId === '__deleted__' ? null : db.doc(`users/${value.userId}/${OWN_ARENA_RANKINGS_COLLECTION}/${value.examId}`);
    const owner = ownerRef ? await transaction.get(ownerRef) : null;
    if (owner?.exists) {
      const parsed = ownArenaRankingSchema.safeParse(owner.data());
      if (!parsed.success || parsed.data.rankingId !== publicId) conflict('private-ranking-conflict');
    } else if (publication.exists && value.userId !== '__deleted__') conflict('ranking-ownership-conflict');
    if (lease) {
      renew(); transaction.update(ref, { publicId }); transaction.set(publicRef, projectArenaRanking(value)!);
      if (ownerRef && !owner?.exists) transaction.set(ownerRef, { rankingId: publicId, privacyVersion: COMMUNITY_PRIVACY_VERSION });
    }
    return { ownerWritten: !!ownerRef && !owner?.exists };
  });
  if (converted) { summary.arenaEligible++; if (lease) { summary.published++; if (converted.ownerWritten) summary.ownerViews++; } } else summary.excluded++;
}

async function reconcileOwnerView(db: Firestore, ref: DocumentReference, summary: Summary, lease?: CommunityMigrationLease) {
  const uid = ref.path.split('/')[1];
  if (!isDocumentId(uid)) conflict('invalid-owner-view');
  const changed = await db.runTransaction(async transaction => {
    const row = await transaction.get(ref);
    if (!row.exists) return false;
    const parsed = ownForumReactionSchema.safeParse(row.data());
    if (!parsed.success || await forumReactionId(parsed.data) !== ref.id) conflict('private-reaction-conflict');
    const target = parsed.data, path = 'posts/' + target.postId + (target.commentId ? '/comments/' + target.commentId : '');
    const [original, archived, deleted] = await transaction.getAll(db.doc(path), db.doc('_moderationArchives/' + archiveId(path)), db.doc('_forumDeletions/' + target.postId));
    const source: ForumSource = { ref: original.exists ? original.ref : archived.ref, path, kind: target.commentId ? 'comment' : 'post', archive: !original.exists };
    if (source.archive && archived.exists) {
      const descriptor = reportTargetSchema.safeParse(archived.get('target'));
      if (!descriptor.success || targetReference(db, descriptor.data).path !== path) conflict('archive-target-conflict');
    }
    const value = sourceData(source, original.exists ? original : archived);
    const wanted = !deleted.exists && !!value?.parsed.likedBy.includes(uid);
    const renew = await prepareCommunityMigrationGuard(transaction, db, [uid], lease);
    const commit = await prepareMigrationReaction(transaction, db, uid, target, wanted, { preserveExisting: true });
    if (!lease) return false;
    renew(); return commit();
  });
  if (changed) summary.ownerViews++;
}

/** Inspect the entire readable projection namespace before any conversion.
 * Unknown or orphaned data is reported, never overwritten or deleted. */
async function inspectProjection(db: Firestore, ref: DocumentReference, lease?: CommunityMigrationLease) {
  await db.runTransaction(async transaction => {
    const row = await transaction.get(ref);
    if (!row.exists) return;
    const renew = await prepareCommunityMigrationGuard(transaction, db, [], lease);
    if (!isManagedCommunityProjection(ref.path, row.data()!)) conflict('public-namespace-conflict');
    const parts = ref.path.split('/');
    if (parts[0] === 'forumPosts') {
      const sourcePath = ['posts', ...parts.slice(1)].join('/');
      const [source, tombstone, archive] = await transaction.getAll(db.doc(sourcePath), db.doc('_forumDeletions/' + parts[1]), db.doc('_moderationArchives/' + archiveId(sourcePath)));
      if (!source.exists || tombstone.exists) conflict('orphan-public-projection');
      if (archive.exists) conflict('archive-live-conflict');
    } else {
      if (!z.string().uuid().safeParse(ref.id).success) conflict('orphan-public-projection');
      const attempts = await transaction.get(db.collection(`arenaExams/${parts[1]}/attempts`).where('publicId', '==', ref.id).limit(2));
      if (attempts.size > 1) conflict('ranking-id-conflict');
      if (attempts.empty) conflict('orphan-public-projection');
      const source = attempts.docs[0].data();
      if (!isDocumentId(source.userId) || source.userId === ref.id || source.examId !== parts[1] || !projectArenaRanking(source)) conflict('ranking-id-conflict');
    }
    renew();
  });
}

async function migrate(db: Firestore, apply: boolean, isolatedRestore: boolean) {
  const summary: Summary = { scanned: 0, ownerViewsScanned: 0, projectionsScanned: 0, forumEligible: 0, arenaEligible: 0, published: 0, ownerViews: 0, excluded: 0, blocked: 0, reasons: {}, samples: [] };
  const lease = apply ? await acquireCommunityMigrationLease(db, isolatedRestore) : undefined;
  const run = async (ref: DocumentReference, task: () => Promise<void>, scope: 'source' | 'owner' | 'projection' = 'source') => {
    if (scope === 'owner') summary.ownerViewsScanned++; else if (scope === 'projection') summary.projectionsScanned++; else summary.scanned++;
    try { await task(); } catch (error) {
      if (!(error instanceof CommunityRecordConflict)) throw error;
      summary.blocked++; summary.reasons[error.message] = (summary.reasons[error.message] ?? 0) + 1;
      if (summary.samples.length < 20) summary.samples.push({ path: ref.path, reason: error.message });
    }
  };
  try {
    for await (const ref of references(db.collection('forumPosts'))) await run(ref, () => inspectProjection(db, ref, lease), 'projection');
    for await (const ref of references(db.collectionGroup('comments'))) {
      const parts = ref.path.split('/');
      if (parts.length === 4 && parts[0] === 'forumPosts') await run(ref, () => inspectProjection(db, ref, lease), 'projection');
    }
    for await (const ref of references(db.collectionGroup('rankings'))) {
      const parts = ref.path.split('/');
      if (parts.length === 4 && parts[0] === 'arenaExams') await run(ref, () => inspectProjection(db, ref, lease), 'projection');
    }
    if (summary.blocked) return summary;
    for await (const ref of references(db.collection('posts'))) await run(ref, () => convertForum(db, { ref, path: ref.path, kind: 'post', archive: false }, summary, lease));
    for await (const ref of references(db.collection('_moderationArchives'))) await run(ref, async () => {
      const row = await ref.get(), target = reportTargetSchema.safeParse(row.get('target'));
      if (!target.success || target.data.kind === 'exam') { summary.excluded++; return; }
      if (![target.data.id, ...(target.data.kind === 'comment' ? [target.data.parentId] : [])].every(isDocumentId)) conflict('invalid-archive-target');
      await convertForum(db, { ref, path: targetReference(db, target.data).path, kind: target.data.kind, archive: true }, summary, lease);
    });
    for await (const ref of references(db.collectionGroup('comments'))) {
      const parts = ref.path.split('/');
      if (parts.length !== 4 || parts[0] !== 'posts') continue;
      await run(ref, () => convertForum(db, { ref, path: ref.path, kind: 'comment', archive: false }, summary, lease));
    }
    for await (const ref of references(db.collectionGroup('attempts'))) {
      const parts = ref.path.split('/');
      if (parts.length !== 4 || parts[0] !== 'arenaExams') continue;
      await run(ref, () => convertRank(db, ref, summary, lease));
    }
    for await (const ref of references(db.collectionGroup(FORUM_REACTIONS_COLLECTION))) {
      const parts = ref.path.split('/');
      if (parts.length === 4 && parts[0] === 'users') await run(ref, () => reconcileOwnerView(db, ref, summary, lease), 'owner');
    }
    return summary;
  } finally { if (lease) await releaseCommunityMigrationLease(db, lease); }
}

/** Read-only by default. Apply is fenced, bounded and safely repeatable. */
export const migrateCommunityPrivacy = (db: Firestore, apply = false) => migrate(db, apply, false);
/** Only after an empty isolated restore target has been validated and imported.
 * Retained deletion locks stay intact; no background jobs are resumed. */
export const rebuildRestoredCommunity = (db: Firestore) => migrate(db, true, true);

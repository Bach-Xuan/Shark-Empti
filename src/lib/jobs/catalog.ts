import 'server-only';
import { FieldPath, type Query } from 'firebase-admin/firestore';
import { getAdminDb } from '../firebase-admin';
import { REQUEST_BUDGETS } from '../request-budget';
import { digest } from './crypto';

/** This inventory is shared by export/deletion and documented in the data map. */
export const OWNED_RECORDS = [
  { collection: 'posts', field: 'authorId', action: 'author' },
  { collection: 'comments', field: 'authorId', group: true, action: 'author' },
  { collection: 'arenaExams', field: 'authorId', action: 'author' },
  { collection: 'attempts', field: 'userId', group: true, action: 'attempt' },
  { collection: '_aiGenerations', field: 'ownerUid', action: 'delete' },
  { collection: '_arenaSessions', field: 'uid', action: 'delete' },
  { collection: '_arenaEligibility', field: 'uid', action: 'delete' },
  { collection: '_arenaAnswerKeys', field: 'authorId', action: 'author' },
  { collection: '_arenaLegacyBackups', field: 'snapshot.authorId', action: 'archive' },
  { collection: '_communityReports', field: 'reporterId', action: 'delete' },
  { collection: '_moderationArchives', field: 'snapshot.authorId', action: 'archive' },
  { collection: '_moderationArchives', field: 'hiddenBy', action: 'moderator' },
  { collection: '_moderationActions', field: 'actorId', action: 'actor' },
  { collection: '_accountRequests', field: 'uid', action: 'delete' },
  { collection: '_forumDeletions', field: 'authorId', action: 'author' },
  { collection: '_requestReceipts', field: 'ownerUid', action: 'delete' },
  { collection: '_accountJobs', field: 'ownerUid', action: 'job' },
] as const;

export function ownedQuery(index: number, uid: string): Query {
  const source = OWNED_RECORDS[index];
  const db = getAdminDb();
  const collection = 'group' in source ? db.collectionGroup(source.collection) : db.collection(source.collection);
  return collection.where(source.field, '==', uid).orderBy(FieldPath.documentId());
}

/** Collection-group names are also legal inside another owner's private tree. */
export function isCommunityRecordPath(path: string, collection: 'comments' | 'attempts'): boolean {
  const segments = path.split('/');
  return segments.length === 4 && segments[0] === (collection === 'comments' ? 'posts' : 'arenaExams') && segments[2] === collection;
}
export function isOwnedRecordPath(index: number, path: string): boolean {
  const source = OWNED_RECORDS[index];
  return !('group' in source) || isCommunityRecordPath(path, source.collection);
}
export function userBudgetPaths(uid: string) {
  return Object.keys(REQUEST_BUDGETS).map(scope => '_requestBudgets/' + scope + '_user_' + digest(uid));
}
export function continuation(query: Query, after?: string) {
  return after ? query.startAfter(getAdminDb().doc(after)) : query;
}

/** Exports contain the owner's records, not other members' IDs or credentials. */
export function redactExport(value: unknown, uid: string): unknown {
  if (Array.isArray(value)) return value.map(item => redactExport(item, uid));
  if (!value || typeof value !== 'object') return value;
  const result: Record<string, unknown> = Object.create(null);
  for (const [key, child] of Object.entries(value)) {
    if (/^(passwordHash|passwordSalt|tokens|refreshToken|accessToken|authorization|receiptHash|lease|inFlight|comments)$/.test(key)) continue;
    if (['authorId', 'reporterId', 'actorId', 'hiddenBy', 'userId', 'ownerUid', 'uid'].includes(key) && typeof child === 'string' && child !== uid) continue;
    if (key === 'likedBy' && Array.isArray(child)) { result[key] = child.filter(id => id === uid); continue; }
    result[key] = redactExport(child, uid);
  }
  return result;
}

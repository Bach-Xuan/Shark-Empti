import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Firestore } from 'firebase-admin/firestore';
import { getAdminAuth } from './firebase-admin';
import { ApiError, authenticatedUser } from './server-api';
import { requireDocumentId } from './forum-deletion';

export const reportTargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('post'), id: z.string().min(1).max(1500) }).strict(),
  z.object({ kind: z.literal('comment'), id: z.string().min(1).max(1500), parentId: z.string().min(1).max(1500) }).strict(),
  z.object({ kind: z.literal('exam'), id: z.string().min(1).max(1500) }).strict(),
]);
export type ReportTarget = z.infer<typeof reportTargetSchema>;
export function targetReference(db: Firestore, target: ReportTarget) {
  requireDocumentId(target.id);
  if (target.kind === 'comment') { requireDocumentId(target.parentId); return db.collection('posts').doc(target.parentId).collection('comments').doc(target.id); }
  return db.collection(target.kind === 'post' ? 'posts' : 'arenaExams').doc(target.id);
}
export const archiveId = (path: string) => createHash('sha256').update(path).digest('hex');

export async function authenticatedModerator(request: Request) {
  const uid = await authenticatedUser(request);
  // Use current server claims, so removing a role takes effect without waiting
  // for a previously issued browser token to expire.
  const user = await getAdminAuth().getUser(uid);
  if (user.disabled || user.customClaims?.moderator !== true) throw new ApiError('AUTH-FORBIDDEN', 403, 'Moderator access is required.');
  return uid;
}

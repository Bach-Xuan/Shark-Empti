import { isDocumentId } from './document-id';
import { z } from 'zod';

export const COMMUNITY_PRIVACY_VERSION = 1 as const;
export const FORUM_REACTIONS_COLLECTION = 'forumReactions';
export const PUBLIC_FORUM_COLLECTION = 'forumPosts';
export const ARENA_RANKINGS_COLLECTION = 'rankings';
export const OWN_ARENA_RANKINGS_COLLECTION = 'arenaRankings';

export type ForumReactionTarget = { postId: string; commentId?: string };
export const ownForumReactionSchema = z.object({
  postId: z.string().refine(isDocumentId), commentId: z.string().refine(isDocumentId).optional(),
  liked: z.literal(true), privacyVersion: z.literal(COMMUNITY_PRIVACY_VERSION), updatedAt: z.unknown().optional(),
}).strict();
export const ownArenaRankingSchema = z.object({ rankingId: z.string().uuid(), privacyVersion: z.literal(COMMUNITY_PRIVACY_VERSION) }).strict();

/** One flat owner collection: arbitrary comment threads must not exhaust the
 * account inventory's collection limit. The same key is used in Node/browser. */
export async function forumReactionId({ postId, commentId }: ForumReactionTarget): Promise<string> {
  if (!isDocumentId(postId) || (commentId !== undefined && !isDocumentId(commentId))) throw new Error('Invalid reaction target.');
  const bytes = new TextEncoder().encode(JSON.stringify([postId, commentId ?? null]));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

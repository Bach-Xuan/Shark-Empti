import 'server-only';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { COMMUNITY_PRIVACY_VERSION } from './community-privacy';
import { arenaAttemptSchema, publicArenaRankingSchema, publicForumCommentSchema, publicForumPostSchema } from './public-firestore-schema';
import { readTimeMillis } from './time';

/** Preserve valid Timestamp precision; never copy an arbitrary legacy map into
 * a public timestamp field. Pending server timestamps are added by the writer. */
function publicDate(value: unknown) {
  const millis = readTimeMillis(value);
  return millis === null ? null : value instanceof Timestamp ? value : Timestamp.fromMillis(millis);
}

export function projectForumMetadata(value: unknown, kind: 'post' | 'comment') {
  const schema = kind === 'post' ? publicForumPostSchema : publicForumCommentSchema;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const parsed = schema.safeParse({ ...source, privacyVersion: COMMUNITY_PRIVACY_VERSION });
  if (!parsed.success) return null;
  return { ...parsed.data, createdAt: publicDate(source.createdAt),
    ...(source.updatedAt !== undefined ? { updatedAt: publicDate(source.updatedAt) } : {}) };
}

export const privateForumReactionsSchema = z.object({
  likedBy: z.array(z.string().trim().min(1).max(128)).max(2000).refine(ids => new Set(ids).size === ids.length),
  likesCount: z.number().int().min(0).max(2000),
}).refine(value => value.likesCount === value.likedBy.length);

/** Only already eligible rankings may acquire a public projection. A privacy
 * migration must never promote an exposed-answer/practice legacy attempt. */
export function projectArenaRanking(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  if (source.timingVersion !== 1 || source.rankingVersion !== 2) return null;
  const attempt = arenaAttemptSchema.safeParse(source);
  if (!attempt.success) return null;
  const { userId, ...fields } = attempt.data;
  const formerMember = userId === '__deleted__';
  const parsed = publicArenaRankingSchema.safeParse({ ...fields, formerMember,
    ...(formerMember ? { userName: 'Former member', userPhoto: '' } : {}),
    privacyVersion: COMMUNITY_PRIVACY_VERSION, timingVersion: 1, rankingVersion: 2,
  });
  return parsed.success ? { ...parsed.data, createdAt: publicDate(source.createdAt) } : null;
}

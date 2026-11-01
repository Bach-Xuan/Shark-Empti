// @vitest-environment node
import { createHash } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { describe, expect, it, vi } from 'vitest';
import { forumReactionId } from '@/lib/community-privacy';
import { projectArenaRanking, projectForumMetadata, privateForumReactionsSchema } from '@/lib/community-projections';
import { readPublicArenaRanking, readPublicForumComment, readPublicForumPost } from '@/lib/public-firestore-schema';

vi.mock('server-only', () => ({}));

const createdAt = new Timestamp(123, 456789);
const author = { authorId: 'owner', authorName: 'Member', authorPhoto: '', createdAt };
const post = { ...author, title: 'Post', content: 'Content', subject: 'math', commentsCount: 2, likesCount: 1,
  likedBy: ['private-member'], arbitraryLegacyData: { token: 'private-value' } };

describe('public community projection boundary', () => {
  it('publishes bounded metadata/counts and no membership or unknown legacy values', () => {
    const projected = projectForumMetadata(post, 'post')!;
    expect(projected.createdAt).toBe(createdAt);
    expect(projected).toMatchObject({ privacyVersion: 1, title: 'Post', likesCount: 1, commentsCount: 2 });
    expect(JSON.stringify(projected)).not.toMatch(/private-member|private-value|likedBy|arbitraryLegacyData/);
    expect(readPublicForumPost('snapshot-id', { ...projected, id: 'forged', likedBy: ['foreign'] })).toMatchObject({ id: 'snapshot-id', likesCount: 1 });
    expect(readPublicForumPost('id', post)).toBeNull();
  });

  it('keeps comment metadata independent of the number of private members', () => {
    const projected = projectForumMetadata({ ...author, content: 'Comment', likesCount: 12, likedBy: ['private-member'] }, 'comment')!;
    expect(readPublicForumComment('comment', projected)).toMatchObject({ likesCount: 12, privacyVersion: 1 });
    expect(projected).not.toHaveProperty('likedBy');
    expect(projectForumMetadata({ ...post, content: 'x'.repeat(20001) }, 'post')).toBeNull();
  });

  it('normalizes valid legacy dates and rejects arbitrary maps in public date fields', () => {
    expect(projectForumMetadata({ ...post, createdAt: '2020-01-01T00:00:00.000Z' }, 'post')!.createdAt).toBeInstanceOf(Timestamp);
    const data = projectForumMetadata({ ...post, createdAt: { privateUid: 'private-member' }, updatedAt: { token: 'secret' } }, 'post')!;
    expect(data).toMatchObject({ createdAt: null, updatedAt: null });
    expect(JSON.stringify(data)).not.toMatch(/private-member|secret/);
  });

  it('does not trust or publish a private ranking owner, storage ID or unknown fields', () => {
    const projected = projectArenaRanking({ examId: 'exam', userId: 'private-member', userName: 'Participant', userPhoto: '', score: 80, duration: 20,
      createdAt, timingVersion: 1, rankingVersion: 2, publicId: 'owner-derived', tokens: 'private-value' })!;
    expect(projected).toMatchObject({ privacyVersion: 1, formerMember: false, score: 80, duration: 20 });
    expect(projected.createdAt).toBe(createdAt);
    expect(JSON.stringify(projected)).not.toMatch(/private-member|private-value|userId|publicId|tokens/);
    expect(readPublicArenaRanking('opaque-row', projected)).toMatchObject({ id: 'opaque-row' });
  });

  it('preserves the ranking eligibility boundary and removes former-member display metadata', () => {
    const source = { examId: 'exam', userId: '__deleted__', userName: 'Old name', userPhoto: 'https://example.com/old', score: 50, duration: 30, createdAt,
      timingVersion: 1, rankingVersion: 2 };
    expect(projectArenaRanking(source)).toMatchObject({ formerMember: true, userName: 'Former member', userPhoto: '' });
    expect(projectArenaRanking({ ...source, timingVersion: undefined })).toBeNull();
    expect(projectArenaRanking({ ...source, rankingVersion: 1 })).toBeNull();
    expect(projectArenaRanking({ ...source, score: 101 })).toBeNull();
  });

  it('validates the private membership/count contract independently', () => {
    expect(privateForumReactionsSchema.safeParse({ likedBy: ['a'], likesCount: 1 }).success).toBe(true);
    for (const value of [{ likedBy: ['a', 'a'], likesCount: 2 }, { likedBy: ['a'], likesCount: 0 }, { likedBy: Array(2001).fill('a'), likesCount: 2001 }]) {
      expect(privateForumReactionsSchema.safeParse(value).success).toBe(false);
    }
  });
});

it('matches Web Crypto target keys to the Node reference without post/comment collisions', async () => {
  const targets = [{ postId: 'post' }, { postId: 'post', commentId: 'comment' }, { postId: 'post_comment' },
    { postId: 'p'.repeat(128), commentId: '\u0000'.repeat(128) }, { postId: '日本語', commentId: 'ký tự' }];
  const keys = await Promise.all(targets.map(forumReactionId));
  expect(new Set(keys).size).toBe(targets.length);
  for (let i = 0; i < keys.length; i++) expect(keys[i]).toBe(createHash('sha256').update(JSON.stringify([targets[i].postId, targets[i].commentId ?? null])).digest('hex'));
  await expect(forumReactionId({ postId: 'bad/path' })).rejects.toThrow('Invalid reaction target');
});

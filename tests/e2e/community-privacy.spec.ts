import { expect, test } from './fixtures';
import { signInDemo } from './auth';
import { randomUUID } from 'node:crypto';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { forumReactionId } from '../../src/lib/community-privacy';
import { publishForumFixture } from './community-fixtures';

test('real post/comment likes keep the account reaction view and unlike state consistent', async ({ page }) => {
  await signInDemo(page);
  const db = getFirestore(getApps()[0] ?? initializeApp({ projectId: 'demo-shark-empti' }));
  const postId = 'reaction-privacy-' + randomUUID(), post = db.doc('posts/' + postId), comment = post.collection('comments').doc('comment');
  const author = { authorId: 'fixture-author', authorName: 'Fixture author', authorPhoto: '', createdAt: Timestamp.now(), likedBy: [], likesCount: 0 };
  const postKey = await forumReactionId({ postId }), commentKey = await forumReactionId({ postId, commentId: 'comment' });
  let uid: string | undefined;
  await post.set({ ...author, title: 'Reaction privacy fixture', content: 'A real subscription fixture.', subject: 'math', commentsCount: 1 });
  await comment.set({ ...author, postId, content: 'Comment reaction fixture.' });
  await publishForumFixture(post); await publishForumFixture(comment);
  try {
    await page.goto('/forum/' + postId);
    const postButton = page.getByRole('button', { name: 'Like post', exact: true });
    const commentButton = page.getByRole('button', { name: 'Like comment', exact: true });
    await expect(postButton).toHaveAttribute('aria-pressed', 'false');
    await expect(commentButton).toHaveAttribute('aria-pressed', 'false');
    const pendingRequest = page.waitForRequest(request => new URL(request.url()).pathname === '/api/forum/' + postId && request.method() === 'PATCH');
    const pendingResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/forum/' + postId && response.request().method() === 'PATCH');
    await postButton.click();
    const [request, response] = await Promise.all([pendingRequest, pendingResponse]);
    expect(response.status()).toBe(200);
    // Decode only the current loopback Emulator token in memory; never log it.
    const claims = JSON.parse(Buffer.from(request.headers().authorization.split('.')[1], 'base64url').toString());
    expect(typeof claims.sub).toBe('string'); uid = claims.sub;
    await expect(postButton).toHaveAttribute('aria-pressed', 'true');
    const ownPost = db.doc('users/' + uid + '/forumReactions/' + postKey), ownComment = db.doc('users/' + uid + '/forumReactions/' + commentKey);
    expect((await ownPost.get()).data()).toMatchObject({ postId, liked: true, privacyVersion: 1 });
    const commentResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/forum/' + postId && response.request().method() === 'PATCH');
    await commentButton.click(); expect((await commentResponse).status()).toBe(200);
    await expect(commentButton).toHaveAttribute('aria-pressed', 'true');
    expect((await ownComment.get()).data()).toMatchObject({ postId, commentId: 'comment', liked: true });
    const unlikeResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/forum/' + postId && response.request().method() === 'PATCH');
    await postButton.click(); expect((await unlikeResponse).status()).toBe(200);
    await expect(postButton).toHaveAttribute('aria-pressed', 'false');
    await expect(commentButton).toHaveAttribute('aria-pressed', 'true');
    expect((await ownPost.get()).exists).toBe(false);
    expect((await ownComment.get()).exists).toBe(true);
    expect((await post.get()).get('likesCount')).toBe(0);
    expect((await comment.get()).get('likesCount')).toBe(1);
  } finally {
    await db.recursiveDelete(post);
    await db.recursiveDelete(db.doc('forumPosts/' + postId));
    if (uid) await Promise.all([postKey, commentKey].map(key => db.doc('users/' + uid + '/forumReactions/' + key).delete()));
  }
});

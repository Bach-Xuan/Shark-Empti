import { assertFails,assertSucceeds,initializeTestEnvironment,RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { type Firestore,disableNetwork,enableNetwork,collection,deleteDoc,deleteField,doc,getDoc,getDocs,query,serverTimestamp,setDoc,updateDoc,where } from 'firebase/firestore';
import fs from 'node:fs';
import { afterAll,afterEach,beforeAll,describe,it,expect } from 'vitest';
import { recordActiveDay } from '@/firebase/firestore/record-active-day';
import { arenaLeaderboardQuery } from '@/lib/arena-leaderboard';

let testEnv: RulesTestEnvironment;
const validPost = () => ({ authorId: 'author', authorName: 'Author', authorPhoto: '', createdAt: serverTimestamp(), title: 'Math', content: 'Valid content', subject: 'math', likesCount: 0, likedBy: [], commentsCount: 0 });

beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Firestore Emulator is required');
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-shark-empti',
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8') },
  });
});
afterEach(async () => testEnv?.clearFirestore());
afterAll(async () => testEnv?.cleanup());

describe('Firestore access policy', () => {
  it('orders all tied Arena scores by duration and ID before limiting, excluding legacy timing', async () => {
    await testEnv.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      for (let i = 0; i < 15; i++) await setDoc(doc(db, 'arenaExams/exam/attempts', `a${String(i).padStart(2, '0')}`), {
        timingVersion: 1, score: 100, duration: 15 - i,
      });
      await setDoc(doc(db, 'arenaExams/exam/attempts/z-tie'), { timingVersion: 1, score: 100, duration: 1 });
      await setDoc(doc(db, 'arenaExams/exam/attempts/legacy'), { score: 100, duration: 0 });
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

  it('allows authenticated authors to create community content and anonymous users to read it', async () => {
    const author = testEnv.authenticatedContext('author').firestore();
    await assertSucceeds(setDoc(doc(author, 'posts', 'post-1'), validPost()));
    await assertSucceeds(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'posts', 'post-1')));
  });

  it('allows a user to toggle only their own like and blocks protected client writes', async () => {
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'posts', 'post-1'), validPost());
      await setDoc(doc(context.firestore(), 'users', 'learner'), { sharkCoins: 10 });
      await setDoc(doc(context.firestore(), 'arenaExams', 'exam-1'), { authorId: 'author', totalAttempts: 0 });
    });
    const learner = testEnv.authenticatedContext('learner').firestore();
    await assertSucceeds(updateDoc(doc(learner, 'posts', 'post-1'), { likedBy: ['learner'], likesCount: 1 }));
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
    await assertSucceeds(setDoc(post, data));
    await assertSucceeds(updateDoc(post, { content: 'Updated content' }));
    await assertFails(updateDoc(post, { content: '' }));
    await assertFails(updateDoc(post, { title: 123 }));
    await assertFails(updateDoc(post, { authorId: 'victim' }));
    await assertFails(updateDoc(post, { commentsCount: 5 }));
    await assertFails(updateDoc(post, { likedBy: ['victim'], likesCount: 1 }));
    await assertFails(updateDoc(post, { likedBy: ['author', 'author'], likesCount: 2 }));
    await assertSucceeds(updateDoc(post, { likedBy: ['author'], likesCount: 1 }));
  });

  it.each(Object.keys(validPost()))('rejects omission of required post field %s on create and update', async key => {
    const ref = doc(testEnv.authenticatedContext('author').firestore(), 'posts', 'post');
    const data: Record<string, unknown> = validPost(); delete data[key];
    await assertFails(setDoc(ref, data));
    await assertSucceeds(setDoc(ref, validPost()));
    await assertFails(updateDoc(ref, { [key]: deleteField() }));
  });

  it('enforces text boundaries and rejects unknown or mistyped fields', async () => {
    const ref = doc(testEnv.authenticatedContext('author').firestore(), 'posts', 'post');
    await assertSucceeds(setDoc(ref, { ...validPost(), title: 'x'.repeat(200), content: 'x'.repeat(20000), subject: 's'.repeat(100), authorName: 'a'.repeat(200) }));
    await assertSucceeds(updateDoc(ref, { content: 'line one\nline two', updatedAt: serverTimestamp() }));
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
    });
    const anonymous = testEnv.unauthenticatedContext().firestore();
    const author = testEnv.authenticatedContext('author').firestore();
    const ref = doc(author, 'posts/post/comments/comment');
    await assertSucceeds(getDocs(collection(anonymous, 'posts/post/comments')));
    await assertSucceeds(updateDoc(ref, { content: 'Edited', updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref, { likedBy: ['author'], likesCount: 1 }));
    await assertFails(updateDoc(ref, { arbitrary: true }));
    await assertFails(updateDoc(ref, { postId: 'other' }));
    await assertFails(updateDoc(ref, { authorName: 'Forged' }));
    await assertFails(getDoc(doc(anonymous, 'posts/orphan/comments/comment')));
    await assertFails(getDocs(collection(anonymous, 'posts/orphan/comments')));
    await testEnv.withSecurityRulesDisabled(context => deleteDoc(doc(context.firestore(), 'posts/post')));
    await assertFails(getDoc(ref));
    await assertFails(getDocs(collection(anonymous, 'posts/post/comments')));
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

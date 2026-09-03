import { afterAll, afterEach, beforeAll, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import fs from 'node:fs';

let testEnv: RulesTestEnvironment;

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
    await assertSucceeds(setDoc(doc(author, 'posts', 'post-1'), { authorId: 'author', title: 'Math', content: 'x', subject: 'math', likesCount: 0, likedBy: [], commentsCount: 0 }));
    await assertSucceeds(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'posts', 'post-1')));
  });

  it('allows a user to toggle only their own like and blocks protected client writes', async () => {
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'posts', 'post-1'), { authorId: 'author', likedBy: [], likesCount: 0 });
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
    const data = { authorId: 'author', title: 'Math', content: 'Valid content', subject: 'math', likesCount: 0, likedBy: [], commentsCount: 0 };
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
});

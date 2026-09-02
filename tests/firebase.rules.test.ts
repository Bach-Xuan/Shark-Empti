import { afterAll, afterEach, beforeAll, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import fs from 'node:fs';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'shark-empti-test',
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8') },
  });
});
afterEach(async () => testEnv?.clearFirestore());
afterAll(async () => testEnv?.cleanup());

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('Firestore access policy', () => {
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
    await assertSucceeds(setDoc(doc(author, 'posts', 'post-1'), { authorId: 'author', title: 'Math', content: 'x', subject: 'math' }));
    await assertSucceeds(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'posts', 'post-1')));
  });
});

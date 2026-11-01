import type { DocumentReference } from 'firebase-admin/firestore';

/** Synthetic fixtures only; production publication is tested through the APIs. */
export async function publishForumFixture(source: DocumentReference) {
  const data = (await source.get()).data()!;
  const { likedBy: _members, ...metadata } = data;
  await source.firestore.doc(source.path.replace(/^posts\//, 'forumPosts/')).set({ ...metadata, privacyVersion: 1 });
}

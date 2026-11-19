import { initializeFirebaseAuth } from './auth-client';
import { initializeClientFirestore } from './firestore-client';

export function initializeFirebase() {
  const { firebaseApp, auth } = initializeFirebaseAuth();
  return { firebaseApp, auth, firestore: initializeClientFirestore(firebaseApp) };
}

export * from './auth/use-user';
export * from './client-provider';
export * from './firestore/use-doc';
export * from './provider';

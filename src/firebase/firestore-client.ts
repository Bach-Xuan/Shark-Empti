import type { FirebaseApp } from 'firebase/app';
import { connectFirestoreEmulator, initializeFirestore, type Firestore } from 'firebase/firestore';
import { firestoreTransportSettings } from './firestore-transport';

export { ensureLearnerProfile } from './profile-bootstrap';

const initialized = new WeakMap<FirebaseApp, Firestore>();

export function initializeClientFirestore(app: FirebaseApp): Firestore {
  const existing = initialized.get(app);
  if (existing) return existing;
  const emulator = process.env.NEXT_PUBLIC_USE_EMULATORS === 'true';
  if (emulator && !app.options.projectId?.startsWith('demo-')) throw new Error('Emulators require a demo project.');
  const db = initializeFirestore(app, firestoreTransportSettings(typeof navigator === 'undefined' ? '' : navigator.userAgent));
  if (emulator) connectFirestoreEmulator(db, '127.0.0.1', 8080);
  initialized.set(app, db);
  return db;
}

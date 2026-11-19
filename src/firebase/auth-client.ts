import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { assertFirebaseConfig, firebaseConfig } from './config';

const initialized = new WeakMap<FirebaseApp, Auth>();

export function initializeFirebaseAuth() {
  assertFirebaseConfig();
  const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  let auth = initialized.get(firebaseApp);
  if (!auth) {
    const emulate = process.env.NEXT_PUBLIC_USE_EMULATORS === 'true';
    if (emulate && !firebaseApp.options.projectId?.startsWith('demo-')) throw new Error('Emulators require a demo project.');
    auth = getAuth(firebaseApp);
    if (emulate) {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    }
    initialized.set(firebaseApp, auth);
  }
  return { firebaseApp, auth };
}

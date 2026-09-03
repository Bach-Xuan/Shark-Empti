
import { FirebaseApp,getApp,getApps,initializeApp } from 'firebase/app';
import { Auth,connectAuthEmulator,getAuth } from 'firebase/auth';
import { Firestore,connectFirestoreEmulator,getFirestore } from 'firebase/firestore';
import { firebaseConfig } from './config';
const emulatorApps = new WeakSet<FirebaseApp>();

export function initializeFirebase(): {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
} {
  const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  const firestore = getFirestore(firebaseApp);
  const auth = getAuth(firebaseApp);
  if (process.env.NEXT_PUBLIC_USE_EMULATORS === 'true' && !emulatorApps.has(firebaseApp)) {
    if (!firebaseConfig.projectId.startsWith('demo-')) throw new Error('Emulators require a demo project.');
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
    emulatorApps.add(firebaseApp);
  }

  return { firebaseApp, firestore, auth };
}

export * from './auth/use-user';
export * from './client-provider';
export * from './firestore/use-doc';
export * from './provider';

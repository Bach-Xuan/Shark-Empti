
import { FirebaseApp,getApp,getApps,initializeApp } from 'firebase/app';
import { Auth,connectAuthEmulator,getAuth } from 'firebase/auth';
import { Firestore,connectFirestoreEmulator,initializeFirestore } from 'firebase/firestore';
import { assertFirebaseConfig, firebaseConfig } from './config';
import { firestoreTransportSettings } from './firestore-transport';
type FirebaseServices = { firebaseApp: FirebaseApp; firestore: Firestore; auth: Auth };
const initializedServices = new WeakMap<FirebaseApp, FirebaseServices>();

export function initializeFirebase(): FirebaseServices {
  assertFirebaseConfig();
  const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  const existing = initializedServices.get(firebaseApp);
  if (existing) return existing;
  const firestore = initializeFirestore(firebaseApp, firestoreTransportSettings(typeof navigator === 'undefined' ? '' : navigator.userAgent));
  const auth = getAuth(firebaseApp);
  if (process.env.NEXT_PUBLIC_USE_EMULATORS === 'true') {
    if (!firebaseConfig.projectId.startsWith('demo-')) throw new Error('Emulators require a demo project.');
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
  }

  const services = { firebaseApp, firestore, auth };
  initializedServices.set(firebaseApp, services);
  return services;
}

export * from './auth/use-user';
export * from './client-provider';
export * from './firestore/use-doc';
export * from './provider';

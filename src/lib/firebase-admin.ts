import 'server-only';

import { cert,getApps,initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export class AdminConfigurationError extends Error {
  constructor() { super('Server configuration is unavailable.'); this.name = 'AdminConfigurationError'; }
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new AdminConfigurationError();
  return value;
}

function getAdminApp() {
  if (process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    const projectId = process.env.GCLOUD_PROJECT || 'demo-shark-empti';
    if (!projectId.startsWith('demo-')) throw new Error('Emulators require a demo project.');
    return getApps()[0] ?? initializeApp({ projectId });
  }
  return getApps()[0] ?? initializeApp({
    credential: cert({
      projectId: required('FIREBASE_ADMIN_PROJECT_ID'),
      clientEmail: required('FIREBASE_ADMIN_CLIENT_EMAIL'),
      privateKey: required('FIREBASE_ADMIN_PRIVATE_KEY').replace(/\\n/g, '\n'),
    }),
  });
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}

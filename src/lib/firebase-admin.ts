import 'server-only';

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is missing.`);
  return value;
}

function getAdminApp() {
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

import 'server-only';

import { cert,getApps,initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { createPrivateKey } from 'node:crypto';

export class AdminConfigurationError extends Error {
  constructor() { super('Server configuration is unavailable.'); this.name = 'AdminConfigurationError'; }
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new AdminConfigurationError();
  return value;
}

/** Non-network preflight; credential values never enter an error message. */
export function validateAdminConfiguration() {
  const projectId = required('FIREBASE_ADMIN_PROJECT_ID');
  const clientEmail = required('FIREBASE_ADMIN_CLIENT_EMAIL');
  const privateKey = required('FIREBASE_ADMIN_PRIVATE_KEY').replace(/\\n/g, '\n');
  const webProject = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  try {
    if (!/^[^@\s]+@[^@\s]+$/.test(clientEmail) || (webProject && webProject !== projectId)
      || createPrivateKey(privateKey).asymmetricKeyType !== 'rsa') throw new AdminConfigurationError();
  } catch { throw new AdminConfigurationError(); }
  return { projectId, clientEmail, privateKey };
}

function getAdminApp() {
  if (process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    const projectId = process.env.GCLOUD_PROJECT || 'demo-shark-empti';
    if (!projectId.startsWith('demo-')) throw new Error('Emulators require a demo project.');
    return getApps()[0] ?? initializeApp({ projectId });
  }
  const existing = getApps()[0];
  if (existing) return existing;
  const configuration = validateAdminConfiguration();
  try { return initializeApp({ projectId: configuration.projectId, credential: cert(configuration) }); }
  catch { throw new AdminConfigurationError(); }
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}

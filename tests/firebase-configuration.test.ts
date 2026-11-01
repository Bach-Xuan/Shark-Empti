// @vitest-environment node
import { generateKeyPairSync } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { assertFirebaseConfig, firebaseConfig } from '@/firebase/config';
import { AdminConfigurationError, validateAdminConfiguration } from '@/lib/firebase-admin';

const web = { apiKey: 'fixture', authDomain: 'fixture.invalid', projectId: 'demo-fixture', storageBucket: 'fixture.invalid', messagingSenderId: '123', appId: 'fixture' };
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
beforeEach(() => {
  vi.stubEnv('FIREBASE_ADMIN_PROJECT_ID', web.projectId);
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', web.projectId);
  vi.stubEnv('FIREBASE_ADMIN_CLIENT_EMAIL', 'fixture@example.invalid');
  vi.stubEnv('FIREBASE_ADMIN_PRIVATE_KEY', privateKey.replace(/\n/g, '\\n'));
});
afterEach(() => vi.unstubAllEnvs());

it.each(Object.keys(web) as Array<keyof typeof firebaseConfig>)('rejects a missing Web field %s before SDK initialization', field => {
  expect(() => assertFirebaseConfig({ ...web, [field]: '  ' })).toThrow('missing required fields: ' + field);
});
it('accepts complete Web values and validates escaped RSA PEM without accessing a provider', () => {
  expect(() => assertFirebaseConfig(web)).not.toThrow();
  expect(validateAdminConfiguration()).toEqual({ projectId: web.projectId, clientEmail: 'fixture@example.invalid', privateKey });
});
it.each(['FIREBASE_ADMIN_PROJECT_ID', 'FIREBASE_ADMIN_CLIENT_EMAIL', 'FIREBASE_ADMIN_PRIVATE_KEY'])('classifies missing %s safely', name => {
  vi.stubEnv(name, '');
  expect(() => validateAdminConfiguration()).toThrow(AdminConfigurationError);
});
it.each([
  ['FIREBASE_ADMIN_PRIVATE_KEY', 'private-invalid-key'],
  ['FIREBASE_ADMIN_CLIENT_EMAIL', 'private-invalid-email'],
  ['NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'different-project'],
])('rejects invalid %s without exposing its value', (name, value) => {
  vi.stubEnv(name, value);
  expect(() => validateAdminConfiguration()).toThrow('Server configuration is unavailable.');
});

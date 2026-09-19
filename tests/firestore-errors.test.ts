import { FirestorePermissionError } from '@/firebase/errors';
import { translatedError } from '@/lib/i18n/errors';
import { expect, it } from 'vitest';

it.each([
  ['firestore/permission-denied', 'FIRESTORE-PERMISSION-DENIED'],
  ['unavailable', 'FIRESTORE-UNAVAILABLE'],
  ['deadline-exceeded', 'FIRESTORE-TIMEOUT'],
  ['unauthenticated', 'AUTH-REQUIRED'],
  ['data-loss', 'APP-DATA-INVALID'],
  ['APP-REQUEST-CONFLICT', 'APP-REQUEST-CONFLICT'],
  ['AUTH-FORBIDDEN', 'AUTH-FORBIDDEN'],
  ['FORUM-NOT-FOUND', 'FORUM-NOT-FOUND'],
  ['unknown-secret-value', 'FIRESTORE-REQUEST-FAILED'],
])('preserves safe classification for %s without retaining raw payloads', (input, code) => {
  const error = new FirestorePermissionError({ path: 'fixture', operation: 'get' }, { code: input, message: 'secret-token', payload: 'private-content' });
  expect(error.code).toBe(code);
  expect(error.cause).toEqual({ code });
  expect(JSON.stringify(error)).not.toMatch(/secret-token|private-content|unknown-secret-value/);
  expect(translatedError(code, 'vi')).not.toBe(translatedError(code, 'en'));
});

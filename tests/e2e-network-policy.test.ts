// @vitest-environment node
import { expect, it } from 'vitest';
import { allowedVerificationRequest as allow } from './e2e/network-policy';
it('allows only configured demo data ports and the public GET script bootstrap', () => {
  expect(allow('http://127.0.0.1:9002/login', 'GET', 'document')).toBe(true);
  expect(allow('http://127.0.0.1:8080/firestore', 'POST', 'fetch')).toBe(true);
  expect(allow('http://localhost:9099/emulator/auth/handler', 'GET', 'document')).toBe(true);
  expect(allow('https://apis.google.com/js/api.js', 'GET', 'script')).toBe(true);
  expect(allow('https://apis.google.com/_/scs/abc-static/_/js/example', 'GET', 'script')).toBe(true);
});
it.each([
  ['https://firestore.googleapis.com/v1/projects/real', 'POST', 'fetch'],
  ['https://identitytoolkit.googleapis.com/v1/accounts:signUp', 'POST', 'fetch'],
  ['https://openrouter.ai/api/v1/chat/completions', 'POST', 'fetch'],
  ['http://127.0.0.1:3000/unrelated-service', 'POST', 'fetch'],
  ['https://apis.google.com/js/api.js', 'POST', 'script'],
  ['https://apis.google.com/js/api.js', 'GET', 'fetch'],
  ['https://apis.google.com/unrelated-api', 'GET', 'script'],
  ['invalid url', 'GET', 'script'],
])('blocks unintended verification traffic: %s', (address, method, type) => expect(allow(address, method, type)).toBe(false));

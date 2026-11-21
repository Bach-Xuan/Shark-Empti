// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, expect, it, vi } from 'vitest';
import { proxy } from '../src/proxy';

afterEach(() => vi.unstubAllEnvs());

function directives() {
  const request = new NextRequest('https://site.example/about');
  const response = proxy(request);
  const policy = response.headers.get('content-security-policy')!;
  return new Map(policy.split('; ').map(directive => {
    const [name, ...sources] = directive.split(' ');
    return [name, sources] as const;
  }));
}

it('restricts production scripts, Firebase connections and the configured Auth frame', () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('NEXT_PUBLIC_USE_EMULATORS', 'false');
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'login.example.org');
  const policy = directives();
  expect(policy.get('default-src')).toEqual(["'self'"]);
  expect(policy.get('script-src')).toEqual(["'self'", expect.stringMatching(/^'nonce-[\w+/]{22}=='$/),
    'https://apis.google.com/js/api.js', 'https://apis.google.com/_/scs/']);
  expect(policy.get('connect-src')).toEqual(["'self'", 'https://identitytoolkit.googleapis.com',
    'https://securetoken.googleapis.com', 'https://firestore.googleapis.com']);
  expect(policy.get('frame-src')).toEqual(["'self'", 'https://login.example.org']);
  expect(policy.get('base-uri')).toEqual(["'self'"]);
  expect(policy.get('frame-ancestors')).toEqual(["'self'"]);
  expect(policy.get('object-src')).toEqual(["'none'"]);
});

it('enables loopback data access only for a configured demo and eval only in development', () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('NEXT_PUBLIC_USE_EMULATORS', 'true');
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'demo-shark-empti');
  const demo = directives();
  expect(demo.get('connect-src')).toEqual(["'self'", 'http://127.0.0.1:9099', 'http://127.0.0.1:8080']);
  expect(demo.get('frame-src')).toEqual(["'self'", 'http://127.0.0.1:9099']);
  expect(demo.get('script-src')).not.toContain("'unsafe-eval'");
  vi.stubEnv('NODE_ENV', 'development');
  expect(directives().get('script-src')).toContain("'unsafe-eval'");
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'live-project');
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'invalid; example.org');
  expect(directives().get('frame-src')).toEqual(["'self'"]);
  expect(directives().get('connect-src')).not.toContain('http://127.0.0.1:8080');
});

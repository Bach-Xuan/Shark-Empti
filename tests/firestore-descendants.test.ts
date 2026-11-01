// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { DocumentReference, Firestore } from 'firebase-admin/firestore';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ db: { databaseId: '(default)' }, auth: { app: { options: { projectId: 'demo-shark-empti' } } } }));
vi.mock('@/lib/firebase-admin', () => ({ getAdminDb: () => mocks.db, getAdminAuth: () => mocks.auth, AdminConfigurationError: class extends Error {} }));
import { readDescendantPage } from '@/lib/firestore-descendants';
const db = mocks.db as unknown as Firestore, root = { path: 'posts/post', firestore: mocks.db } as unknown as DocumentReference;
const prefix = 'projects/demo-shark-empti/databases/(default)/documents/';
beforeEach(() => { vi.stubEnv('FIRESTORE_EMULATOR_HOST', '127.0.0.1:8080'); vi.stubEnv('FIREBASE_AUTH_EMULATOR_HOST', '127.0.0.1:9099'); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); mocks.db.databaseId = '(default)'; });

it('issues bounded name-only descendant queries including missing-parent paths and long legacy IDs', async () => {
  const paths = ['posts/post/comments/missing/nested/child', 'posts/post/legacy/' + 'x'.repeat(300)];
  const fetcher = vi.fn().mockResolvedValue(Response.json(paths.map(path => ({ document: { name: prefix + path } }))));
  vi.stubGlobal('fetch', fetcher);
  expect(await readDescendantPage(db, root)).toEqual(paths);
  expect(fetcher.mock.calls[0][0]).toBe('http://127.0.0.1:8080/v1/projects/demo-shark-empti/databases/(default)/documents/posts/post:runQuery');
  const options = fetcher.mock.calls[0][1];
  expect(options.redirect).toBe('error');
  expect(JSON.parse(options.body).structuredQuery).toEqual({ from: [{ allDescendants: true }], select: { fields: [{ fieldPath: '__name__' }] },
    orderBy: [{ field: { fieldPath: '__name__' }, direction: 'ASCENDING' }], limit: 100 });
});
it.each(['posts/other/comments/private', 'users/owner/history/private', 'posts/post/comments', 'posts/post/comments/../nested/child'])('rejects out-of-scope or invalid resource paths before deletion planning: %s', async path => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json([{ document: { name: prefix + path } }])));
  await expect(readDescendantPage(db, root)).rejects.toMatchObject({ code: 'APP-DATA-INVALID', status: 502 });
});
it('rejects duplicate and oversized result pages while allowing empty-query metadata', async () => {
  const entry = { document: { name: prefix + 'posts/post/comments/one' } };
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json([entry, entry])).mockResolvedValueOnce(Response.json([entry, { document: { name: prefix + 'posts/post/comments/two' } }]))
    .mockResolvedValueOnce(Response.json([{ readTime: 'metadata' }]));
  vi.stubGlobal('fetch', fetcher);
  await expect(readDescendantPage(db, root)).rejects.toMatchObject({ code: 'APP-DATA-INVALID' });
  await expect(readDescendantPage(db, root, 1)).rejects.toMatchObject({ code: 'APP-DATA-INVALID' });
  expect(await readDescendantPage(db, root)).toEqual([]);
});
it('fails closed for unsupported database/configuration without making a request', async () => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  mocks.db.databaseId = 'another';
  await expect(readDescendantPage(db, root)).rejects.toMatchObject({ code: 'APP-CONFIG-MISSING' });
  mocks.db.databaseId = '(default)'; vi.stubEnv('FIRESTORE_EMULATOR_HOST', 'external.invalid:8080');
  await expect(readDescendantPage(db, root)).rejects.toMatchObject({ code: 'APP-CONFIG-MISSING' });
  expect(fetcher).not.toHaveBeenCalled();
});
it('classifies malformed upstream JSON and upstream failure without forwarding response data', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response('Private upstream response')).mockResolvedValueOnce(new Response('Private', { status: 503 }));
  vi.stubGlobal('fetch', fetcher);
  for (let i = 0; i < 2; i++) await expect(readDescendantPage(db, root)).rejects.toMatchObject({ code: 'APP-UNAVAILABLE', status: 503 });
});

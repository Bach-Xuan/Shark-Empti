// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ stored: null as Record<string, unknown> | null, db: vi.fn() }));
vi.mock('@/lib/firebase-admin', () => ({ getAdminDb: mocks.db, getAdminAuth: vi.fn(), AdminConfigurationError: class extends Error {} }));
import { idempotentTransaction } from '@/lib/server-api';
import { currentServicePolicy } from '@/lib/service-policy';
beforeEach(() => {
 mocks.stored = null;
 mocks.db.mockReturnValue({ collection: (name: string) => ({ doc: () => name }), runTransaction: (run: (transaction: unknown) => unknown) => run({
  get: async (name: string) => {
   const data: Record<string, unknown> | null = name === '_serviceConsents' ? { ...currentServicePolicy, acceptedAt: Timestamp.fromMillis(1) } : name === '_requestReceipts' ? mocks.stored : null;
   return { exists: !!data, data: () => data, get: (key: string) => data?.[key] };
  },
  create: (_ref: unknown, data: Record<string, unknown>) => { mocks.stored = data; },
 }) });
});

it('preserves legacy receipt replay and rejects a changed payload without migrating unknown hashes', async () => {
 const payload = { answer: 4, options: [1, 2] };
 const operation = vi.fn();
 mocks.stored = { fingerprint: createHash('sha256').update(JSON.stringify(payload)).digest('hex'), result: { score: 100 } };
 await expect(idempotentTransaction('exam', 'user', 'request', payload, operation)).resolves.toEqual({ score: 100 });
 await expect(idempotentTransaction('exam', 'user', 'request', { ...payload, answer: 5 }, operation)).rejects.toMatchObject({ code: 'APP-REQUEST-CONFLICT' });
 expect(operation).not.toHaveBeenCalled();
});
it('replays retained receipts before and after nominal expiry; deletion ends replay', async () => {
 const operation = vi.fn().mockResolvedValue({ score: 100 });
 await idempotentTransaction('exam','user','request',{ answer: 4 },operation);
 expect(mocks.stored?.expiresAt).toBeInstanceOf(Date);
 await idempotentTransaction('exam','user','request',{ answer: 4 },operation);
 mocks.stored!.expiresAt = new Date(0);
 await idempotentTransaction('exam','user','request',{ answer: 4 },operation);
 expect(operation).toHaveBeenCalledTimes(1);
 await expect(idempotentTransaction('exam','user','request',{ answer: 5 },operation)).rejects.toMatchObject({ code: 'APP-REQUEST-CONFLICT' });
 mocks.stored = null; // Firestore TTL eventually removed the receipt.
 await idempotentTransaction('exam','user','request',{ answer: 4 },operation);
 expect(operation).toHaveBeenCalledTimes(2);
});

it('replays equivalent nested objects regardless of key order without repeating the operation', async () => {
 const operation = vi.fn().mockResolvedValue({ ok: true });
 await idempotentTransaction('forum', 'user', 'request', { mutation: { content: 'Same', action: 'edit' }, items: [1, 2] }, operation);
 await expect(idempotentTransaction('forum', 'user', 'request', { items: [1, 2], mutation: { action: 'edit', content: 'Same' } }, operation)).resolves.toEqual({ ok: true });
 expect(operation).toHaveBeenCalledOnce();
 await expect(idempotentTransaction('forum', 'user', 'request', { items: [2, 1], mutation: { action: 'edit', content: 'Same' } }, operation)).rejects.toMatchObject({ code: 'APP-REQUEST-CONFLICT' });
});

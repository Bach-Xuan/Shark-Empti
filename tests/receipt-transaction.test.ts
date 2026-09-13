// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ stored: null as Record<string, unknown> | null, db: vi.fn() }));
vi.mock('@/lib/firebase-admin', () => ({ getAdminDb: mocks.db, getAdminAuth: vi.fn(), AdminConfigurationError: class extends Error {} }));
import { idempotentTransaction } from '@/lib/server-api';
beforeEach(() => {
 mocks.stored = null;
 mocks.db.mockReturnValue({ collection: () => ({ doc: () => 'receipt' }), runTransaction: (run: (transaction: unknown) => unknown) => run({
  get: async () => ({ exists: !!mocks.stored, get: (key: string) => mocks.stored?.[key] }),
  create: (_ref: unknown, data: Record<string, unknown>) => { mocks.stored = data; },
 }) });
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

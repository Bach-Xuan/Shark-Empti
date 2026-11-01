import { afterEach, expect, it, vi } from 'vitest';
const request = vi.hoisted(() => vi.fn());
vi.mock('@/lib/forum-client', () => ({ communityRequest: request }));
import { readAccountStatus, readReceiptStatus } from '@/lib/account-status-client';
const user = { getIdToken: vi.fn() }, receipt = { id: 'ed259772-c4b5-4dbb-9787-4311d5a4a736', receipt: 'a'.repeat(43) };
const minimal = { id: receipt.id, kind: 'deletion', status: 'completed', expiresAtMs: 9_000_000_000_000 };
afterEach(() => { vi.resetAllMocks(); vi.unstubAllGlobals(); });

it('falls back to minimal receipt access after Auth denial without sending the receipt in a URL', async () => {
  request.mockRejectedValue({ code: 'AUTH-INVALID', status: 401 });
  const fetcher = vi.fn().mockResolvedValue(Response.json({ ...minimal, privateField: 'Never exposed' }));
  vi.stubGlobal('fetch', fetcher);
  const signal = new AbortController().signal;
  expect(await readAccountStatus(user, receipt, signal)).toEqual({ enabled: false, receiptOnly: true, jobs: [{ ...minimal, parts: 0, processed: 0 }] });
  expect(fetcher).toHaveBeenCalledWith('/api/account/jobs/' + receipt.id, { headers: { 'X-Deletion-Receipt': receipt.receipt }, signal });
  expect(request.mock.calls[0].slice(1, 4)).toEqual(['/api/account/jobs', undefined, 'GET']);
});
it('does not use receipt access to bypass a transient owner traffic rejection', async () => {
  request.mockRejectedValue({ code: 'APP-RATE-LIMITED', status: 429 });
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  await expect(readAccountStatus(user, receipt, new AbortController().signal)).rejects.toMatchObject({ status: 429 });
  expect(fetcher).not.toHaveBeenCalled();
});
it.each(['auth/user-disabled', 'auth/user-token-expired'])('retains receipt access after Firebase rejects the local token with %s', async code => {
  request.mockRejectedValue({ code });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(minimal)));
  expect(await readAccountStatus(user, receipt, new AbortController().signal)).toMatchObject({ receiptOnly: true, jobs: [minimal] });
});
it('retains the owner list when an old receipt is unavailable but propagates transient receipt failures', async () => {
  request.mockResolvedValue({ enabled: true, jobs: [] });
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(null, { status: 404 })).mockResolvedValueOnce(new Response(null, { status: 503 }));
  vi.stubGlobal('fetch', fetcher);
  expect(await readAccountStatus(user, receipt, new AbortController().signal)).toEqual({ enabled: true, jobs: [], receiptOnly: false });
  await expect(readAccountStatus(user, receipt, new AbortController().signal)).rejects.toMatchObject({ status: 503 });
});
it('rejects mismatched receipt identities and malformed status data', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ ...minimal, id: crypto.randomUUID() })).mockResolvedValueOnce(Response.json({ status: 'completed' }));
  vi.stubGlobal('fetch', fetcher);
  for (let i = 0; i < 2; i++) await expect(readReceiptStatus(receipt, new AbortController().signal)).rejects.toMatchObject({ code: 'APP-DATA-INVALID' });
  request.mockResolvedValue({ enabled: true, jobs: [{ ...minimal, parts: -1 }] });
  await expect(readAccountStatus(user, null, new AbortController().signal)).rejects.toMatchObject({ code: 'APP-DATA-INVALID' });
});

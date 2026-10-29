// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { communityRequest } from '@/lib/forum-client';
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it('bounds a stalled token phase and never dispatches a late authenticated write', async () => {
  vi.useFakeTimers(); const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  const pending = communityRequest({ getIdToken: () => new Promise(() => {}) }, '/api/forum', {});
  const assertion = expect(pending).rejects.toMatchObject({ code: 'APP-UNAVAILABLE' });
  await vi.advanceTimersByTimeAsync(30_001); await assertion;
  expect(fetch).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
});
it('rejects malformed success and preserves safe server classifications without raw transport details', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response('not JSON')).mockResolvedValueOnce(new Response(JSON.stringify({ code: 'APP-RATE-LIMITED', error: 'private SDK details' }), { status: 429 }));
  vi.stubGlobal('fetch', fetch);
  const user = { getIdToken: async () => 'test' };
  await expect(communityRequest(user, '/api/forum', {})).rejects.toMatchObject({ code: 'APP-DATA-INVALID' });
  await expect(communityRequest(user, '/api/forum', {})).rejects.toMatchObject({ code: 'APP-RATE-LIMITED' });
});
it('does not begin work for an already-revoked component scope', async () => {
  const controller = new AbortController(); controller.abort();
  const user = { getIdToken: vi.fn() }; const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  await expect(communityRequest(user, '/api/forum', {}, 'POST', controller.signal)).rejects.toMatchObject({ code: 'APP-UNAVAILABLE' });
  expect(user.getIdToken).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
});

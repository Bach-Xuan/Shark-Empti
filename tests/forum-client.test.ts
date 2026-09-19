import { afterEach, expect, it, vi } from 'vitest';
import { deleteForumPost } from '@/lib/forum-client';
afterEach(() => vi.unstubAllGlobals());
it('retains a safe server error code but never forwards its message or values', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ code: 'AUTH-FORBIDDEN', error: 'secret', values: { token: 'private' } }) });
  vi.stubGlobal('fetch', fetchMock);
  await expect(deleteForumPost({ getIdToken: async () => 'token' }, 'post/id')).rejects.toEqual({ code: 'AUTH-FORBIDDEN', message: 'Could not delete post. Retry to resume deletion.', values: {} });
  expect(fetchMock).toHaveBeenCalledWith('/api/forum/post%2Fid', { method: 'DELETE', headers: { Authorization: 'Bearer token' } });
});
it('falls back safely for non-JSON and untrusted codes', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ code: 'raw/private' }) }));
  await expect(deleteForumPost({ getIdToken: async () => 'token' }, 'post')).rejects.toMatchObject({ code: 'APP-REQUEST-FAILED' });
});

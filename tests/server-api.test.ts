// @vitest-environment node
import { AdminConfigurationError } from '@/lib/firebase-admin';
import { apiFailure,authenticatedUser } from '@/lib/server-api';
import { afterEach,expect,it,vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock('@/lib/firebase-admin', () => ({
  AdminConfigurationError: class extends Error {},
  getAdminAuth: mocks.auth, getAdminDb: vi.fn(),
}));
afterEach(() => vi.clearAllMocks());
it('rejects missing tokens before touching Admin configuration', async () => {
  await expect(authenticatedUser(new Request('http://localhost'))).rejects.toMatchObject({ code: 'AUTH-REQUIRED', status: 401 });
  expect(mocks.auth).not.toHaveBeenCalled();
});
it('maps an expired Admin token rejection to the safe invalid-or-expired contract', async () => {
  const verifyIdToken = vi.fn().mockRejectedValue({ code: 'auth/id-token-expired' });
  mocks.auth.mockReturnValueOnce({ verifyIdToken });
  const request = new Request('http://localhost', { headers: { Authorization: 'Bearer expired-token' } });
  await expect(authenticatedUser(request)).rejects.toMatchObject({ code: 'AUTH-INVALID', status: 401, message: 'Authentication is invalid or expired.' });
  expect(verifyIdToken).toHaveBeenCalledWith('expired-token', true);
});
it.each(['auth/id-token-revoked', 'auth/user-disabled', 'auth/user-not-found', 'auth/invalid-id-token'])('rejects %s consistently before database work', async code => {
  const verifyIdToken = vi.fn().mockRejectedValue({ code, message: 'private auth diagnostic' });
  mocks.auth.mockReturnValueOnce({ verifyIdToken });
  await expect(authenticatedUser(new Request('http://localhost', { headers: { Authorization: 'Bearer old-token' } })))
    .rejects.toMatchObject({ code: 'AUTH-INVALID', status: 401, message: 'Authentication is invalid or expired.' });
  expect(verifyIdToken).toHaveBeenCalledWith('old-token', true);
});
it.each(['Bearer ', 'Bearer extra token', 'Bearer ' + 'x'.repeat(8193)])('rejects malformed bearer credentials before initializing Admin', async authorization => {
  await expect(authenticatedUser(new Request('http://localhost', { headers: { Authorization: authorization } }))).rejects.toMatchObject({ status: 401 });
  expect(mocks.auth).not.toHaveBeenCalled();
});
it('distinguishes an Auth infrastructure failure from a rejected session without leaking diagnostics', async () => {
  mocks.auth.mockReturnValueOnce({ verifyIdToken: vi.fn().mockRejectedValue({ code: 'auth/internal-error', message: 'private backend credential' }) });
  await expect(authenticatedUser(new Request('http://localhost', { headers: { Authorization: 'Bearer token' } })))
    .rejects.toMatchObject({ code: 'APP-UNAVAILABLE', status: 503, message: 'Authentication is temporarily unavailable.' });
});
it('returns a safe configuration error and never leaks diagnostic secrets', async () => {
  const log = vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    const response = apiFailure(new AdminConfigurationError());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Server configuration is unavailable.', code: 'APP-CONFIG-MISSING', values: {} });
    const id = response.headers.get('X-Request-ID');
    expect(id).toMatch(/^[a-f0-9-]{36}$/);
    expect(JSON.parse(log.mock.calls[0][0])).toEqual({ event: 'api-failure', incident: id, status: 503, category: 'configuration' });
    const unknown = apiFailure(new Error('private token fixture'));
    expect(JSON.stringify(await unknown.json())).not.toContain('private token');
    expect(unknown.headers.get('X-Request-ID')).not.toBe(id);
    expect(JSON.stringify(log.mock.calls)).not.toContain('private token');
  } finally { log.mockRestore(); }
});

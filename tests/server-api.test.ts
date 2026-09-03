// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock('@/lib/firebase-admin', () => ({
  AdminConfigurationError: class extends Error {},
  getAdminAuth: mocks.auth, getAdminDb: vi.fn(),
}));
import { AdminConfigurationError } from '@/lib/firebase-admin';
import { apiFailure, authenticatedUser } from '@/lib/server-api';
afterEach(() => vi.clearAllMocks());
it('rejects missing tokens before touching Admin configuration', async () => {
  await expect(authenticatedUser(new Request('http://localhost'))).rejects.toMatchObject({ code: 'AUTH-REQUIRED', status: 401 });
  expect(mocks.auth).not.toHaveBeenCalled();
});
it('returns a safe configuration error and never leaks diagnostic secrets', async () => {
  const response = apiFailure(new AdminConfigurationError());
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: 'Server configuration is unavailable.', code: 'APP-CONFIG-MISSING', values: {} });
  expect(JSON.stringify(await apiFailure(new Error('private token fixture')).json())).not.toContain('private token');
});

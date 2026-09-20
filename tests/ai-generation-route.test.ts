// @vitest-environment node
import { POST } from '@/app/api/ai/generations/route';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({ auth: vi.fn(), create: vi.fn() }));
vi.mock('@/lib/server-api', () => {
  class ApiError extends Error {
    constructor(public code: string, public status: number, message: string) { super(message); }
  }
  return {
    ApiError,
    authenticatedUser: mocks.auth,
    apiFailure: (error: unknown) => {
      const known = error as { code?: string; status?: number; message?: string };
      return Response.json({ error: known.message ?? 'failed', code: known.code ?? 'APP-REQUEST-FAILED', values: {} }, { status: known.status ?? 500 });
    },
  };
});
vi.mock('@/ai/generation-store', () => ({ createGeneration: mocks.create }));

beforeEach(() => {
  vi.stubEnv('AI_GENERATION_PROTOCOL_ENABLED', 'true');
  mocks.auth.mockResolvedValue('user-1');
  mocks.create.mockResolvedValue({ generationId: '11111111-1111-4111-8111-111111111111', state: 'ready' });
});
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });

it('authenticates before reading the request body', async () => {
  mocks.auth.mockRejectedValueOnce(Object.assign(new Error('Authentication is required.'), { code: 'AUTH-REQUIRED', status: 401 }));
  const request = new Request('http://localhost/api/ai/generations', { method: 'POST', body: '{}' });
  const bodyRead = vi.spyOn(request.body!, 'getReader');
  const response = await POST(request);
  expect(response.status).toBe(401);
  expect(bodyRead).not.toHaveBeenCalled();
  expect(mocks.create).not.toHaveBeenCalled();
});

it('rejects an excessive Content-Length before reading bytes or creating a ledger record', async () => {
  const request = new Request('http://localhost/api/ai/generations', { method: 'POST', headers: { 'Content-Length': '140001' }, body: '{}' });
  const bodyRead = vi.spyOn(request.body!, 'getReader');
  const response = await POST(request);
  expect(response.status).toBe(413);
  expect(bodyRead).not.toHaveBeenCalled();
  expect(mocks.create).not.toHaveBeenCalled();
});

it('validates a known operation and creates an owner-bound generation', async () => {
  const generationId = '11111111-1111-4111-8111-111111111111';
  const request = new Request('http://localhost/api/ai/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ generationId, operation: 'academic-validation', input: { topic: 'Algebra', language: 'en' } }),
  });
  const response = await POST(request);
  expect(response.status).toBe(200);
  expect(mocks.create).toHaveBeenCalledWith(generationId, 'user-1', 'academic-validation', { topic: 'Algebra', language: 'en' });
});

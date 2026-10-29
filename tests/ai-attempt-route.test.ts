// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi, type MockInstance } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/lib/request-budget', () => ({ enforceRequestBudget: vi.fn() }));
const mocks = vi.hoisted(() => ({ claim: vi.fn(), finalize: vi.fn(), provider: vi.fn() }));
vi.mock('@/lib/server-api', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/server-api')>(), authenticatedUser: vi.fn(async () => 'owner'),
}));
vi.mock('@/ai/generation-store', () => ({ claimGeneration: mocks.claim, finalizeGeneration: mocks.finalize }));
vi.mock('@/ai/openrouter', () => ({ requestStructuredOnce: mocks.provider }));
import { POST } from '@/app/api/ai/generations/[generationId]/attempt/route';
import { ApiError } from '@/lib/server-api';

const generationId = '11111111-1111-4111-8111-111111111111';
const run = () => POST(new Request('http://localhost/api/ai/generations/id/attempt'), { params: Promise.resolve({ generationId }) });
let events: MockInstance<typeof console.info>;
beforeEach(() => {
  events = vi.spyOn(console, 'info').mockImplementation(() => {});
  mocks.claim.mockResolvedValue({ kind: 'claimed', record: { operation: 'academic-validation', validatedInput: { topic: 'Algebra', language: 'en' } }, attempt: 0, leaseId: 'private-lease' });
  mocks.provider.mockResolvedValue({ ok: true, data: { isAcademic: true, reason: 'private provider output' } });
  mocks.finalize.mockResolvedValue({ generationId, state: 'succeeded', data: { isAcademic: true } });
});
afterEach(() => { vi.restoreAllMocks(); vi.resetAllMocks(); });
const stages = () => events.mock.calls.map(call => JSON.parse(String(call[0])).stage);

it('correlates successful claim, dispatch and persistence without logging inputs or outputs', async () => {
  expect((await run()).status).toBe(200);
  expect(stages()).toEqual(['claim_started', 'claim_accepted', 'provider_dispatch', 'finalize_started', 'finalize_succeeded']);
  const logged = JSON.stringify(events.mock.calls);
  for (const privateValue of [generationId, 'owner', 'private-lease', 'Algebra', 'private provider output']) expect(logged).not.toContain(privateValue);
  expect(new Set(events.mock.calls.map(call => JSON.parse(String(call[0])).correlationId)).size).toBe(1);
});

it.each(['claim', 'finalize'] as const)('classifies a %s Firestore outage separately from provider failure', async stage => {
  mocks[stage].mockRejectedValueOnce(Object.assign(new Error('private Firestore payload'), { code: 14 }));
  const response = await run();
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({ code: 'AI-PERSISTENCE-UNAVAILABLE' });
  expect(stages().at(-1)).toBe(`${stage}_failed`);
  expect(JSON.stringify(events.mock.calls)).not.toContain('private Firestore payload');
  if (stage === 'claim') expect(mocks.provider).not.toHaveBeenCalled();
  else expect(mocks.provider).toHaveBeenCalledOnce();
  expect(stages()).not.toContain('finalize_succeeded');
});

it('reports a stale lease as a recoverable state conflict, not generic HTTP 500', async () => {
  mocks.finalize.mockRejectedValueOnce(new ApiError('AI-LEASE-CONFLICT', 409, 'Refresh status.'));
  const response = await run();
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ code: 'AI-LEASE-CONFLICT' });
  expect(stages().at(-1)).toBe('finalize_failed');
});

it('keeps the unexpected-error boundary and records its last failed stage without raw details', async () => {
  mocks.provider.mockRejectedValueOnce(new Error('sk-sensitive-key private raw output'));
  const response = await run();
  expect(response.status).toBe(500);
  expect(await response.json()).toMatchObject({ code: 'APP-REQUEST-FAILED' });
  expect(stages().at(-1)).toBe('provider_failed');
  expect(JSON.stringify(events.mock.calls)).not.toContain('sensitive');
});

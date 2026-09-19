// @vitest-environment jsdom
import { runAiOperation } from '@/ai/client';
import { afterEach,expect,it,vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getIdToken: vi.fn(async (_forceRefresh?: boolean) => 'token') }));
vi.mock('@/firebase', () => ({ initializeFirebase: () => ({ auth: { currentUser: { getIdToken: mocks.getIdToken } } }) }));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); mocks.getIdToken.mockClear(); });

it('recovers authoritative status before any retry after an attempt response is lost', async () => {
  let generationId = '';
  const fetchMock = vi.fn(async (path: string, options: RequestInit) => {
    if (path === '/api/ai/generations') {
      generationId = JSON.parse(String(options.body)).generationId;
      return new Response(JSON.stringify({ generationId, state: 'ready' }));
    }
    if (path.endsWith('/attempt')) throw new TypeError('response lost');
    return new Response(JSON.stringify({ generationId, state: 'succeeded', data: { isValid: true } }));
  });
  vi.stubGlobal('fetch', fetchMock);
  await expect(runAiOperation('academic-validation', { topic: 'Algebra', language: 'en' })).resolves.toEqual({ ok: true, data: { isValid: true } });
  expect(fetchMock.mock.calls.filter(([path]) => String(path).endsWith('/attempt'))).toHaveLength(1);
  expect(fetchMock.mock.calls.at(-1)?.[0]).toBe(`/api/ai/generations/${generationId}`);
});

it('refreshes an invalid Firebase token once without changing the generation identifier', async () => {
  const ids: string[] = [];
  const fetchMock = vi.fn(async (_path: string, options: RequestInit) => {
    ids.push(JSON.parse(String(options.body)).generationId);
    if (ids.length === 1) return new Response(JSON.stringify({ code: 'AUTH-INVALID', error: 'expired' }), { status: 401 });
    return new Response(JSON.stringify({ generationId: ids[0], state: 'failed', error: { code: 'AI-CONFIG-MISSING', message: 'Unavailable.', values: {} } }), { status: 422 });
  });
  vi.stubGlobal('fetch', fetchMock);
  await runAiOperation('academic-validation', { topic: 'Algebra', language: 'en' });
  expect(mocks.getIdToken.mock.calls.map(call => call[0])).toEqual([false, true]);
  expect(new Set(ids).size).toBe(1);
});

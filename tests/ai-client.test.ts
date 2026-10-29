// @vitest-environment jsdom
import { runAiOperation } from '@/ai/client';
import { afterEach,expect,it,vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getIdToken: vi.fn(async (_forceRefresh?: boolean) => 'token') }));
vi.mock('@/firebase', () => ({ initializeFirebase: () => ({ auth: { currentUser: { getIdToken: mocks.getIdToken } } }) }));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); mocks.getIdToken.mockReset().mockResolvedValue('token'); });

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

it.each([401, 403, 429])('surfaces a permanent HTTP %s rejection without polling or retrying the claim', async status => {
  let id = '';
  const fetchMock = vi.fn(async (path: string, options: RequestInit) => {
    if (path === '/api/ai/generations') {
      id = JSON.parse(String(options.body)).generationId;
      return Response.json({ generationId: id, state: 'ready' });
    }
    return Response.json({ code: 'AI-QUOTA-EXCEEDED', error: 'Temporarily exhausted.' }, { status });
  });
  vi.stubGlobal('fetch', fetchMock);
  expect(await runAiOperation('academic-validation', {})).toMatchObject({ ok: false, error: { code: 'AI-QUOTA-EXCEEDED' } });
  expect(fetchMock.mock.calls.map(([path]) => path)).toEqual(['/api/ai/generations', `/api/ai/generations/${id}/attempt`]);
});

it('retries lost creation with exactly the same UUID and input', async () => {
  const bodies: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (_path: string, options: RequestInit) => {
    bodies.push(String(options.body));
    if (bodies.length === 1) throw new TypeError('response lost after commit');
    return Response.json({ generationId: JSON.parse(bodies[0]).generationId, state: 'succeeded', data: { isAcademic: true } });
  }));
  expect(await runAiOperation('academic-validation', { topic: 'Algebra' })).toEqual({ ok: true, data: { isAcademic: true } });
  expect(bodies).toHaveLength(2);
  expect(bodies[1]).toBe(bodies[0]);
});

it('does not turn a failed persistence/claim HTTP response into another immediate attempt', async () => {
  let id = '';
  const fetchMock = vi.fn(async (path: string, options: RequestInit) => {
    if (path === '/api/ai/generations') {
      id = JSON.parse(String(options.body)).generationId;
      return Response.json({ generationId: id, state: 'ready' });
    }
    if (path.endsWith('/attempt')) return Response.json({ code: 'AI-PERSISTENCE-UNAVAILABLE', error: 'Try later.' }, { status: 503 });
    return Response.json({ generationId: id, state: 'ready' });
  });
  vi.stubGlobal('fetch', fetchMock);
  expect(await runAiOperation('academic-validation', {})).toMatchObject({ ok: false, error: { code: 'AI-PERSISTENCE-UNAVAILABLE' } });
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

it('does not create or cancel a generation when the caller is already aborted', async () => {
  const controller = new AbortController();
  controller.abort();
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  expect(await runAiOperation('academic-validation', {}, { signal: controller.signal })).toMatchObject({ ok: false, error: { code: 'AI-CANCELLED' } });
  expect(fetchMock).not.toHaveBeenCalled();
});

it('bounds polling and best-effort cancellation when a running lease never settles', async () => {
  vi.useFakeTimers();
  let id = '';
  const fetchMock = vi.fn(async (_path: string, options: RequestInit) => {
    if (options.method === 'POST') id ||= JSON.parse(String(options.body)).generationId;
    return Response.json({ generationId: id, state: options.method === 'DELETE' ? 'cancelled' : 'running' });
  });
  vi.stubGlobal('fetch', fetchMock);
  const result = runAiOperation('academic-validation', {});
  await vi.advanceTimersByTimeAsync(120_001);
  expect(await result).toMatchObject({ ok: false, error: { code: 'AI-RECOVERY-TIMEOUT' } });
  expect(fetchMock.mock.calls.filter(([, options]) => options.method === 'DELETE')).toHaveLength(1);
  expect(fetchMock.mock.calls.length).toBeLessThan(125);
  expect(vi.getTimerCount()).toBe(0);
});

it('rejects a malformed protocol response rather than entering an unbounded loop', async () => {
  const fetchMock = vi.fn(async () => Response.json({ state: 'unknown' }));
  vi.stubGlobal('fetch', fetchMock);
  expect(await runAiOperation('academic-validation', {})).toMatchObject({ ok: false, error: { code: 'APP-INVALID-RESPONSE' } });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

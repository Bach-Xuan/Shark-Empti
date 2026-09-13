// @vitest-environment node
import { generateStructured,resetOpenRouterModelPreferenceForTest,warmOpenRouterModels } from '@/ai/openrouter';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { z } from 'zod';
vi.mock('server-only', () => ({}));

const schema = z.object({ answer: z.string() });
const request = () => generateStructured({ operation: 'test-request', system: 'Teach clearly.', prompt: 'Question', schema });
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const success = (answer = '42') => response({ choices: [{ message: { content: JSON.stringify({ answer }) } }] });

beforeEach(() => { vi.stubEnv('OPENROUTER_API_KEY', 'test-only'); resetOpenRouterModelPreferenceForTest(); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('OpenRouter structured response contract', () => {
  it('uses local JSON validation for Inkling and native JSON Schema only when Gemma is selected', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ error: { code: 502 } }, 502))
      .mockResolvedValueOnce(success());
    vi.stubGlobal('fetch', fetchMock);

    expect(await request()).toEqual({ answer: '42' });
    const first = JSON.parse(fetchMock.mock.calls[0][1].body);
    const second = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(first.model).toBe('thinkingmachines/inkling:free');
    expect(first.response_format).toBeUndefined();
    expect(second.model).toBe('google/gemma-4-31b-it:free');
    expect(second.response_format.type).toBe('json_schema');
  });

  it('falls through a model-specific HTTP 400 instead of exposing it as a generic client error', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ error: { code: 400 } }, 400))
      .mockResolvedValueOnce(success());
    vi.stubGlobal('fetch', fetchMock);

    expect(await request()).toEqual({ answer: '42' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('falls through a model-specific HTTP 403 because a free model can reject a valid key', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ error: { code: 403 } }, 403))
      .mockResolvedValueOnce(success());
    vi.stubGlobal('fetch', fetchMock);

    expect(await request()).toEqual({ answer: '42' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not multiply requests for unavailable credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ error: { code: 401 } }, 401));
    vi.stubGlobal('fetch', fetchMock);

    await expect(request()).rejects.toMatchObject({ appError: { code: 'AI-PROVIDER-401' } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('moves immediately to Nemotron after a cancellation, then resumes the priority order', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new DOMException('fixture', 'AbortError'))
      .mockResolvedValueOnce(success());
    vi.stubGlobal('fetch', fetchMock);

    expect(await request()).toEqual({ answer: '42' });
    const models = fetchMock.mock.calls.map(([, options]) => JSON.parse(options.body).model);
    expect(models).toEqual(['thinkingmachines/inkling:free', 'nvidia/nemotron-3.5-lightning:free']);
  });

  it('performs only one bounded cancellation rollover before returning aggregate diagnostics', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new DOMException('fixture', 'AbortError'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(request()).rejects.toMatchObject({ appError: {
      code: 'AI-FALLBACK-EXHAUSTED',
      values: { attemptedModels: 5, lastFailure: 'AI-TRANSPORT' },
    } });
    expect(fetchMock.mock.calls.map(([, options]) => JSON.parse(options.body).model)).toEqual([
      'thinkingmachines/inkling:free',
      'nvidia/nemotron-3.5-lightning:free',
      'thinkingmachines/inkling:free',
      'google/gemma-4-31b-it:free',
      'nvidia/nemotron-3.5-lightning:free',
    ]);
  });

  it('accepts a JSON code fence from a model without native structured output', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ choices: [{ message: { content: '```json\n{"answer":"42"}\n```' } }] }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await request()).toEqual({ answer: '42' });
  });

  it('returns safe aggregate metadata when every candidate returns invalid output', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ choices: [] }))
      .mockResolvedValueOnce(response({ choices: [] }))
      .mockResolvedValueOnce(response({ choices: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(request()).rejects.toMatchObject({ appError: {
      code: 'AI-FALLBACK-EXHAUSTED',
      values: { operation: 'test-request', attemptedModels: 3, lastFailure: 'AI-INVALID-RESPONSE' },
    } });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('warms models in priority order and stops once one proves the real structured contract', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ error: { code: 502 } }, 502))
      .mockResolvedValueOnce(response({ choices: [{ message: { content: '{"ready":true}' } }] }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(warmOpenRouterModels()).resolves.toEqual({ available: true, retryable: false, model: 'google/gemma-4-31b-it:free' });
    expect(fetchMock.mock.calls.map(([, options]) => JSON.parse(options.body).model)).toEqual([
      'thinkingmachines/inkling:free', 'google/gemma-4-31b-it:free',
    ]);
  });
});

it('keeps production fixture overrides disabled outside an isolated demo harness', async () => {
 vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('OPENROUTER_TEST_URL', 'http://127.0.0.1:9098');
 vi.stubEnv('GCLOUD_PROJECT', 'demo-shark-empti'); vi.stubEnv('FIRESTORE_EMULATOR_HOST', '127.0.0.1:8080');
 vi.stubEnv('FIREBASE_AUTH_EMULATOR_HOST', '127.0.0.1:9099'); vi.stubEnv('NEXT_PUBLIC_USE_EMULATORS', 'true');
 vi.stubEnv('OPENROUTER_API_KEY', 'test-only');
 const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
 await expect(generateStructured({ operation: 'guard', system: '', prompt: '', schema: z.object({ ok: z.boolean() }) })).rejects.toMatchObject({ appError: { code: 'AI-CONFIG-MISSING' } });
 expect(fetchMock).not.toHaveBeenCalled();
 vi.stubEnv('SHARK_EMULATOR_TEST_MODE', 'true');
 fetchMock.mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] })));
 await expect(generateStructured({ operation: 'guard', system: '', prompt: '', schema: z.object({ ok: z.boolean() }) })).resolves.toEqual({ ok: true });
 expect(fetchMock.mock.calls[0][0]).toBe('http://127.0.0.1:9098/');
 vi.stubEnv('OPENROUTER_API_KEY', 'real-key-must-not-leave-process');
 await expect(generateStructured({ operation: 'guard', system: '', prompt: '', schema: z.object({ ok: z.boolean() }) })).rejects.toMatchObject({ appError: { code: 'AI-CONFIG-MISSING' } });
 expect(fetchMock).toHaveBeenCalledTimes(1);
});

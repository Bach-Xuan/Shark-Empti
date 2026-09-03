// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
vi.mock('server-only', () => ({}));
import { generateStructured, resetOpenRouterModelPreferenceForTest, warmOpenRouterModels } from '@/ai/openrouter';

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

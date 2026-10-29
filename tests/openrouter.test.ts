// @vitest-environment node
import { requestStructuredOnce } from '@/ai/openrouter';
import { classifyAiFailure } from '@/ai/error-classifier';
import { AI_IO_LIMITS } from '@/ai/config/limits';
import { readProviderBody } from '@/ai/provider-body';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { z } from 'zod';
vi.mock('server-only', () => ({}));

const schema = z.object({ answer: z.string() });
const run = (modelOrdinal: 0 | 1 | 2 = 0, signal = new AbortController().signal) => requestStructuredOnce({ operation: 'academic-validation', modelOrdinal, system: 'Teach clearly.', prompt: 'Question', schema, signal });
const response = (body: unknown, status = 200, headers?: HeadersInit) => new Response(JSON.stringify(body), { status, headers });
beforeEach(() => vi.stubEnv('OPENROUTER_API_KEY', 'test-only'));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('single-attempt OpenRouter adapter', () => {
  it('issues exactly one request and applies native schema only to its selected model', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ choices: [{ message: { content: '{"answer":"42"}' } }] }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(run(1)).resolves.toMatchObject({ ok: true, data: { answer: '42' } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe('google/gemma-4-31b-it:free');
    expect(body.response_format.type).toBe('json_schema');
  });
  it('returns a normalized provider failure without internal fallback', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ error: { code: 503 } }, 503));
    vi.stubGlobal('fetch', fetchMock);
    const result = await run();
    expect(result).toEqual({ ok: false, failure: { kind: 'provider', code: 'AI-PROVIDER-503', httpStatus: 503 } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    if (!result.ok) expect(classifyAiFailure(result.failure)).toEqual({ decision: 'retry_next_model' });
  });
  it('classifies a disconnected route as recoverable transport rather than explicit cancellation', async () => {
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('disconnected', 'AbortError')));
    const result = await run(0, controller.signal);
    expect(result).toEqual({ ok: false, failure: { kind: 'transport', code: 'AI-CLIENT-DISCONNECTED' } });
    if (!result.ok) expect(classifyAiFailure(result.failure)).toEqual({ decision: 'retry_next_model' });
  });
  it('treats credential failures as terminal and 429 as retry-after', async () => {
    expect(classifyAiFailure({ kind: 'provider', code: 'AI-PROVIDER-401', httpStatus: 401 })).toEqual({ decision: 'terminal' });
    expect(classifyAiFailure({ kind: 'provider', code: 'AI-PROVIDER-429', httpStatus: 429, retryAfterMs: 2_000 })).toEqual({ decision: 'retry_after', retryAfterMs: 2_000 });
  });
  it('accepts contractually supported fenced JSON and rejects schema-invalid output', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response({ choices: [{ message: { content: '```json\n{"answer":"42"}\n```' } }] })).mockResolvedValueOnce(response({ choices: [{ message: { content: '{"wrong":true}' } }] })));
    await expect(run()).resolves.toMatchObject({ ok: true });
    await expect(run()).resolves.toEqual({ ok: false, failure: { kind: 'invalid_schema', code: 'AI-INVALID-RESPONSE' } });
  });
  it('does not permit production fixture overrides outside the isolated harness', async () => {
    vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('OPENROUTER_TEST_URL', 'http://127.0.0.1:9098');
    vi.stubEnv('GCLOUD_PROJECT', 'demo-shark-empti'); vi.stubEnv('FIRESTORE_EMULATOR_HOST', '127.0.0.1:8080'); vi.stubEnv('FIREBASE_AUTH_EMULATOR_HOST', '127.0.0.1:9099'); vi.stubEnv('NEXT_PUBLIC_USE_EMULATORS', 'true');
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    await expect(run()).resolves.toEqual({ ok: false, failure: { kind: 'configuration', code: 'AI-CONFIG-MISSING' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([
    ['{', 'invalid_json'],
    [JSON.stringify({ choices: 'wrong shape' }), 'invalid_schema'],
    [JSON.stringify({ choices: [{ message: { content: '   ' } }] }), 'empty'],
  ])('classifies malformed envelope/content %s without leaking its body', async (text, kind) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(text)));
    await expect(run()).resolves.toEqual({ ok: false, failure: { kind, code: 'AI-INVALID-RESPONSE' } });
  });
  it('bounds decoded provider bytes and cancels an oversized streamed response', async () => {
    const cancel = vi.fn(() => new Promise<void>(() => {}));
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(AI_IO_LIMITS.providerBodyBytes + 1)); }, cancel });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(stream)));
    await expect(run()).resolves.toEqual({ ok: false, failure: { kind: 'response_too_large', code: 'AI-INVALID-RESPONSE' } });
    expect(cancel).toHaveBeenCalledOnce();
  });
  it('rejects schema-valid output that exceeds the persisted UTF-8 byte budget', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ choices: [{ message: { content: JSON.stringify({ answer: 'é'.repeat(AI_IO_LIMITS.storedResultBytes / 2) }) } }] })));
    await expect(run()).resolves.toEqual({ ok: false, failure: { kind: 'response_too_large', code: 'AI-INVALID-RESPONSE' } });
  });
  it('cancels a body stalled after headers when its signal aborts', async () => {
    const controller = new AbortController();
    const cancel = vi.fn();
    const waiting = readProviderBody(new Response(new ReadableStream({ cancel })), controller.signal);
    const failure = expect(waiting).rejects.toBeInstanceOf(DOMException);
    controller.abort();
    await failure;
    expect(cancel).toHaveBeenCalledOnce();
  });
  it('normalizes unsupported serialization from a future output transform', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ choices: [{ message: { content: '{"answer":"1"}' } }] })));
    const transformed = z.object({ answer: z.string().transform(value => BigInt(value)) });
    await expect(requestStructuredOnce({ operation: 'academic-validation', modelOrdinal: 0, system: 'Teach clearly.', prompt: 'Question', schema: transformed, signal: new AbortController().signal })).resolves.toEqual({ ok: false, failure: { kind: 'invalid_schema', code: 'AI-INVALID-RESPONSE' } });
  });
  it('respects Retry-After dates and terminates oversized delays instead of creating invalid timestamps', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({}, 429, { 'retry-after': new Date(Date.now() + 10_000).toUTCString() })));
    const result = await run();
    expect(result).toMatchObject({ ok: false, failure: { retryAfterMs: 10_000 } });
    expect(classifyAiFailure({ kind: 'provider', code: 'AI-PROVIDER-429', httpStatus: 429, retryAfterMs: 1e100 })).toEqual({ decision: 'terminal' });
    expect(classifyAiFailure({ kind: 'provider', code: 'AI-PROVIDER-429', httpStatus: 429, retryAfterMs: NaN })).toEqual({ decision: 'terminal' });
  });
});

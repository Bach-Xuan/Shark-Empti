// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
vi.mock('server-only', () => ({}));
import { generateStructured } from '@/ai/openrouter';

const schema = z.object({ answer: z.string() });
const request = () => generateStructured({ system: 'Teach clearly.', prompt: 'Question', schema });
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Retry-After': '0' } });
const success = () => response({ choices: [{ message: { content: JSON.stringify({ answer: '42' }) } }] });
beforeEach(() => { vi.stubEnv('OPENROUTER_API_KEY', 'test-only'); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe('OpenRouter structured response contract', () => {
  it('uses a 60-second deadline for each attempt and stops after two timeout retries', async () => {
    vi.useFakeTimers();
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => AbortSignal.abort());
    const fetchMock = vi.fn().mockRejectedValue(new DOMException('fixture', 'TimeoutError'));
    vi.stubGlobal('fetch', fetchMock);
    const assertion = expect(request()).rejects.toMatchObject({ appError: { code: 'AI-TIMEOUT' } });
    await vi.runAllTimersAsync(); await assertion;
    expect(timeout.mock.calls).toEqual([[60000], [60000], [60000]]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it('rejects a non-JSON response envelope without retrying', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('<html>private upstream</html>'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(request()).rejects.toMatchObject({ appError: { code: 'AI-INVALID-RESPONSE' } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('sends the configured schema and validates returned JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(success()); vi.stubGlobal('fetch', fetchMock);
    expect(await request()).toEqual({ answer: '42' });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.response_format.type).toBe('json_schema');
    expect(body.messages.map((m: { role: string }) => m.role)).toEqual(['system', 'user']);
  });
  it('rejects missing configuration before making a request', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', ''); const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    await expect(request()).rejects.toMatchObject({ appError: { code: 'AI-CONFIG-MISSING' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([401, 403, 400])('does not retry permanent HTTP %s errors', async status => {
    const fetchMock = vi.fn().mockResolvedValue(response({ error: { code: status } }, status)); vi.stubGlobal('fetch', fetchMock);
    await expect(request()).rejects.toMatchObject({ appError: { code: `AI-PROVIDER-${status}` } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('retries embedded HTTP-200 upstream errors without changing models', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response({ error: { code: 502 } })).mockResolvedValueOnce(success());
    vi.stubGlobal('fetch', fetchMock);
    expect(await request()).toEqual({ answer: '42' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1].body).toBe(fetchMock.mock.calls[1][1].body);
  });
  it('limits rate-limit retries to two', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(response({ error: { code: 429 } }, 429))); vi.stubGlobal('fetch', fetchMock);
    await expect(request()).rejects.toMatchObject({ appError: { code: 'AI-RATE-LIMIT-429' } });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it.each([{}, { choices: [] }, { choices: [{ message: { content: 'not JSON' } }] }, { choices: [{ message: { content: '{"answer":42}' } }] }])('rejects invalid provider output without exposing it', async body => {
    const fetchMock = vi.fn().mockResolvedValue(response(body)); vi.stubGlobal('fetch', fetchMock);
    await expect(request()).rejects.toMatchObject({ appError: { code: 'AI-INVALID-RESPONSE' } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('passes assistant history using the OpenRouter wire role', async () => {
    const fetchMock = vi.fn().mockResolvedValue(success()); vi.stubGlobal('fetch', fetchMock);
    await generateStructured({ system: 'Tutor', prompt: 'Continue', schema, messages: [{ role: 'assistant', content: 'Earlier answer' }] });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).messages[1]).toEqual({ role: 'assistant', content: 'Earlier answer' });
  });
});

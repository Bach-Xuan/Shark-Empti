// @vitest-environment node
import { checkOpenRouterHealth } from '../scripts/lib/openrouter-health';
import { OPENROUTER_MODEL_PRIORITY } from '@/ai/config/model';
import { expect,it,vi } from 'vitest';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
it('authenticates before reading the public catalogue and distinguishes inference', async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ data: { limit_remaining: null } }))
    .mockResolvedValueOnce(json({ data: OPENROUTER_MODEL_PRIORITY.map(id => ({ id })) }));
  expect((await checkOpenRouterHealth('private-fixture', request)).join(' ')).toContain('Live inference, account credits and model-specific quotas: not tested');
  expect(request.mock.calls[0][0]).toBe('https://openrouter.ai/api/v1/key');
  expect(request.mock.calls[1][1]).not.toHaveProperty('headers');
});
it('rejects a missing key without making any request', async () => {
  const request = vi.fn();
  await expect(checkOpenRouterHealth(' ', request)).rejects.toThrow('missing');
  expect(request).not.toHaveBeenCalled();
});
it.each([401, 403, 402, 429])('rejects invalid, revoked or limited credentials (HTTP %s) without leaking bodies', async status => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(json({ secret: 'private-fixture' }, status));
  await expect(checkOpenRouterHealth('private-fixture', request)).rejects.toThrow(`HTTP ${status}`);
  expect(request).toHaveBeenCalledTimes(1);
});
it('reports an exhausted configured cap separately from authentication', async () => {
  await expect(checkOpenRouterHealth('key', vi.fn().mockResolvedValue(json({ data: { limit_remaining: 0 } })))).rejects.toThrow('Credential authenticated; configured key spending limit is exhausted');
});
it('rejects absent models and malformed metadata', async () => {
  const request = vi.fn().mockResolvedValueOnce(json({ data: { limit_remaining: 10 } })).mockResolvedValueOnce(json({ data: [] }));
  await expect(checkOpenRouterHealth('key', request)).rejects.toThrow('Configured models missing');
  await expect(checkOpenRouterHealth('key', vi.fn().mockResolvedValue(json({ data: {} })))).rejects.toThrow('invalid metadata');
});
it('bounds the entire check and redacts network exceptions', async () => {
  const request: typeof fetch = (_url, init) => new Promise((_, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new Error('private-fixture')), { once: true });
  });
  await expect(checkOpenRouterHealth('private-fixture', request, 5)).rejects.toThrow('timed out');
  await expect(checkOpenRouterHealth('private-fixture', vi.fn().mockRejectedValue(new Error('private-fixture')))).rejects.toThrow('network error or invalid response');
});

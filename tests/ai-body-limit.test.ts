// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { boundedJson, BODY_READ_TIMEOUT_MS } from '@/ai/route-utils';
afterEach(() => vi.useRealTimers());
it('cancels a streamed body at the byte limit without buffering its remainder', async () => {
  const cancel = vi.fn();
  const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(5)); controller.enqueue(new Uint8Array(6)); }, cancel });
  const request = new Request('http://localhost', { method: 'POST', body, duplex: 'half' } as RequestInit);
  await expect(boundedJson(request, 10)).rejects.toMatchObject({ status: 413 });
  expect(cancel).toHaveBeenCalledOnce();
});
it('decodes UTF-8 split across chunks and rejects invalid JSON', async () => {
  const bytes = new TextEncoder().encode(JSON.stringify({ name: 'Việt' }));
  const body = new ReadableStream({ start(c) { for (const byte of bytes) c.enqueue(new Uint8Array([byte])); c.close(); } });
  const request = new Request('http://localhost', { method: 'POST', body, duplex: 'half' } as RequestInit);
  expect(await boundedJson(request, bytes.length)).toEqual({ name: 'Việt' });
  await expect(boundedJson(new Request('http://localhost', { method: 'POST', body: '{' }), 10)).rejects.toBeInstanceOf(SyntaxError);
});
it('times out a stalled body and clears its timer', async () => {
  vi.useFakeTimers();
  const cancel = vi.fn();
  const request = new Request('http://localhost', { method: 'POST', body: new ReadableStream({ cancel }), duplex: 'half' } as RequestInit);
  const failure = expect(boundedJson(request, 10)).rejects.toMatchObject({ status: 408, code: 'APP-BODY-TIMEOUT' });
  await vi.advanceTimersByTimeAsync(BODY_READ_TIMEOUT_MS);
  await failure;
  expect(cancel).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});
it('honours upstream cancellation without waiting for the body deadline', async () => {
  vi.useFakeTimers();
  const controller = new AbortController();
  const cancel = vi.fn();
  const request = new Request('http://localhost', { method: 'POST', signal: controller.signal, body: new ReadableStream({ cancel }), duplex: 'half' } as RequestInit);
  const failure = expect(boundedJson(request, 10)).rejects.toMatchObject({ status: 408, code: 'APP-REQUEST-CANCELLED' });
  controller.abort();
  await failure;
  expect(cancel).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});
it('does not await an underlying cancellation that never settles', async () => {
  const request = new Request('http://localhost', {
    method: 'POST', duplex: 'half', body: new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array(11)); },
      cancel: () => new Promise(() => {}),
    }),
  } as RequestInit);
  await expect(boundedJson(request, 10)).rejects.toMatchObject({ status: 413 });
});

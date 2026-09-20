// @vitest-environment node
import { expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { boundedJson } from '@/ai/route-utils';
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

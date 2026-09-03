import { afterEach, expect, it, vi } from 'vitest';
import { copyTextToClipboard } from '@/lib/clipboard';
afterEach(() => vi.unstubAllGlobals());
it('reports missing and denied clipboard access without throwing', async () => {
  vi.stubGlobal('navigator', {});
  expect(await copyTextToClipboard('private text')).toBe(false);
  vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
  expect(await copyTextToClipboard('private text')).toBe(false);
});
it('reports success only after the write resolves', async () => {
  let resolve!: () => void;
  const write = vi.fn(() => new Promise<void>(done => { resolve = done; }));
  vi.stubGlobal('navigator', { clipboard: { writeText: write } });
  let done = false;
  const result = copyTextToClipboard('notes').then(value => { done = true; return value; });
  await Promise.resolve();
  expect(done).toBe(false);
  resolve();
  expect(await result).toBe(true);
  expect(write).toHaveBeenCalledWith('notes');
});

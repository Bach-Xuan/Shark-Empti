import { afterEach, expect, it, vi } from 'vitest';
import { browserUuid } from '@/lib/browser-uuid';

afterEach(() => vi.unstubAllGlobals());

it('uses the native UUID implementation when available', () => {
  const native = '9f1011ec-7ef7-4c55-a955-9e785a7ae981';
  vi.stubGlobal('crypto', { randomUUID: () => native });
  expect(browserUuid()).toBe(native);
});

it('sets the v4 version and RFC variant on random bytes in older browsers', () => {
  const getRandomValues = vi.fn((bytes: Uint8Array) => bytes.fill(0xff));
  vi.stubGlobal('crypto', { getRandomValues });
  expect(browserUuid()).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
  expect(getRandomValues).toHaveBeenCalledOnce();
});

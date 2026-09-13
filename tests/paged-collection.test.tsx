import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { Query } from 'firebase/firestore';
import { usePagedCollection, PAGE_SIZE } from '@/hooks/use-paged-collection';
const mocks = vi.hoisted(() => ({ callbacks: [] as Array<(snapshot: unknown) => void>, get: vi.fn(), unsubscribe: vi.fn(), limit: vi.fn(), report: vi.fn() }));
vi.mock('@/firebase/error-emitter', () => ({ errorEmitter: { emit: mocks.report } }));
vi.mock('firebase/firestore', () => ({ query: (...args: unknown[]) => args, limit: mocks.limit, startAfter: (cursor: unknown) => cursor, getDocs: mocks.get,
 onSnapshot: (_: unknown, callback: (snapshot: unknown) => void) => { mocks.callbacks.push(callback); return mocks.unsubscribe; } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); mocks.callbacks = []; });
const page = (start: number, count: number) => ({ size: count, docs: Array.from({ length: count }, (_, i) => ({ id: String(start + i), data: () => ({ value: start + i }) })) });
const source = {} as Query;
it('bounds reads to one page and appends a cursor page only on demand', async () => {
 const { result } = renderHook(() => usePagedCollection(source, (id) => id));
 act(() => mocks.callbacks[0](page(0, PAGE_SIZE)));
 expect(result.current.items).toHaveLength(50);
 expect(mocks.limit).toHaveBeenCalledWith(50);
 expect(mocks.get).not.toHaveBeenCalled();
 mocks.get.mockResolvedValue(page(50, 12));
 await act(async () => result.current.loadMore());
 expect(result.current.items).toHaveLength(62);
 expect(new Set(result.current.items).size).toBe(62);
 expect(result.current.hasMore).toBe(false);
 act(() => mocks.callbacks[0](page(100, 50)));
 expect(result.current.items[0]).toBe('100');
 expect(result.current.items).toHaveLength(50);
});
it('discards late pages and subscriptions after account/query changes', async () => {
 let resolve!: (snapshot: unknown) => void;
 const second = {} as Query;
 const { result, rerender } = renderHook(({ source }) => usePagedCollection(source, id => id), { initialProps: { source } });
 const firstCallback = mocks.callbacks[0];
 act(() => firstCallback(page(0, 50)));
 mocks.get.mockReturnValue(new Promise(done => { resolve = done; }));
 let request!: Promise<void>;
 act(() => { request = result.current.loadMore(); });
 rerender({ source: second });
 await act(async () => { resolve(page(50, 50)); await request; firstCallback(page(0, 50)); });
 expect(result.current.items).toEqual([]);
 expect(mocks.unsubscribe).toHaveBeenCalled();
});

it('deduplicates records that move across an older cursor boundary', async () => {
 const { result } = renderHook(() => usePagedCollection(source, id => id));
 act(() => mocks.callbacks[0](page(0, 50)));
 mocks.get.mockResolvedValue(page(45, 10));
 await act(async () => result.current.loadMore());
 expect(result.current.items).toHaveLength(55);
 expect(new Set(result.current.items).size).toBe(55);
});

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useHistory } from '@/hooks/use-history';
import { history } from './fixtures/quiz';

const mocks = vi.hoisted(() => ({ uid: 'owner', callbacks: [] as Array<(page: unknown) => void>, get: vi.fn(), stop: vi.fn() }));
vi.mock('@/firebase', () => ({ useUser: () => ({ user: { uid: mocks.uid } }), useFirestore: () => database }));
const database = {};
vi.mock('@/firebase/error-emitter', () => ({ errorEmitter: { emit: vi.fn() } }));
vi.mock('firebase/firestore', async importOriginal => ({
  ...await importOriginal<typeof import('firebase/firestore')>(),
  collection: (_db: unknown, ...path: string[]) => path.join('/'),
  query: (...parts: unknown[]) => parts, where: (...parts: unknown[]) => parts, orderBy: (...parts: unknown[]) => parts,
  limit: (count: number) => count, startAfter: (anchor: unknown) => anchor,
  onSnapshot: (_source: unknown, next: (page: unknown) => void) => { mocks.callbacks.push(next); return mocks.stop; },
  getDocs: mocks.get,
}));
afterEach(() => { cleanup(); mocks.callbacks = []; mocks.uid = 'owner'; vi.clearAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
const page = (start: number, size: number) => ({ size, docs: Array.from({ length: size }, (_, index) => {
  const millis = Date.parse('2026-09-03') - Math.floor((start + index) / 3) * 2000;
  return { id: 'session' + (start + index), data: () => ({ ...history, date: { toDate: () => new Date(millis) } }) };
}) });

it('uses one listener and a document cursor across three pages, including equal timestamps', async () => {
  const { result } = renderHook(() => useHistory());
  expect(mocks.callbacks).toHaveLength(1);
  act(() => mocks.callbacks[0](page(0, 50)));
  mocks.get.mockResolvedValueOnce(page(50, 50)).mockResolvedValueOnce(page(100, 20));
  await act(async () => result.current.loadMore());
  expect(result.current.items).toHaveLength(100);
  await act(async () => result.current.loadMore());
  expect(result.current.items.map(item => item.id)).toEqual(Array.from({ length: 120 }, (_, i) => 'session' + i));
  expect(result.current.hasMore).toBe(false);
  act(() => mocks.callbacks[0](page(0, 50)));
  expect(result.current.items).toHaveLength(50);
});
it('discards a delayed continuation after the account changes', async () => {
  const { result, rerender } = renderHook(() => useHistory());
  act(() => { mocks.callbacks[0](page(0, 50)); });
  let resolve!: (value: unknown) => void;
  mocks.get.mockReturnValue(new Promise(done => { resolve = done; }));
  let pending!: Promise<void>;
  act(() => { pending = result.current.loadMore(); });
  mocks.uid = 'other'; rerender();
  await act(async () => { resolve(page(50, 10)); await pending; });
  expect(result.current.items).toEqual([]);
});

it('keeps the history listener dormant on Profile and shares it between idle preload and immediate demand', () => {
  let runIdle!: () => void;
  const idle = vi.fn((callback: () => void) => { runIdle = callback; return 4; });
  const cancel = vi.fn();
  vi.stubGlobal('requestIdleCallback', idle);
  vi.stubGlobal('cancelIdleCallback', cancel);
  const hook = renderHook(({ mode }: { mode: 'off' | 'idle' | 'immediate' }) => useHistory(mode), { initialProps: { mode: 'off' as 'off' | 'idle' | 'immediate' } });
  expect(mocks.callbacks).toHaveLength(0);
  hook.rerender({ mode: 'idle' });
  expect(mocks.callbacks).toHaveLength(0);
  expect(idle).toHaveBeenCalledWith(expect.any(Function), { timeout: 1500 });
  act(() => runIdle());
  expect(mocks.callbacks).toHaveLength(1);
  hook.rerender({ mode: 'immediate' });
  expect(mocks.callbacks).toHaveLength(1);
  act(() => { mocks.callbacks[0](page(0, 1)); });
  hook.rerender({ mode: 'idle' });
  expect(hook.result.current.items).toHaveLength(1);
  expect(mocks.stop).not.toHaveBeenCalled();
  hook.rerender({ mode: 'off' });
  expect(mocks.stop).toHaveBeenCalledTimes(1);
  act(() => mocks.callbacks[0](page(0, 2)));
  expect(hook.result.current.items).toEqual([]);
});

it('cancels an idle fallback on navigation and starts immediately when Dashboard needs the reader first', () => {
  vi.useFakeTimers();
  vi.stubGlobal('requestIdleCallback', undefined);
  const hook = renderHook(({ mode }: { mode: 'off' | 'idle' | 'immediate' }) => useHistory(mode), { initialProps: { mode: 'idle' as 'off' | 'idle' | 'immediate' } });
  act(() => vi.advanceTimersByTime(249));
  expect(mocks.callbacks).toHaveLength(0);
  hook.rerender({ mode: 'off' });
  act(() => vi.advanceTimersByTime(1000));
  expect(mocks.callbacks).toHaveLength(0);
  hook.rerender({ mode: 'idle' });
  hook.rerender({ mode: 'immediate' });
  expect(hook.result.current.loading).toBe(true);
  expect(mocks.callbacks).toHaveLength(1);
  act(() => vi.advanceTimersByTime(250));
  expect(mocks.callbacks).toHaveLength(1);
  mocks.uid = 'other';
  hook.rerender({ mode: 'idle' });
  expect(mocks.stop).toHaveBeenCalledTimes(1);
  act(() => vi.advanceTimersByTime(250));
  expect(mocks.callbacks).toHaveLength(2);
});

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useHistory } from '@/hooks/use-history';
import { history } from './fixtures/quiz';

const mocks = vi.hoisted(() => ({ uid: 'owner', callbacks: [] as Array<(page: unknown) => void>, get: vi.fn() }));
vi.mock('@/firebase', () => ({ useUser: () => ({ user: { uid: mocks.uid } }), useFirestore: () => database }));
const database = {};
vi.mock('@/firebase/error-emitter', () => ({ errorEmitter: { emit: vi.fn() } }));
vi.mock('firebase/firestore', async importOriginal => ({
  ...await importOriginal<typeof import('firebase/firestore')>(),
  collection: (_db: unknown, ...path: string[]) => path.join('/'),
  query: (...parts: unknown[]) => parts, where: (...parts: unknown[]) => parts, orderBy: (...parts: unknown[]) => parts,
  limit: (count: number) => count, startAfter: (anchor: unknown) => anchor,
  onSnapshot: (_source: unknown, next: (page: unknown) => void) => { mocks.callbacks.push(next); return () => {}; },
  getDocs: mocks.get,
}));
afterEach(() => { cleanup(); mocks.callbacks = []; mocks.uid = 'owner'; vi.clearAllMocks(); });
const page = (prefix: string, start: number, size: number) => ({ size, docs: Array.from({ length: size }, (_, index) => {
  const millis = Date.parse('2026-09-03') - (start + index) * 2000 - (prefix === 'legacy' ? 1000 : 0);
  return { id: prefix + (start + index), data: () => ({ ...history, date: prefix === 'legacy' ? new Date(millis).toISOString() : { toDate: () => new Date(millis) } }) };
}) });

it('merges bounded Timestamp/ISO streams before exposing each chronological page and resets after live changes', async () => {
  const { result } = renderHook(() => useHistory());
  act(() => { mocks.callbacks[0](page('current', 0, 50)); mocks.callbacks[1](page('legacy', 0, 50)); });
  expect(result.current.items).toHaveLength(50);
  expect(result.current.items.slice(0, 4).map(item => item.id)).toEqual(['current0', 'legacy0', 'current1', 'legacy1']);
  mocks.get.mockResolvedValueOnce(page('current', 50, 10)).mockResolvedValueOnce(page('legacy', 50, 10));
  await act(async () => result.current.loadMore());
  expect(result.current.items).toHaveLength(100);
  await act(async () => result.current.loadMore());
  expect(result.current.items).toHaveLength(120);
  expect(result.current.hasMore).toBe(false);
  act(() => mocks.callbacks[0](page('current', 0, 50)));
  expect(result.current.items).toHaveLength(50);
});

it('discards a delayed continuation after the account changes', async () => {
  const { result, rerender } = renderHook(() => useHistory());
  act(() => { mocks.callbacks[0](page('current', 0, 50)); mocks.callbacks[1](page('legacy', 0, 0)); });
  let resolve!: (value: unknown) => void;
  mocks.get.mockReturnValue(new Promise(done => { resolve = done; }));
  let pending!: Promise<void>;
  act(() => { pending = result.current.loadMore(); });
  mocks.uid = 'other'; rerender();
  await act(async () => { resolve(page('current', 50, 10)); await pending; });
  expect(result.current.items).toEqual([]);
});

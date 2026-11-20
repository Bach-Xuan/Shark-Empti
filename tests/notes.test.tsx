import { useUserNotes } from '@/firebase/firestore/use-user-notes';
import { act,cleanup,renderHook } from '@testing-library/react';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
const mocks = vi.hoisted(() => ({ user: { uid: 'first' }, callbacks: [] as Array<(snapshot: unknown) => void>, failures: [] as Array<(error: unknown) => void>, unsubscribe: vi.fn(), write: vi.fn(), emit: vi.fn() }));
vi.mock('@/firebase/auth/use-user', () => ({ useUser: () => ({ user: mocks.user }) }));
vi.mock('@/firebase/provider', () => ({ useFirestore: () => 'database' }));
vi.mock('@/firebase/error-emitter', () => ({ errorEmitter: { emit: mocks.emit } }));
vi.mock('firebase/firestore', () => ({
  doc: (...parts: string[]) => ({ path: parts.slice(1).join('/') }), serverTimestamp: () => 1,
  onSnapshot: (_ref: unknown, _options: unknown, callback: (s: unknown) => void, fail: (e: unknown) => void) => { mocks.callbacks.push(callback); mocks.failures.push(fail); return mocks.unsubscribe; },
  runTransaction: (...args: unknown[]) => mocks.write(...args),
}));
beforeEach(() => { mocks.user = { uid: 'first' }; mocks.callbacks = []; mocks.failures = []; mocks.write.mockReset().mockResolvedValue(true); mocks.emit.mockReset(); });
afterEach(cleanup);
const snapshot = (content?: string) => ({ metadata: { fromCache: false, hasPendingWrites: false }, exists: () => content !== undefined, data: () => ({ content }) });
it('retains long legacy notes for reading while rejecting oversized edits before contacting Firestore', async () => {
  const { result } = renderHook(useUserNotes);
  const legacy = 'x'.repeat(20001);
  act(() => mocks.callbacks[0](snapshot(legacy)));
  expect(result.current.notes).toBe(legacy);
  await act(async () => expect(await result.current.updateNotes(legacy, { content: '', revision: 0 })).toBe(false));
  expect(mocks.write).not.toHaveBeenCalled();
  expect(mocks.emit).toHaveBeenCalledOnce();
  await act(async () => expect(await result.current.updateNotes('x'.repeat(20000), { content: '', revision: 0 })).toBe(true));
  expect(mocks.write).toHaveBeenCalledOnce();
});
it('clears missing documents, switches UID and ignores the old subscription', () => {
  const { result, rerender } = renderHook(() => useUserNotes());
  const first = mocks.callbacks[0];
  act(() => first(snapshot('private first')));
  expect(result.current.notes).toBe('private first');
  mocks.user = { uid: 'second' }; rerender();
  expect(result.current.notes).toBe('');
  act(() => first(snapshot('late private first')));
  expect(result.current.notes).toBe('');
  act(() => mocks.callbacks.at(-1)!(snapshot()));
  expect(result.current.loading).toBe(false);
  expect(result.current.notes).toBe('');
});
it('requires a fresh confirmed read after a listener failure and ignores the previous owner’s save callback', async () => {
  const { result, rerender } = renderHook(useUserNotes);
  act(() => mocks.callbacks[0](snapshot('original')));
  const stale = result.current.updateNotes;
  act(() => mocks.failures[0]({ code: 'unavailable' }));
  expect(result.current.failed).toBe(true);
  expect(await stale('edit while disconnected', { content: '', revision: 0 })).toBe(false);
  act(() => result.current.retry());
  act(() => mocks.callbacks.at(-1)!(snapshot('recovered')));
  expect(result.current.ready).toBe(true);
  mocks.user = { uid: 'second' }; rerender();
  act(() => mocks.callbacks.at(-1)!(snapshot()));
  expect(await stale('first owner text', { content: '', revision: 0 })).toBe(false);
  expect(mocks.write).not.toHaveBeenCalled();
});
it('waits for the write and returns false on failure without changing notes', async () => {
  const { result } = renderHook(() => useUserNotes());
  expect(await result.current.updateNotes('premature', { content: '', revision: 0 })).toBe(false);
  act(() => mocks.callbacks[0]({ ...snapshot(), metadata: { fromCache: true, hasPendingWrites: false } }));
  expect(await result.current.updateNotes('premature', { content: '', revision: 0 })).toBe(false);
  expect(mocks.write).not.toHaveBeenCalled();
  act(() => mocks.callbacks[0](snapshot()));
  mocks.write.mockRejectedValue({ code: 'unavailable' });
  let saved: Awaited<ReturnType<typeof result.current.updateNotes>> | undefined;
  await act(async () => { saved = await result.current.updateNotes('draft', { content: '', revision: 0 }); });
  expect(saved).toBe(false);
  expect(result.current.notes).toBe('');
  mocks.write.mockResolvedValue(true);
  await act(async () => { saved = await result.current.updateNotes('draft', { content: '', revision: 0 }); });
  expect(saved).toBe(true);
});

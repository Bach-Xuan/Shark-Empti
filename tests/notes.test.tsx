import { useUserNotes } from '@/firebase/firestore/use-user-notes';
import { act,cleanup,renderHook } from '@testing-library/react';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
const mocks = vi.hoisted(() => ({ user: { uid: 'first' }, callbacks: [] as Array<(snapshot: unknown) => void>, unsubscribe: vi.fn(), write: vi.fn(), emit: vi.fn() }));
vi.mock('@/firebase/auth/use-user', () => ({ useUser: () => ({ user: mocks.user }) }));
vi.mock('@/firebase/provider', () => ({ useFirestore: () => 'database' }));
vi.mock('@/firebase/error-emitter', () => ({ errorEmitter: { emit: mocks.emit } }));
vi.mock('firebase/firestore', () => ({
  doc: (...parts: string[]) => ({ path: parts.slice(1).join('/') }), serverTimestamp: () => 1,
  onSnapshot: (_ref: unknown, callback: (s: unknown) => void) => { mocks.callbacks.push(callback); return mocks.unsubscribe; },
  setDoc: (...args: unknown[]) => mocks.write(...args),
}));
beforeEach(() => { mocks.user = { uid: 'first' }; mocks.callbacks = []; mocks.write.mockReset(); });
afterEach(cleanup);
const snapshot = (content?: string) => ({ exists: () => content !== undefined, data: () => ({ content }) });
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
it('waits for the write and returns false on failure without changing notes', async () => {
  const { result } = renderHook(() => useUserNotes());
  mocks.write.mockRejectedValue({ code: 'unavailable' });
  let saved: boolean | undefined;
  await act(async () => { saved = await result.current.updateNotes('draft'); });
  expect(saved).toBe(false);
  expect(result.current.notes).toBe('');
  mocks.write.mockResolvedValue(undefined);
  await act(async () => { saved = await result.current.updateNotes('draft'); });
  expect(saved).toBe(true);
});

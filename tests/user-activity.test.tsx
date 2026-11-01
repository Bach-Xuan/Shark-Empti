import { useUserActivity } from '@/firebase/firestore/use-user-activity';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ uid: 'first' as string | null, write: vi.fn(), listeners: [] as Array<(snapshot: unknown) => void> }));
vi.mock('@/firebase/auth/use-user', () => ({ useUser: () => ({ user: mocks.uid ? { uid: mocks.uid } : null }) }));
vi.mock('@/firebase/provider', () => ({ useFirestore: () => 'database' }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...parts: string[]) => ({ path: parts.join('/') }),
  serverTimestamp: () => 'server-time', setDoc: mocks.write,
  onSnapshot: (_ref: unknown, next: (snapshot: unknown) => void) => { mocks.listeners.push(next); return vi.fn(); },
}));
beforeEach(() => { mocks.uid = 'first'; mocks.listeners = []; mocks.write.mockReset().mockResolvedValue(undefined); });
afterEach(cleanup);
it('filters malformed legacy date leaves for presentation without changing stored content', () => {
  const view = renderHook(useUserActivity);
  act(() => mocks.listeners[0]({ exists: () => true, data: () => ({ activeDays: {
    '2024-02-29': true, '2000-02-29': true, '1900-02-29': true, '2026-02-29': true,
    '2026-04-31': true, '2026-11-01': 'true', secret: { nested: true },
  } }) }));
  expect(view.result.current.activity).toEqual({ '2024-02-29': true, '2000-02-29': true });
  expect(mocks.write).not.toHaveBeenCalled();
});
it('writes only one date leaf and never copies stale activity into a new account', () => {
  const view = renderHook(useUserActivity);
  act(() => mocks.listeners[0]({ exists: () => true, data: () => ({ activeDays: { '2020-01-01': true } }) }));
  act(() => view.result.current.trackToday());
  expect(Object.keys(mocks.write.mock.calls[0][1].activeDays)).toHaveLength(1);
  expect(mocks.write.mock.calls[0][1].activeDays).not.toHaveProperty('2020-01-01');
  mocks.uid = 'second'; view.rerender();
  expect(view.result.current.activity).toEqual({});
  act(() => mocks.listeners[0]({ exists: () => true, data: () => ({ activeDays: { '2020-01-02': true } }) }));
  expect(view.result.current.activity).toEqual({});
  act(() => view.result.current.trackToday());
  expect(mocks.write.mock.calls[1][0].path).toBe('users/second/activity/main');
  mocks.uid = null; view.rerender();
  act(() => view.result.current.trackToday());
  expect(mocks.write).toHaveBeenCalledTimes(2);
  expect(view.result.current.activity).toEqual({});
});

import { webcrypto } from 'node:crypto';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { Firestore } from 'firebase/firestore';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useForumReactions } from '@/hooks/use-forum-reactions';
import { forumReactionId, type ForumReactionTarget } from '@/lib/community-privacy';

type Snapshot = { metadata: { fromCache: boolean }; docs: Array<{ id: string; data: () => unknown }> };
type Source = { owner: string; ids: string[] };
type Listener = { source: Source; next: (snapshot: Snapshot) => void; fail: () => void; stop: ReturnType<typeof vi.fn> };
const mocks = vi.hoisted(() => ({ listeners: [] as Listener[] }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, root: string, uid: string, collection: string) => `${root}/${uid}/${collection}`,
  documentId: () => '__name__', where: (_field: unknown, _operator: unknown, ids: string[]) => ids,
  query: (owner: string, ids: string[]) => ({ owner, ids }),
  onSnapshot: (source: Source, options: unknown, next: Listener['next'], fail: Listener['fail']) => {
    expect(options).toEqual({ includeMetadataChanges: true });
    const stop = vi.fn(); mocks.listeners.push({ source, next, fail, stop }); return stop;
  },
}));
const db = {} as Firestore;
const target = { postId: 'post' };
const empty = (fromCache = false): Snapshot => ({ metadata: { fromCache }, docs: [] });
async function snapshot(value: ForumReactionTarget = target, extra: Record<string, unknown> = {}): Promise<Snapshot> {
  return { metadata: { fromCache: false }, docs: [{ id: await forumReactionId(value), data: () => ({ ...value, liked: true, privacyVersion: 1, ...extra }) }] };
}
beforeEach(() => { mocks.listeners = []; vi.stubGlobal('crypto', webcrypto); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it('bounds 61 explicit targets to three subscriptions and waits for every server result', async () => {
  const targets = Array.from({ length: 61 }, (_, index) => ({ postId: 'post' + index }));
  const hook = renderHook(() => useForumReactions(db, 'owner', targets));
  await waitFor(() => expect(mocks.listeners).toHaveLength(3));
  expect(mocks.listeners.map(item => item.source.ids.length)).toEqual([30, 30, 1]);
  expect(mocks.listeners.every(item => item.source.owner === 'users/owner/forumReactions')).toBe(true);
  await act(async () => { mocks.listeners[0].next(await snapshot(targets[0])); mocks.listeners[1].next(empty()); });
  expect(hook.result.current.loading).toBe(true);
  act(() => mocks.listeners[2].next(empty()));
  expect(hook.result.current.loading).toBe(false); expect(hook.result.current.isLiked(targets[0])).toBe(true);
  act(() => mocks.listeners[0].next(empty()));
  expect(hook.result.current.isLiked(targets[0])).toBe(false);
  hook.unmount(); expect(mocks.listeners.every(item => item.stop.mock.calls.length === 1)).toBe(true);
});

it('does not treat an empty cache as authoritative and handles metadata-only recovery', async () => {
  const hook = renderHook(() => useForumReactions(db, 'owner', [target]));
  await waitFor(() => expect(mocks.listeners).toHaveLength(1));
  act(() => mocks.listeners[0].next(empty(true)));
  expect(hook.result.current.loading).toBe(true);
  await act(async () => mocks.listeners[0].next(await snapshot()));
  expect(hook.result.current.loading).toBe(false); expect(hook.result.current.isLiked(target)).toBe(true);
  act(() => mocks.listeners[0].next(empty(true)));
  expect(hook.result.current.loading).toBe(true);
  act(() => mocks.listeners[0].next(empty()));
  expect(hook.result.current.loading).toBe(false); expect(hook.result.current.isLiked(target)).toBe(false);
});

it.each(['owner', 'target'] as const)('invalidates state and ignores late callbacks after a %s change', async change => {
  const hook = renderHook(({ uid, targets }) => useForumReactions(db, uid, targets), { initialProps: { uid: 'owner', targets: [target] } });
  await waitFor(() => expect(mocks.listeners).toHaveLength(1));
  const old = mocks.listeners[0], liked = await snapshot(); act(() => old.next(liked));
  expect(hook.result.current.isLiked(target)).toBe(true);
  hook.rerender({ uid: change === 'owner' ? 'other' : 'owner', targets: change === 'target' ? [{ postId: 'new' }] : [target] });
  expect(hook.result.current.isLiked(target)).toBe(false); expect(hook.result.current.loading).toBe(true);
  act(() => old.next(liked)); expect(hook.result.current.isLiked(target)).toBe(false);
  await waitFor(() => expect(mocks.listeners).toHaveLength(2));
  act(() => mocks.listeners[1].next(empty())); expect(hook.result.current.loading).toBe(false);
  expect(old.stop).toHaveBeenCalledOnce();
});

it('rejects a mismatched record, unsubscribes once, and supports an explicit fresh retry', async () => {
  const hook = renderHook(() => useForumReactions(db, 'owner', [target]));
  await waitFor(() => expect(mocks.listeners).toHaveLength(1));
  const old = mocks.listeners[0]; await act(async () => old.next(await snapshot(target, { postId: 'foreign' })));
  expect(hook.result.current.error).toBe(true); expect(old.stop).toHaveBeenCalledOnce();
  act(() => hook.result.current.retry()); expect(hook.result.current.loading).toBe(true);
  await waitFor(() => expect(mocks.listeners).toHaveLength(2));
  await act(async () => mocks.listeners[1].next(await snapshot()));
  expect(hook.result.current.error).toBe(false); expect(hook.result.current.isLiked(target)).toBe(true);
  act(() => old.fail()); expect(hook.result.current.error).toBe(false); expect(old.stop).toHaveBeenCalledOnce();
});

it('times out a hash that never finishes without leaking a later subscription', async () => {
  vi.useFakeTimers();
  let finish!: (value: ArrayBuffer) => void;
  vi.spyOn(webcrypto.subtle, 'digest').mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const hook = renderHook(() => useForumReactions(db, 'owner', [target]));
  await act(async () => vi.advanceTimersByTimeAsync(15_001)); expect(hook.result.current.error).toBe(true);
  await act(async () => finish(new ArrayBuffer(32))); expect(mocks.listeners).toHaveLength(0);
});

it('times out lost server confirmation after an established listener becomes cached', async () => {
  const hook = renderHook(() => useForumReactions(db, 'owner', [target]));
  await waitFor(() => expect(mocks.listeners).toHaveLength(1));
  act(() => mocks.listeners[0].next(empty())); vi.useFakeTimers();
  act(() => mocks.listeners[0].next(empty(true)));
  await act(async () => vi.advanceTimersByTimeAsync(15_001)); expect(hook.result.current.error).toBe(true);
  expect(mocks.listeners[0].stop).toHaveBeenCalledOnce();
});

it('does not subscribe for a guest or empty target list and reports missing configuration', () => {
  const hook = renderHook(({ uid, targets, store }) => useForumReactions(store, uid, targets), {
    initialProps: { uid: undefined as string | undefined, targets: [target], store: db as Firestore | null },
  });
  expect(hook.result.current.loading).toBe(false); expect(hook.result.current.error).toBe(false);
  hook.rerender({ uid: 'owner', targets: [], store: db }); expect(hook.result.current.loading).toBe(false);
  hook.rerender({ uid: 'owner', targets: [target], store: null }); expect(hook.result.current.error).toBe(true);
  expect(mocks.listeners).toHaveLength(0);
});

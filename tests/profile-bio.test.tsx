import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useProfileBio } from '@/hooks/use-profile-bio';
afterEach(cleanup);
const setup = () => renderHook(({ uid, remote }) => useProfileBio(uid, remote), { initialProps: { uid: 'one', remote: 'Original' } });
it('preserves dirty text through delayed snapshots, failure and retry; resumes sync after acknowledgement', async () => {
  const { result, rerender } = setup();
  act(() => result.current.edit('Draft'));
  rerender({ uid: 'one', remote: 'Delayed' });
  expect(result.current.bio).toBe('Draft');
  const success = vi.fn(), failure = vi.fn();
  await act(() => result.current.save(() => Promise.reject(new Error('offline')), success, failure));
  expect(result.current.bio).toBe('Draft'); expect(failure).toHaveBeenCalledOnce();
  const write = vi.fn().mockResolvedValue(undefined);
  await act(() => result.current.save(write, success, failure));
  expect(write).toHaveBeenCalledWith('Draft'); expect(success).toHaveBeenCalledOnce();
  rerender({ uid: 'one', remote: 'Still stale' }); expect(result.current.bio).toBe('Draft');
  rerender({ uid: 'one', remote: 'Draft' });
  rerender({ uid: 'one', remote: 'Another saved edit' }); expect(result.current.bio).toBe('Another saved edit');
});
it.each(['success', 'failure'])('revokes late %s on account changes and permits the new account to save', async outcome => {
  const { result, rerender } = setup();
  let resolve!: () => void, reject!: (e: Error) => void;
  const pending = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  const success = vi.fn(), failure = vi.fn(), write = vi.fn(() => pending);
  act(() => { void result.current.save(write, success, failure); void result.current.save(write, success, failure); });
  expect(write).toHaveBeenCalledOnce();
  rerender({ uid: 'two', remote: 'Second account' });
  expect(result.current.bio).toBe('Second account'); expect(result.current.isSaving).toBe(false);
  await act(async () => { if (outcome === 'success') resolve(); else reject(new Error('late')); });
  expect(success).not.toHaveBeenCalled(); expect(failure).not.toHaveBeenCalled();
  await act(() => result.current.save(async () => {}, success, failure)); expect(success).toHaveBeenCalledOnce();
});
it('revokes save completion after unmount', async () => {
  const { result, unmount } = setup(); let resolve!: () => void;
  const success = vi.fn(), failure = vi.fn();
  act(() => { void result.current.save(() => new Promise<void>(yes => { resolve = yes; }), success, failure); });
  unmount(); await act(async () => resolve()); expect(success).not.toHaveBeenCalled(); expect(failure).not.toHaveBeenCalled();
});
it('does not render the previous account draft even before effects reset it', () => {
  const seen: string[] = [];
  const { result, rerender } = renderHook(({ uid, remote }) => {
    const draft = useProfileBio(uid, remote); seen.push(draft.bio); return draft;
  }, { initialProps: { uid: 'one', remote: 'Original' } });
  act(() => result.current.edit('Private draft'));
  seen.length = 0;
  rerender({ uid: 'two', remote: 'Other account' });
  expect(seen).not.toContain('Private draft');
  expect(result.current.bio).toBe('Other account');
});

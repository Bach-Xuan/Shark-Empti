import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { startAccountPolling } from '@/lib/account-polling';

beforeEach(() => { vi.useFakeTimers(); vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible'); });
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
const flush = (ms = 0) => vi.advanceTimersByTimeAsync(ms);

it('bounds automatic recovery, resumes on return, and stops all wakes after a terminal result', async () => {
  const read = vi.fn().mockRejectedValue(new TypeError('Offline')), onValue = vi.fn(), onError = vi.fn();
  const stop = startAccountPolling({ read, onValue, onError, nextDelay: () => null });
  await flush(2 * 60 * 60_000);
  expect(read).toHaveBeenCalledTimes(5);
  expect(onError.mock.calls.map(call => call[1])).toEqual([true, true, true, true, false]);
  read.mockResolvedValue('done');
  window.dispatchEvent(new Event('online')); window.dispatchEvent(new Event('focus'));
  await flush();
  expect(read).toHaveBeenCalledTimes(6); expect(onValue).toHaveBeenCalledWith('done');
  window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange'));
  await flush(60 * 60_000);
  expect(read).toHaveBeenCalledTimes(6);
  stop();
});
it('suspends hidden-tab polling and coalesces online/focus/visibility wakes', async () => {
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  const read = vi.fn().mockResolvedValue('running');
  const stop = startAccountPolling({ read, onValue: vi.fn(), onError: vi.fn(), nextDelay: () => 12_000 });
  await flush(60_000); expect(read).not.toHaveBeenCalled();
  visibility.mockReturnValue('visible'); document.dispatchEvent(new Event('visibilitychange'));
  await flush(); expect(read).toHaveBeenCalledTimes(1);
  window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('online')); document.dispatchEvent(new Event('visibilitychange'));
  await flush(4999); expect(read).toHaveBeenCalledTimes(1);
  await flush(1); expect(read).toHaveBeenCalledTimes(2);
  visibility.mockReturnValue('hidden'); document.dispatchEvent(new Event('visibilitychange'));
  await flush(60 * 60_000); expect(read).toHaveBeenCalledTimes(2);
  visibility.mockReturnValue('visible'); document.dispatchEvent(new Event('visibilitychange'));
  await flush(); expect(read).toHaveBeenCalledTimes(3);
  stop(); expect(vi.getTimerCount()).toBe(0);
});
it('serializes requests, replaces a timed-out signal and ignores late work even if the reader ignores abort', async () => {
  let finish!: (value: string) => void;
  const read = vi.fn().mockImplementationOnce(() => new Promise<string>(resolve => { finish = resolve; })).mockResolvedValue('done');
  const onValue = vi.fn(), stop = startAccountPolling({ read, onValue, onError: vi.fn(), nextDelay: () => null });
  window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('online'));
  await flush(29_999); expect(read).toHaveBeenCalledOnce();
  await flush(5001); expect(read).toHaveBeenCalledTimes(2);
  expect((read.mock.calls[0][0] as AbortSignal).aborted).toBe(true);
  expect((read.mock.calls[1][0] as AbortSignal).aborted).toBe(false);
  finish('stale'); await flush();
  expect(onValue.mock.calls).toEqual([['done']]);
  stop();
});
it.each([{ code: 'APP-DATA-INVALID' }, { code: 'APP-REQUEST-FAILED', status: 404 }, { code: 'AUTH-INVALID', status: 401 }])('does not automatically repeat a permanent denial or protocol error %#', async error => {
  const read = vi.fn().mockRejectedValue(error), onError = vi.fn();
  const stop = startAccountPolling({ read, onValue: vi.fn(), onError, nextDelay: () => null });
  await flush(60_000); window.dispatchEvent(new Event('online')); window.dispatchEvent(new Event('focus'));
  await flush(60_000);
  expect(read).toHaveBeenCalledOnce(); expect(onError).toHaveBeenCalledWith(error, false);
  stop();
});
it('aborts pending work and removes timers/listeners on disposal', async () => {
  const read = vi.fn().mockImplementation(() => new Promise(() => {})), onValue = vi.fn(), onError = vi.fn();
  const stop = startAccountPolling({ read, onValue, onError, nextDelay: () => 12_000 });
  stop(); await flush();
  expect((read.mock.calls[0][0] as AbortSignal).aborted).toBe(true);
  window.dispatchEvent(new Event('online')); document.dispatchEvent(new Event('visibilitychange'));
  await flush(60_000);
  expect(read).toHaveBeenCalledOnce(); expect(onValue).not.toHaveBeenCalled(); expect(onError).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});
it('recovers Firebase token-transport failures without treating them as a rejected identity', async () => {
  const read = vi.fn().mockRejectedValueOnce({ code: 'auth/network-request-failed' }).mockResolvedValue('done');
  const stop = startAccountPolling({ read, onValue: vi.fn(), onError: vi.fn(), nextDelay: () => null });
  await flush(5000); expect(read).toHaveBeenCalledTimes(2); stop();
});

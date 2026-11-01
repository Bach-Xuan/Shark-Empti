import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AccountDataControls } from '@/components/account-data-controls';

const mocks = vi.hoisted(() => ({ request: vi.fn(), user: { uid: 'owner' } }));
vi.mock('@/firebase', () => ({ useUser: () => ({ user: mocks.user }) }));
vi.mock('@/lib/forum-client', () => ({ communityRequest: mocks.request }));
afterEach(() => { cleanup(); vi.useRealTimers(); vi.resetAllMocks(); });
const job = { id: 'ed259772-c4b5-4dbb-9787-4311d5a4a736', kind: 'export', status: 'ready', processed: 1, parts: 1, expiresAtMs: 9_000_000_000_000 };

it('recovers a transient status-read failure automatically without replaying a mutation', async () => {
  vi.useFakeTimers();
  mocks.request.mockRejectedValueOnce(new TypeError('Offline')).mockResolvedValue({ enabled: true, jobs: [job] });
  await act(async () => { render(<AccountDataControls lang="en" />); });
  await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
  expect(mocks.request).toHaveBeenCalledTimes(2);
  for (const call of mocks.request.mock.calls) expect(call.slice(1, 4)).toEqual(['/api/account/jobs', undefined, 'GET']);
  expect(screen.getByText('Create complete export: Ready to download')).toBeTruthy();
});
it('gives a timed-out status read a fresh request signal for bounded recovery', async () => {
  vi.useFakeTimers();
  mocks.request.mockImplementationOnce((_user, _path, _body, _method, signal: AbortSignal) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject({ code: 'APP-UNAVAILABLE' }), { once: true });
  })).mockResolvedValue({ enabled: true, jobs: [job] });
  await act(async () => { render(<AccountDataControls lang="en" />); });
  const firstSignal = mocks.request.mock.calls[0][4] as AbortSignal;
  await act(async () => { await vi.advanceTimersByTimeAsync(35_000); });
  expect(firstSignal.aborted).toBe(true);
  expect(mocks.request).toHaveBeenCalledTimes(2);
  expect((mocks.request.mock.calls[1][4] as AbortSignal).aborted).toBe(false);
});

it.each([
  { enabled: false, jobs: [] },
  { enabled: true, jobs: [job] },
])('stops automatic reads for an unavailable service or terminal job', async response => {
  vi.useFakeTimers();
  mocks.request.mockResolvedValue(response);
  await act(async () => { render(<AccountDataControls lang="en" />); });
  await act(async () => { await vi.advanceTimersByTimeAsync(30 * 60_000); });
  expect(mocks.request).toHaveBeenCalledTimes(1);
});

it.each(['en', 'vi'] as const)('shows an expired export with a localized way to request again in %s', async lang => {
  vi.useFakeTimers();
  mocks.request.mockResolvedValue({ enabled: true, jobs: [{ ...job, status: 'failed', errorCode: 'ACCOUNT-JOB-EXPIRED' }] });
  await act(async () => { render(<AccountDataControls lang={lang} />); });
  expect(screen.getByText(lang === 'en' ? /exceeded its seven-day/ : /vượt thời hạn xử lý bảy ngày/)).toBeTruthy();
  expect((screen.getByRole('button', { name: lang === 'en' ? 'Create complete export' : 'Tạo bản xuất đầy đủ' }) as HTMLButtonElement).disabled).toBe(false);
  await act(async () => { await vi.advanceTimersByTimeAsync(30 * 60_000); });
  expect(mocks.request).toHaveBeenCalledTimes(1);
});

it('polls active work and stops after completion', async () => {
  vi.useFakeTimers();
  mocks.request.mockResolvedValueOnce({ enabled: true, jobs: [{ ...job, status: 'running' }] })
    .mockResolvedValue({ enabled: true, jobs: [job] });
  await act(async () => { render(<AccountDataControls lang="en" />); });
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
  expect(mocks.request).toHaveBeenCalledTimes(2);
  await act(async () => { await vi.advanceTimersByTimeAsync(30 * 60_000); });
  expect(mocks.request).toHaveBeenCalledTimes(2);
});
it('uses the longer quota-wait interval rather than continuously polling delayed work', async () => {
  vi.useFakeTimers();
  mocks.request.mockResolvedValueOnce({ enabled: true, jobs: [{ ...job, status: 'waiting_quota' }] }).mockResolvedValue({ enabled: true, jobs: [job] });
  await act(async () => { render(<AccountDataControls lang="en" />); });
  await act(async () => { await vi.advanceTimersByTimeAsync(15 * 60_000 - 1); });
  expect(mocks.request).toHaveBeenCalledOnce();
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(mocks.request).toHaveBeenCalledTimes(2);
});

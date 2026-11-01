import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@/lib/forum-client', () => ({ communityRequest: mocks.request }));
vi.mock('@/components/app-preferences', () => ({ useAppPreferences: () => ({ lang: 'en' }) }));
import { ServiceConsent } from '@/components/service-consent';
const user = { uid: 'learner', getIdToken: vi.fn() };
const policy = { policyVersion: '2', minimumAge: 16 };
function mount() { return render(<ServiceConsent user={user}><p>Learning features</p></ServiceConsent>); }
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it('requires an explicit eligibility checkbox and successful policy persistence before rendering learning features', async () => {
  mocks.request.mockResolvedValueOnce({ ...policy, accepted: false });
  let finish!: (value: unknown) => void;
  mocks.request.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  mount();
  const button = await screen.findByRole('button', { name: 'Confirm and continue' });
  expect((button as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole('link', { name: 'Export or delete account data' }).getAttribute('href')).toBe('/account/data');
  fireEvent.click(screen.getByRole('checkbox'));
  expect((button as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(button); fireEvent.click(button);
  expect(screen.queryByText('Learning features')).toBeNull();
  expect(mocks.request).toHaveBeenCalledTimes(2);
  expect(mocks.request).toHaveBeenLastCalledWith(user, '/api/account/consent', { ...policy, accept: true }, 'POST', expect.any(AbortSignal));
  await act(async () => finish({ ...policy, accepted: true }));
  await waitFor(() => expect(screen.getByText('Learning features')).toBeTruthy());
});
it('recovers a lost confirmation response only after a fresh server status confirms acceptance', async () => {
  mocks.request.mockResolvedValueOnce({ ...policy, accepted: false }).mockRejectedValueOnce(Error('Offline'))
    .mockResolvedValueOnce({ ...policy, accepted: true });
  mount();
  fireEvent.click(await screen.findByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm and continue' }));
  await screen.findByRole('alert');
  expect(screen.queryByText('Learning features')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByText('Learning features');
  expect(mocks.request.mock.calls.map(call => call[3])).toEqual(['GET', 'POST', 'GET']);
});
it('rejects stale-policy responses and cancels pending status work on unmount', async () => {
  mocks.request.mockResolvedValueOnce({ ...policy, policyVersion: '1', accepted: true });
  const first = mount();
  await screen.findByRole('alert');
  expect(screen.queryByText('Learning features')).toBeNull(); first.unmount();
  let finish!: (value: unknown) => void;
  mocks.request.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const second = mount();
  const signal = mocks.request.mock.calls.at(-1)![4] as AbortSignal;
  second.unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => finish({ ...policy, accepted: true }));
});

import { act, cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { User, Auth } from 'firebase/auth';
import type { FirebaseApp } from 'firebase/app';
import type { ReactNode } from 'react';

const mocks = vi.hoisted(() => ({ observer: null as null | ((user: unknown) => void), repair: vi.fn(), openData: vi.fn(), popup: vi.fn() }));
vi.mock('firebase/auth', () => ({ GoogleAuthProvider: class {}, signInWithPopup: mocks.popup, onAuthStateChanged: (_auth: unknown, next: (user: unknown) => void) => { mocks.observer = next; return vi.fn(); } }));
vi.mock('@/firebase/firestore-client', () => ({ initializeClientFirestore: mocks.openData, ensureLearnerProfile: mocks.repair }));
vi.mock('@/components/firebase-error-listener', () => ({ FirebaseErrorListener: () => null }));
vi.mock('@/components/app-preferences', () => ({ useAppPreferences: () => ({ lang: 'en' }) }));
vi.mock('@/components/service-consent', () => ({
  ServiceConsent: ({ children, preparingProfile }: { children: ReactNode; preparingProfile: boolean }) =>
    preparingProfile ? <div role="status" aria-busy="true">Checking consent while preparing profile</div> : children,
}));
import { FirebaseProvider } from '@/firebase/auth-provider';
import { useGoogleSignIn } from '@/hooks/use-google-sign-in';

function mount(requireServiceConsent = true) {
  return render(<FirebaseProvider firebaseApp={{} as FirebaseApp} auth={{} as Auth} requireServiceConsent={requireServiceConsent}><p>Private application</p></FirebaseProvider>);
}
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it('keeps account-data controls available without profile provisioning or renewed learning consent', async () => {
  mocks.repair.mockRejectedValue(Error('Account writes locked'));
  mount(false);
  await act(async () => mocks.observer!({ uid: 'deleting-owner' } as User));
  expect(screen.getByText('Private application')).toBeTruthy();
  expect(mocks.repair).not.toHaveBeenCalled();
  expect(mocks.openData).not.toHaveBeenCalled();
});

it('holds authenticated children until profile bootstrap completes after a delayed popup', async () => {
  let finish!: () => void;
  mocks.repair.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
  mount();
  act(() => mocks.observer!({ uid: 'one' } as User));
  expect(screen.queryByText('Private application')).toBeNull();
  expect(screen.getByRole('status').closest('[aria-busy]')?.getAttribute('aria-busy')).toBe('true');
  await waitFor(() => expect(mocks.repair).toHaveBeenCalledOnce());
  await screen.findByText('Checking consent while preparing profile');
  expect(screen.queryByText('Private application')).toBeNull();
  await act(async () => finish());
  expect(screen.getByText('Private application')).toBeTruthy();
});

it('retains authentication on repair failure and supplies an explicit retry', async () => {
  mocks.repair.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
  mount();
  await act(async () => mocks.observer!({ uid: 'one' } as User));
  expect(screen.queryByText('Private application')).toBeNull();
  expect(screen.getByText(/Your session is preserved/)).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Export or delete account data' }).getAttribute('href')).toBe('/account/data');
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await act(async () => mocks.observer!({ uid: 'one' } as User));
  expect(screen.getByText('Private application')).toBeTruthy();
});

it('ignores an old account bootstrap completion after account switching', async () => {
  let first!: () => void;
  mocks.repair.mockReturnValueOnce(new Promise<void>(resolve => { first = resolve; })).mockResolvedValueOnce(undefined);
  mount();
  act(() => mocks.observer!({ uid: 'one' } as User));
  await waitFor(() => expect(mocks.repair).toHaveBeenCalledOnce());
  await act(async () => mocks.observer!({ uid: 'two' } as User));
  expect(screen.getByText('Private application')).toBeTruthy();
  act(() => mocks.observer!(null));
  await act(async () => first());
  expect(mocks.repair.mock.calls.map(call => call[1].uid)).toEqual(['one', 'two']);
});

it('keeps the guest entry independent of Firestore and cancels a stale sign-in before opening data', async () => {
  mount();
  await act(async () => mocks.observer!(null));
  expect(screen.getByText('Private application')).toBeTruthy();
  act(() => { mocks.observer!({ uid: 'old' }); mocks.observer!(null); });
  await act(async () => {});
  expect(mocks.openData).not.toHaveBeenCalled();
  expect(mocks.repair).not.toHaveBeenCalled();
});

it('opens the Google popup on the click and keeps profile reads dormant if the learner cancels', async () => {
  let cancel!: (error: unknown) => void;
  mocks.popup.mockReturnValue(new Promise((_, reject) => { cancel = reject; }));
  function SignIn() {
    const { handleGoogleSignIn, isSigningIn } = useGoogleSignIn();
    return <button disabled={isSigningIn} onClick={handleGoogleSignIn}>Google</button>;
  }
  render(<FirebaseProvider firebaseApp={{} as FirebaseApp} auth={{} as Auth}><SignIn /></FirebaseProvider>);
  act(() => mocks.observer!(null));
  const button = screen.getByRole('button', { name: 'Google' });
  fireEvent.click(button);
  expect(mocks.popup).toHaveBeenCalledOnce();
  await act(async () => cancel({ code: 'auth/popup-closed-by-user' }));
  expect(button.hasAttribute('disabled')).toBe(false);
  expect(mocks.openData).not.toHaveBeenCalled();
  expect(mocks.repair).not.toHaveBeenCalled();
});

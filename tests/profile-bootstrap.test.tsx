import { act, cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { User, Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import type { FirebaseApp } from 'firebase/app';

const mocks = vi.hoisted(() => ({ observer: null as null | ((user: unknown) => void), repair: vi.fn() }));
vi.mock('firebase/auth', () => ({ onAuthStateChanged: (_auth: unknown, next: (user: unknown) => void) => { mocks.observer = next; return vi.fn(); } }));
vi.mock('@/firebase/profile-bootstrap', () => ({ ensureLearnerProfile: mocks.repair }));
vi.mock('@/components/firebase-error-listener', () => ({ FirebaseErrorListener: () => null }));
vi.mock('@/components/app-preferences', () => ({ useAppPreferences: () => ({ lang: 'en' }) }));
import { FirebaseProvider } from '@/firebase/provider';

function mount() {
  return render(<FirebaseProvider firebaseApp={{} as FirebaseApp} firestore={{} as Firestore} auth={{} as Auth}><p>Private application</p></FirebaseProvider>);
}
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it('holds authenticated children until profile bootstrap completes after a delayed popup', async () => {
  let finish!: () => void;
  mocks.repair.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
  mount();
  act(() => mocks.observer!({ uid: 'one' } as User));
  expect(screen.queryByText('Private application')).toBeNull();
  expect(screen.getByRole('main').getAttribute('aria-busy')).toBe('true');
  await act(async () => finish());
  expect(screen.getByText('Private application')).toBeTruthy();
});

it('retains authentication on repair failure and supplies an explicit retry', async () => {
  mocks.repair.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
  mount();
  await act(async () => mocks.observer!({ uid: 'one' } as User));
  expect(screen.queryByText('Private application')).toBeNull();
  expect(screen.getByText(/Your session is preserved/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await act(async () => mocks.observer!({ uid: 'one' } as User));
  expect(screen.getByText('Private application')).toBeTruthy();
});

it('ignores an old account bootstrap completion after account switching', async () => {
  let first!: () => void;
  mocks.repair.mockReturnValueOnce(new Promise<void>(resolve => { first = resolve; })).mockResolvedValueOnce(undefined);
  mount();
  act(() => mocks.observer!({ uid: 'one' } as User));
  await act(async () => mocks.observer!({ uid: 'two' } as User));
  expect(screen.getByText('Private application')).toBeTruthy();
  act(() => mocks.observer!(null));
  await act(async () => first());
  expect(mocks.repair.mock.calls.map(call => call[1].uid)).toEqual(['one', 'two']);
});

import ForumPage from '@/app/forum/page';
import { uiMessage } from '@/lib/i18n';
import { translations } from '@/lib/translations';
import { act,cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
const mocks = vi.hoisted(() => ({ write: vi.fn(), toast: vi.fn(), emit: vi.fn() }));
vi.mock('@/components/navigation', () => ({ default: () => null }));
vi.mock('@/components/feature-help', () => ({ default: () => null }));
vi.mock('@/components/activity-calendar', () => ({ default: () => null }));
vi.mock('@/components/quick-notes', () => ({ default: () => null }));
vi.mock('@/components/latex-toolbar', () => ({ LatexQuickToolbar: () => null }));
vi.mock('@/components/ui-text', () => ({ UiText: () => null }));
vi.mock('@/components/app-preferences', () => ({ useLanguageState: () => ['en', vi.fn()], useThemeState: () => ['light', vi.fn()] }));
vi.mock('@/firebase', () => ({ useUser: () => ({ user: { uid: 'author' } }), useFirestore: () => 'database' }));
vi.mock('@/firebase/firestore/use-user-notes', () => ({ useUserNotes: () => ({ notes: '', updateNotes: vi.fn() }) }));
vi.mock('@/firebase/error-emitter', () => ({ errorEmitter: { emit: mocks.emit } }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('firebase/firestore', () => ({
  limit: vi.fn(), where: vi.fn(), collection: () => 'posts', query: () => 'posts', orderBy: vi.fn(), serverTimestamp: () => 1, addDoc: mocks.write,
  onSnapshot: (_ref: unknown, callback: (snapshot: unknown) => void) => { callback({ docs: [], size: 0 }); return vi.fn(); },
}));
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);
function createDraft() {
  render(<ForumPage />);
  fireEvent.click(screen.getByRole('button', { name: translations.en.createPost }));
  fireEvent.change(screen.getByPlaceholderText(uiMessage('en', 'forum.enter_post_title')), { target: { value: 'My title' } });
  fireEvent.change(screen.getByPlaceholderText(translations.en.postContent), { target: { value: 'My draft' } });
}
it('waits for confirmation, blocks duplicate submissions, then closes the draft', async () => {
  let resolve!: () => void;
  mocks.write.mockReturnValue(new Promise<void>(done => { resolve = done; }));
  createDraft();
  const publish = screen.getByRole('button', { name: translations.en.publish });
  fireEvent.click(publish); fireEvent.click(publish);
  expect(screen.getByRole('dialog')).toBeTruthy();
  expect(mocks.write).toHaveBeenCalledTimes(1);
  expect(mocks.toast).not.toHaveBeenCalledWith({ title: uiMessage('en', 'forum.posted_successfully') });
  await act(async () => resolve());
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(mocks.toast).toHaveBeenCalledWith({ title: uiMessage('en', 'forum.posted_successfully') });
});
it('keeps the same draft and allows retry after a rejected write', async () => {
  mocks.write.mockRejectedValueOnce({ code: 'permission-denied' }).mockResolvedValueOnce(undefined);
  createDraft();
  fireEvent.click(screen.getByRole('button', { name: translations.en.publish }));
  await waitFor(() => expect(mocks.emit).toHaveBeenCalled());
  expect((screen.getByPlaceholderText(translations.en.postContent) as HTMLTextAreaElement).value).toBe('My draft');
  expect(mocks.toast).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: translations.en.publish }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(mocks.write).toHaveBeenCalledTimes(2);
});

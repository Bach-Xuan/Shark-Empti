import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import ForumPage from '@/app/forum/page';
import PostDetailPage from '@/app/forum/[postId]/page';
import { translations } from '@/lib/translations';
const mocks = vi.hoisted(() => ({ write: vi.fn(), emit: vi.fn(), toast: vi.fn(), router: { push: vi.fn() }, post: { id: 'post', authorId: 'author', authorName: 'Author', authorPhoto: '', title: 'Original title', content: 'Original post', subject: 'math', likesCount: 0, likedBy: [], commentsCount: 1 }, comment: { id: 'comment', authorId: 'author', authorName: 'Author', authorPhoto: '', content: 'Original comment', likesCount: 0, likedBy: [] } }));
vi.mock('@/components/navigation', () => ({ default: () => null }));
vi.mock('@/components/feature-help', () => ({ default: () => null }));
vi.mock('@/components/activity-calendar', () => ({ default: () => null }));
vi.mock('@/components/quick-notes', () => ({ default: () => null }));
vi.mock('@/components/latex-toolbar', () => ({ LatexQuickToolbar: () => null }));
vi.mock('@/components/ui-text', () => ({ UiText: () => null }));
vi.mock('@/components/app-preferences', () => ({ useLanguageState: () => ['en', vi.fn()], useThemeState: () => ['light', vi.fn()] }));
vi.mock('@/firebase', () => ({ useUser: () => ({ user: { uid: 'author' }, loading: false }), useFirestore: () => 'database' }));
vi.mock('@/firebase/firestore/use-user-notes', () => ({ useUserNotes: () => ({ notes: '', updateNotes: vi.fn() }) }));
vi.mock('@/firebase/error-emitter', () => ({ errorEmitter: { emit: mocks.emit } }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('next/navigation', () => ({ useRouter: () => mocks.router, useParams: () => ({ postId: 'post' }) }));
vi.mock('@/hooks/use-paged-collection', () => ({ usePagedCollection: (source: string) => ({ items: source?.includes('comments') ? [mocks.comment] : source?.includes('_forumDeletions') ? [] : [mocks.post], loading: false, hasMore: false, loadMore: vi.fn() }) }));
// Menu presentation is outside this regression; exercise the real page edit handlers.
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: () => null,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onSelect }: { children: ReactNode; onSelect: (event: { preventDefault: () => void }) => void }) => <button onClick={event => onSelect(event)}>{children}</button>,
}));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...p: string[]) => p.join('/'), doc: (_db: unknown, ...p: string[]) => ({ path: p.join('/') }), query: (source: string) => source,
  orderBy: vi.fn(), where: vi.fn(), serverTimestamp: () => 1, updateDoc: mocks.write,
  onSnapshot: (_ref: unknown, cb: (snapshot: unknown) => void) => { cb({ exists: () => true, id: 'post', data: () => mocks.post }); return vi.fn(); },
}));
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);
it.each(['list post', 'detail post', 'detail comment'])('%s retains a rejected edit, blocks duplicate writes and closes only after confirmed retry', async kind => {
  render(kind === 'list post' ? <ForumPage /> : <PostDetailPage />);
  fireEvent.click(screen.getAllByRole('button', { name: translations.en.edit })[kind === 'detail comment' ? 1 : 0]);
  const dialog = await screen.findByRole('dialog');
  const body = dialog.querySelector('textarea')!;
  fireEvent.change(body, { target: { value: 'Retained draft' } });
  const title = dialog.querySelector('input');
  if (title) fireEvent.change(title, { target: { value: 'Retained title' } });
  mocks.write.mockRejectedValueOnce(new Error('offline'));
  fireEvent.click(within(dialog).getByRole('button', { name: translations.en.update }));
  await waitFor(() => expect(mocks.emit).toHaveBeenCalledOnce());
  expect(body.value).toBe('Retained draft'); expect(mocks.toast).not.toHaveBeenCalled();
  if (title) expect(title.value).toBe('Retained title');
  let finish!: () => void;
  mocks.write.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
  const update = within(dialog).getByRole('button', { name: translations.en.update });
  fireEvent.click(update); fireEvent.click(update);
  expect(mocks.write).toHaveBeenCalledTimes(2); expect(screen.getByRole('dialog')).toBeTruthy();
  expect(mocks.write.mock.calls[1][1]).toMatchObject({ content: 'Retained draft' });
  await act(async () => finish());
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(mocks.toast).toHaveBeenCalledOnce();
});

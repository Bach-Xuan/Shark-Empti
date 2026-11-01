import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import ModerationPage from '@/app/moderation/page';

const mocks = vi.hoisted(() => ({ request: vi.fn(), user: { uid: 'moderator' } }));
vi.mock('@/firebase', () => ({ useUser: () => ({ user: mocks.user }) }));
vi.mock('@/components/app-preferences', () => ({ useLanguageState: () => ['en', vi.fn()] }));
vi.mock('@/lib/forum-client', () => ({ communityRequest: mocks.request }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const report = (id: string, status = 'open') => ({ id, status, target: { kind: 'post', id }, reason: 'Review ' + id, preview: '', hidden: status === 'hidden', exists: status === 'open' });

it('appends cursor pages and exposes a separately named hidden-report list', async () => {
  mocks.request.mockResolvedValueOnce({ reports: [report('one')], nextCursor: 'next-page' })
    .mockResolvedValueOnce({ reports: [report('two')], nextCursor: null })
    .mockResolvedValueOnce({ reports: [report('archived', 'hidden')], nextCursor: null });
  render(<ModerationPage />);
  await screen.findByText('Review one');
  fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
  await screen.findByText('Review two');
  expect(screen.getByText('Review one')).toBeTruthy();
  expect(mocks.request.mock.calls[1][1]).toContain('status=open&after=next-page');
  expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  fireEvent.change(screen.getByRole('combobox', { name: 'Report list' }), { target: { value: 'hidden' } });
  await screen.findByText('Review archived');
  expect(screen.queryByText('Review one')).toBeNull();
  expect(mocks.request.mock.calls[2][1]).toContain('status=hidden');
  expect(screen.getByRole('button', { name: 'Restore' })).toBeTruthy();
});

it('revokes an obsolete list request so a delayed response cannot replace the selected list', async () => {
  let complete!: (value: unknown) => void;
  mocks.request.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }))
    .mockResolvedValueOnce({ reports: [report('archived', 'hidden')], nextCursor: null });
  render(<ModerationPage />);
  await waitFor(() => expect(mocks.request).toHaveBeenCalledOnce());
  fireEvent.change(screen.getByRole('combobox', { name: 'Report list' }), { target: { value: 'hidden' } });
  await screen.findByText('Review archived');
  expect(mocks.request.mock.calls[0][4].aborted).toBe(true);
  await act(async () => complete({ reports: [report('obsolete')], nextCursor: 'old-cursor' }));
  expect(screen.queryByText('Review obsolete')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
});

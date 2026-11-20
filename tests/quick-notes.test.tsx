import QuickNotes from '@/components/quick-notes';
import { translations } from '@/lib/translations';
import { act,cleanup,fireEvent,render,screen } from '@testing-library/react';
import { afterEach,expect,it,vi } from 'vitest';
vi.mock('@/components/latex-toolbar', () => ({ LatexQuickToolbar: () => null }));
vi.mock('@/components/ui-text', () => ({ UiText: () => null }));
afterEach(cleanup);
it('keeps a dirty draft across snapshots and failed writes, closing only after success', async () => {
  let finish!: (success: boolean) => void;
  const save = vi.fn(() => new Promise<boolean>(resolve => { finish = resolve; }));
  const props = { t: translations.en, lang: 'en', notesReady: true, notesRevision: 1, onNotesChange: save };
  const view = render(<QuickNotes {...props} notes="original" />);
  fireEvent.click(screen.getByRole('button', { name: translations.en.personalNotes }));
  const input = screen.getByPlaceholderText(translations.en.notesPlaceholder) as HTMLTextAreaElement;
  fireEvent.change(input, { target: { value: 'unsaved draft' } });
  view.rerender(<QuickNotes {...props} notesRevision={2} notes="late remote snapshot" />);
  expect(input.value).toBe('unsaved draft');
  fireEvent.click(screen.getByRole('button', { name: translations.en.save }));
  expect(save).toHaveBeenCalledWith('unsaved draft', { content: 'original', revision: 1 });
  expect(input.disabled).toBe(true);
  expect(screen.getByRole('dialog')).toBeTruthy();
  await act(async () => finish(false));
  expect(input.value).toBe('unsaved draft');
  expect(input.disabled).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: translations.en.save }));
  await act(async () => finish(true));
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('discards unsaved edits on close and saves against the snapshot received while closed', async () => {
  const save = vi.fn().mockResolvedValue(true);
  const props = { t: translations.en, lang: 'en', notesReady: true, onNotesChange: save };
  const view = render(<QuickNotes {...props} notesRevision={1} notes="Original" />);
  const open = () => fireEvent.click(screen.getByRole('button', { name: translations.en.personalNotes }));
  open();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Discard me' } });
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
  view.rerender(<QuickNotes {...props} notesRevision={2} notes="New from dashboard" />);
  open();
  expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('New from dashboard');
  await act(async () => fireEvent.click(screen.getByRole('button', { name: translations.en.save })));
  expect(save).toHaveBeenCalledWith('New from dashboard', { content: 'New from dashboard', revision: 2 });
});

it('preserves the draft on conflict and checks the acknowledged version again on overwrite', async () => {
  const save = vi.fn().mockResolvedValueOnce({ content: 'Second', revision: 2 })
    .mockResolvedValueOnce({ content: 'Third', revision: 3 }).mockResolvedValue(true);
  render(<QuickNotes t={translations.en} lang="en" notesReady notes="First" notesRevision={1} onNotesChange={save} />);
  fireEvent.click(screen.getByRole('button', { name: translations.en.personalNotes }));
  const input = screen.getByRole('textbox') as HTMLTextAreaElement;
  fireEvent.change(input, { target: { value: 'My draft' } });
  const click = async (name: string) => act(async () => fireEvent.click(screen.getByRole('button', { name })));
  await click(translations.en.save);
  expect(input.value).toBe('My draft');
  await click('Overwrite latest note');
  expect(save).toHaveBeenLastCalledWith('My draft', { content: 'Second', revision: 2 });
  await click('Load latest note');
  expect(input.value).toBe('Third');
  await click(translations.en.save);
  expect(save).toHaveBeenLastCalledWith('Third', { content: 'Third', revision: 3 });
});

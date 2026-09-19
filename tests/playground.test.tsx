import PlaygroundView from '@/components/playground-view';
import { translations } from '@/lib/translations';
import { act,cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { afterEach,expect,it,vi } from 'vitest';
const mocks = vi.hoisted(() => ({ validate: vi.fn(), flashcards: vi.fn(), practice: vi.fn(), write: vi.fn() }));
vi.mock('@/ai/client-flows', () => ({ validateAcademicTopic: mocks.validate, generateFlashcards: mocks.flashcards, generatePractice: mocks.practice }));
vi.mock('@/firebase', () => ({ useUser: () => ({ user: { uid: 'first' } }), useFirestore: () => ({}) }));
vi.mock('firebase/firestore', () => ({ collection: () => ({ path: 'demo' }), doc: () => ({ path: 'demo' }), setDoc: mocks.write, addDoc: mocks.write }));
vi.mock('@/lib/error-toast', () => ({ showErrorToast: vi.fn(), showUnexpectedErrorToast: vi.fn() }));
vi.mock('@/components/feature-help', () => ({ default: () => null }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const weakPoints = [{ topicId: 'addition', topic: 'Addition', errorCount: 1, totalQuestions: 1, errorRate: 100, strengths: [], weaknesses: [], recommendations: [] }];
function view(tab: 'flashcards' | 'practice') {
  return render(<PlaygroundView t={translations.en} lang="en" weakPoints={weakPoints} totalAttempts={1} totalErrors={1} initialConfig={{ tab, concept: 'Addition' }} onAskGuru={() => {}} />);
}
for (const tab of ['flashcards', 'practice'] as const) {
  it(`${tab} unlocks validation after a recoverable failure`, async () => {
    mocks.validate.mockResolvedValue({ ok: false, error: { code: 'AI-TRANSPORT-FAILED' } });
    view(tab);
    const start = screen.getByRole('button', { name: tab === 'practice' ? translations.en.startPractice : translations.en.startLearning });
    fireEvent.click(start);
    await waitFor(() => expect(start.hasAttribute('disabled')).toBe(false));
    fireEvent.click(start);
    await waitFor(() => expect(mocks.validate).toHaveBeenCalledTimes(2));
  });
}
it('does not persist a flashcard response after its account subtree unmounts', async () => {
  mocks.validate.mockResolvedValue({ ok: true, data: { isValid: true } });
  let resolve!: (value: unknown) => void;
  mocks.flashcards.mockImplementation(() => new Promise(done => { resolve = done; }));
  const rendered = view('flashcards');
  fireEvent.click(screen.getByRole('button', { name: translations.en.startLearning }));
  await waitFor(() => expect(mocks.flashcards).toHaveBeenCalledTimes(1));
  rendered.unmount();
  await act(async () => { resolve({ ok: true, data: { cards: [{ front: '2+2', back: '4' }] } }); });
  expect(mocks.write).not.toHaveBeenCalled();
});

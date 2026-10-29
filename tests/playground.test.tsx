import PlaygroundView from '@/components/playground-view';
import { translations } from '@/lib/translations';
import { act,cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { afterEach,expect,it,vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { uiMessage } from '@/lib/i18n';
const mocks = vi.hoisted(() => ({ validate: vi.fn(), flashcards: vi.fn(), practice: vi.fn(), grade: vi.fn(), write: vi.fn() }));
vi.mock('@/ai/client-flows', () => ({ validateAcademicTopic: mocks.validate, generateFlashcards: mocks.flashcards, generatePractice: mocks.practice, shortAnswerAnalysis: mocks.grade }));
vi.mock('@/firebase', () => ({ useUser: () => ({ user: { uid: 'first' } }), useFirestore: () => ({}) }));
vi.mock('firebase/firestore', () => ({ collection: () => ({ path: 'demo' }), doc: () => ({ path: 'demo' }), setDoc: mocks.write, addDoc: mocks.write }));
vi.mock('@/lib/error-toast', () => ({ showErrorToast: vi.fn(), showUnexpectedErrorToast: vi.fn() }));
vi.mock('@/components/feature-help', () => ({ default: () => null }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const weakPoints = [{ topicId: 'addition', topic: 'Addition', errorCount: 1, totalQuestions: 1, errorRate: 100, strengths: [], weaknesses: [], recommendations: [] }];
it('flips a flashcard with Enter and Space, hiding the inactive face from assistive technology', async () => {
  mocks.validate.mockResolvedValue({ ok: true, data: { isValid: true } });
  mocks.flashcards.mockResolvedValue({ ok: true, data: { cards: [{ front: '2+2', back: '4' }] } });
  mocks.write.mockResolvedValue({ id: 'saved' });
  view('flashcards');
  fireEvent.click(screen.getByRole('button', { name: translations.en.startLearning }));
  const card = await screen.findByRole('button', { name: uiMessage('en', 'playgroundview.tap_to_reveal') });
  const keyboard = userEvent.setup();
  card.focus();
  await keyboard.keyboard('{Enter}');
  expect(card.getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByText('2+2').closest('[aria-hidden]')?.getAttribute('aria-hidden')).toBe('true');
  await keyboard.keyboard(' ');
  expect(card.getAttribute('aria-pressed')).toBe('false');
  await keyboard.tab();
  expect(document.activeElement).not.toBe(card);
  await keyboard.tab({ shift: true });
  expect(document.activeElement).toBe(card);
});
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

it.each(['en', 'vi'] as const)('semantically grades a supported free-text equivalent in %s before persisting', async lang => {
  mocks.validate.mockResolvedValue({ ok: true, data: { isValid: true } });
  mocks.practice.mockResolvedValue({ ok: true, data: { questions: [{ question: 'Define velocity', correct: 'Speed with direction', explanation: 'Velocity is a vector.', type: 'Short Answer' }] } });
  mocks.grade.mockResolvedValue({ ok: true, data: { isCorrect: true, confidence: 0.95, feedback: 'Equivalent answer' } });
  mocks.write.mockResolvedValue(undefined);
  render(<PlaygroundView t={translations[lang]} lang={lang} weakPoints={weakPoints} totalAttempts={1} totalErrors={1} initialConfig={{ tab: 'practice', concept: 'Velocity' }} onAskGuru={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: translations[lang].startPractice }));
  fireEvent.change(await screen.findByPlaceholderText(translations[lang].typeYourAnswer), { target: { value: lang === 'vi' ? 'Độ nhanh kèm hướng' : 'Rate of motion including direction' } });
  fireEvent.click(screen.getByRole('button', { name: translations[lang].submitAnswer }));
  await waitFor(() => expect(mocks.grade).toHaveBeenCalledTimes(1));
  fireEvent.click(await screen.findByRole('button', { name: /finish|results|hoàn|kết/i }));
  await waitFor(() => expect(mocks.write).toHaveBeenCalledTimes(1));
  expect(mocks.write.mock.calls[0][1].userAnswers[0].isCorrect).toBe(true);
  expect(mocks.grade.mock.calls[0][0].language).toBe(lang);
});
it('preserves uncertain answers without saving a false mistake, then permits retry', async () => {
  mocks.validate.mockResolvedValue({ ok: true, data: { isValid: true } });
  mocks.practice.mockResolvedValue({ ok: true, data: { questions: [{ question: 'Define velocity', correct: 'Speed with direction', explanation: 'Vector', type: 'Short Answer' }] } });
  mocks.grade.mockResolvedValueOnce({ ok: true, data: { isCorrect: false, confidence: 0.2 } }).mockResolvedValueOnce({ ok: true, data: { isCorrect: true, confidence: 0.95 } });
  view('practice'); fireEvent.click(screen.getByRole('button', { name: translations.en.startPractice }));
  const input = await screen.findByPlaceholderText(translations.en.typeYourAnswer);
  fireEvent.change(input, { target: { value: 'Motion with a direction' } });
  fireEvent.click(screen.getByRole('button', { name: translations.en.submitAnswer }));
  expect((await screen.findByRole('alert')).textContent).toContain('not been marked wrong');
  expect((input as HTMLInputElement).value).toBe('Motion with a direction');
  expect(mocks.write).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: translations.en.submitAnswer }));
  await waitFor(() => expect(mocks.grade).toHaveBeenCalledTimes(2));
});

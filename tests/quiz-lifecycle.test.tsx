import QuizView from '@/components/quiz-view';
import { translations } from '@/lib/translations';
import { act,cleanup,fireEvent,render,screen } from '@testing-library/react';
import { afterEach,expect,it,vi } from 'vitest';
const mocks = vi.hoisted(() => ({ generate: vi.fn(), feedback: vi.fn(async () => ({ ok: false, error: { code: 'AI-INVALID-RESPONSE' } })) }));
vi.mock('@/ai/client-flows', () => ({ generateQuestions: mocks.generate, personalizedQuizPerformanceFeedback: mocks.feedback, shortAnswerAnalysis: vi.fn() }));
vi.mock('@/lib/error-toast', () => ({ showErrorToast: vi.fn(), showUnexpectedErrorToast: vi.fn() }));
const config = { subject: 'math', grade: 'none', topic: 'Addition', type: 'Multiple Choice', difficulty: 'Easy', numQuestions: '1', timeLimit: '1' };
const questions = [{ question: '2+2?', options: ['4', '3'], correct: '4', explanation: 'Addition', type: 'Multiple Choice', difficulty: 'Easy' }];
afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); });
it('finishes a timed quiz only once even as timer/effects rerender', async () => {
  vi.useFakeTimers(); const finish = vi.fn().mockResolvedValue(true);
  render(<QuizView t={translations.en} lang="en" config={config} initialQuestions={questions} onFinish={finish} onAskGuru={() => {}} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(61_000); });
  await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
  expect(finish).toHaveBeenCalledTimes(1);
  expect(mocks.feedback).toHaveBeenCalledTimes(1);
});
it('keeps current question and answers when UI language changes', () => {
  const props = { config, initialQuestions: questions, onFinish: vi.fn().mockResolvedValue(true), onAskGuru: () => {} };
  const view = render(<QuizView {...props} t={translations.en} lang="en" />);
  fireEvent.click(screen.getByRole('button', { name: '4' }));
  view.rerender(<QuizView {...props} t={translations.vi} lang="vi" />);
  expect(screen.getByRole('button', { name: '4' }).hasAttribute('disabled')).toBe(true);
  expect(mocks.generate).not.toHaveBeenCalled();
});

it.each([false, true])('enforces the answer limit before accepting quiz input (Arena = %s)', async blindAnswers => {
  const bank = [{ ...questions[0], type: 'Short Answer', correct: '4' }];
  render(<QuizView t={translations.en} lang="en" config={config} initialQuestions={bank} blindAnswers={blindAnswers} onFinish={vi.fn()} onAskGuru={() => {}} />);
  const input = screen.getByRole('textbox') as HTMLInputElement;
  expect(input.maxLength).toBe(2000);
  const submit = screen.getByRole('button', { name: translations.en.submitAnswer });
  fireEvent.change(input, { target: { value: '4'.repeat(2001) } });
  fireEvent.click(submit);
  expect(input.disabled).toBe(false);
  fireEvent.change(input, { target: { value: '4' } });
  fireEvent.click(submit);
  expect(screen.queryByRole('button', { name: translations.en.submitAnswer })).toBeNull();
});

it('gives the learner the full time limit after slow question generation', async () => {
  vi.useFakeTimers();
  let release!: () => void;
  mocks.generate.mockImplementationOnce(() => new Promise(resolve => { release = () => resolve({ ok: true, data: { questions } }); }));
  const finish = vi.fn().mockResolvedValue(true);
  render(<QuizView t={translations.en} lang="en" config={config} initialQuestions={null} onFinish={finish} onAskGuru={() => {}} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(61_000); release(); });
  await act(async () => { await vi.advanceTimersByTimeAsync(59_000); });
  expect(finish).not.toHaveBeenCalled();
  await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
  expect(finish).toHaveBeenCalledOnce();
});

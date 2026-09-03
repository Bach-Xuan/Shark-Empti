import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import QuizView from '@/components/quiz-view';
import { translations } from '@/lib/translations';
const mocks = vi.hoisted(() => ({ generate: vi.fn(), feedback: vi.fn(async () => ({ ok: false, error: { code: 'AI-INVALID-RESPONSE' } })) }));
vi.mock('@/ai/flows/generate-questions-flow', () => ({ generateQuestions: mocks.generate }));
vi.mock('@/ai/flows/personalized-quiz-feedback-flow', () => ({ personalizedQuizPerformanceFeedback: mocks.feedback }));
vi.mock('@/ai/flows/short-answer-analysis-flow', () => ({ shortAnswerAnalysis: vi.fn() }));
vi.mock('@/lib/error-toast', () => ({ showErrorToast: vi.fn(), showUnexpectedErrorToast: vi.fn() }));
const config = { subject: 'math', grade: 'none', topic: 'Addition', type: 'Multiple Choice', difficulty: 'Easy', numQuestions: '1', timeLimit: '1' };
const questions = [{ question: '2+2?', options: ['4', '3'], correct: '4', explanation: 'Addition', type: 'Multiple Choice', difficulty: 'Easy' }];
afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); });
it('finishes a timed quiz only once even as timer/effects rerender', async () => {
  vi.useFakeTimers(); const finish = vi.fn();
  render(<QuizView t={translations.en} lang="en" config={config} initialQuestions={questions} onFinish={finish} onAskGuru={() => {}} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(61_000); });
  await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
  expect(finish).toHaveBeenCalledTimes(1);
  expect(mocks.feedback).toHaveBeenCalledTimes(1);
});
it('keeps current question and answers when UI language changes', () => {
  const props = { config, initialQuestions: questions, onFinish: vi.fn(), onAskGuru: () => {} };
  const view = render(<QuizView {...props} t={translations.en} lang="en" />);
  fireEvent.click(screen.getByRole('button', { name: '4' }));
  view.rerender(<QuizView {...props} t={translations.vi} lang="vi" />);
  expect(screen.getByRole('button', { name: '4' }).hasAttribute('disabled')).toBe(true);
  expect(mocks.generate).not.toHaveBeenCalled();
});

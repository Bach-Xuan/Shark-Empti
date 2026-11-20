import AiChatbot from '@/components/ai-chatbot';
import { translations } from '@/lib/translations';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { history } from './fixtures/quiz';

const coach = vi.hoisted(() => vi.fn());
vi.mock('@/ai/client-flows', () => ({ aiCoachingChatbotForQuizReview: coach }));
vi.mock('@/lib/error-toast', () => ({ showErrorToast: vi.fn() }));
afterEach(() => { cleanup(); localStorage.clear(); coach.mockReset(); });

it('recalls a successful exchange after eviction, excludes failed turns and resets on a new quiz', async () => {
  const props = { sessionId: "first", results: history, trigger: null, lang: 'en', t: translations.en };
  const view = render(<AiChatbot {...props} />);
  async function send(message: string, reply: string | null) {
    coach.mockResolvedValueOnce(reply === null ? { ok: false, error: { code: 'AI-UNAVAILABLE' } }
      : { ok: true, data: { aiResponse: reply } });
    const box = screen.getByRole('textbox');
    fireEvent.change(box, { target: { value: message } });
    await act(async () => fireEvent.keyDown(box, { key: 'Enter' }));
    return coach.mock.lastCall![0].chatHistory;
  }
  await send('First question', 'Original detail');
  await send('Only failed text', null);
  await send('Long answer please', 'x'.repeat(70_000));
  // The long pair cannot fit in the quiz history allocation; the old implementation forgot both pairs here.
  expect(await send('New subject', 'Recent explanation. '.repeat(12))).toEqual([]);
  const recalled = await send('Explain “Original detail”', 'Here is why.');
  expect(recalled).toEqual([{ role: 'user', message: 'First question' }, { role: 'model', message: 'Original detail' }]);
  const ordinary = await send('Continue', 'OK');
  expect(ordinary[0].message).toBe('New subject');
  expect(ordinary.some((turn: { message: string }) => turn.message === 'Only failed text')).toBe(false);
  view.rerender(<AiChatbot {...props} sessionId="second" results={{ ...history, totalTime: 2 }} />);
  expect(await send('Explain “Original detail”', 'New quiz')).toEqual([]);
});

it('preserves pending coaching across feedback recovery and ignores a late reply from another attempt', async () => {
  const props = { results: history, trigger: null, lang: 'en', t: translations.en, sessionId: 'first' };
  const view = render(<AiChatbot {...props} />);
  const submit = (message: string) => {
    const box = screen.getByRole('textbox');
    fireEvent.change(box, { target: { value: message } });
    fireEvent.keyDown(box, { key: 'Enter' });
  };
  const pending = () => {
    let finish!: (answer: string) => void;
    coach.mockImplementationOnce(() => new Promise(resolve => {
      finish = answer => resolve({ ok: true, data: { aiResponse: answer } });
    }));
    return (answer: string) => act(async () => finish(answer));
  };
  const first = pending();
  submit('First question');
  const firstSignal = coach.mock.lastCall![1].signal;
  view.rerender(<AiChatbot {...props} results={{ ...history, config: { ...history.config, topicEn: 'Recovered' } }} />);
  expect(firstSignal.aborted).toBe(false);
  await first('First reply');
  const second = pending();
  submit('Follow up');
  expect(coach.mock.lastCall![0].chatHistory.map((turn: { message: string }) => turn.message)).toEqual(['First question', 'First reply']);
  const secondSignal = coach.mock.lastCall![1].signal;
  const nextResults = { ...history, quizResults: [{ ...history.quizResults[0], question: 'Next quiz question?' }] };
  view.rerender(<AiChatbot {...props} sessionId="second" results={nextResults} lang="vi" t={translations.vi} />);
  expect(secondSignal.aborted).toBe(true);
  expect(screen.getByRole('log').textContent).toBe(translations.vi.botIntro);
  await second('Stale reply');
  expect(screen.queryByText('Stale reply')).toBeNull();
  coach.mockResolvedValueOnce({ ok: true, data: { aiResponse: 'OK' } });
  await act(async () => submit('New attempt'));
  expect(coach.mock.lastCall![0].chatHistory).toEqual([]);
  expect(coach.mock.lastCall![0].quizQuestions.map((item: { questionText: string }) => item.questionText)).toEqual(['Next quiz question?']);
});

it('does not resend a question opened from quiz feedback when the attempt changes', async () => {
  coach.mockResolvedValue({ ok: true, data: { aiResponse: 'Feedback explanation' } });
  const props = { sessionId: 'first', results: null, trigger: { message: 'Explain this answer', timestamp: 1 },
    lang: 'en', t: translations.en };
  const view = render(<AiChatbot {...props} />);
  await screen.findByText('Feedback explanation');
  view.rerender(<AiChatbot {...props} sessionId="second" />);
  expect(screen.getByRole('log').textContent).toBe(translations.en.botIntro);
  expect(coach).toHaveBeenCalledTimes(1);
});

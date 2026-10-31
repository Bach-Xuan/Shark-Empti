import ResultView from '@/components/result-view';
import { translations } from '@/lib/translations';
import { uiMessage } from '@/lib/i18n';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { analysis, history } from './fixtures/quiz';

const mocks = vi.hoisted(() => ({ feedback: vi.fn() }));
vi.mock('@/ai/client-flows', () => ({ personalizedQuizPerformanceFeedback: mocks.feedback }));
vi.mock('@/components/ui-text', () => ({ UiText: () => null }));
vi.mock('@/lib/error-toast', () => ({ showErrorToast: vi.fn(), showUnexpectedErrorToast: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('retries persistence of recovered feedback without requesting another generation', async () => {
  const feedback = { ...analysis, topicEn: 'Addition', topicVi: 'Phép cộng' };
  mocks.feedback.mockResolvedValue({ ok: true, data: feedback });
  const recover = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  const { analysis: _analysis, ...results } = history;
  void _analysis;
  render(<ResultView t={translations.en} lang="en" results={results} onRecoverAnalysis={recover}
    onRetakeNew={() => undefined} onRetakeSame={() => undefined} onViewDashboard={() => undefined} />);
  const retry = await screen.findByRole('button', { name: uiMessage('en', 'resultview.retry') });
  expect(mocks.feedback).toHaveBeenCalledTimes(1);
  fireEvent.click(retry);
  await waitFor(() => expect(recover).toHaveBeenCalledTimes(2));
  expect(recover).toHaveBeenLastCalledWith(feedback);
  expect(mocks.feedback).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(screen.queryByRole('button', { name: uiMessage('en', 'resultview.retry') })).toBeNull());
});

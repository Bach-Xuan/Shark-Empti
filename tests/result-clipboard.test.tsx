import ResultView from '@/components/result-view';
import { translations } from '@/lib/translations';
import { cleanup,fireEvent,render,waitFor } from '@testing-library/react';
import { afterEach,expect,it,vi } from 'vitest';
import { history } from './fixtures/quiz';
const mocks = vi.hoisted(() => ({ error: vi.fn(), toast: vi.fn() }));
vi.mock('@/ai/flows/personalized-quiz-feedback-flow', () => ({ personalizedQuizPerformanceFeedback: vi.fn() }));
vi.mock('@/components/ui-text', () => ({ UiText: () => null }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/lib/error-toast', () => ({ showErrorToast: vi.fn(), showUnexpectedErrorToast: mocks.error }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('shows a recoverable error when clipboard is unavailable', async () => {
  const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
  try {
    const { container } = render(<ResultView t={translations.en} lang="en" results={history} onRetakeNew={() => {}} onRetakeSame={() => {}} onViewDashboard={() => {}} />);
    fireEvent.click(container.querySelector('svg.lucide-copy')!.closest('button')!);
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('APP-CLIPBOARD-FAILED', '', {}, 'en'));
    expect(mocks.toast).not.toHaveBeenCalled();
  } finally {
    if (original) Object.defineProperty(navigator, 'clipboard', original);
    else Reflect.deleteProperty(navigator, 'clipboard');
  }
});

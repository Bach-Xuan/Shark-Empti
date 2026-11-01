import ArenaDetailPage from '@/app/arena/[examId]/page';
import { act,cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { analysis,history,question } from './fixtures/quiz';
const mocks = vi.hoisted(() => ({
  user: { uid: 'player', getIdToken: async () => 'fixture' } as { uid: string; getIdToken: () => Promise<string> } | null,
  feedback: vi.fn(), toast: vi.fn(), push: vi.fn(), request: vi.fn(),
}));
vi.mock('@/components/navigation', () => ({ default: () => null }));
vi.mock('@/components/ui-text', () => ({ UiText: () => null }));
vi.mock('@/components/app-preferences', () => ({ useLanguageState: () => ['en', vi.fn()], useThemeState: () => ['light', vi.fn()] }));
vi.mock('@/firebase', () => ({ useUser: () => ({ user: mocks.user, loading: false }), useFirestore: () => 'database' }));
vi.mock('@/firebase/firestore/use-doc', () => ({ useDoc: () => ({ data: null, loading: false, error: null, retry: vi.fn() }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/lib/error-toast', () => ({ showErrorToast: vi.fn(), showUnexpectedErrorToast: vi.fn() }));
const router = { push: mocks.push };
vi.mock('next/navigation', () => ({ useParams: () => ({ examId: 'exam' }), useRouter: () => router }));
vi.mock('firebase/firestore', () => ({
  doc: () => 'exam', collection: () => 'attempts', query: () => 'attempts', orderBy: vi.fn(), limit: vi.fn(), where: vi.fn(), documentId: () => '__name__',
  onSnapshot: (ref: string, callback: (snapshot: unknown) => void) => {
    callback(ref === 'exam' ? { id: 'exam', exists: () => true, data: () => ({ schemaVersion: 2, questionCount: 1, title: 'Test exam', authorId: 'author', createdAt: null, config: history.config, totalAttempts: 0 }) } : { docs: [] });
    return vi.fn();
  },
}));
vi.mock('@/ai/client-flows', () => ({ generateQuestions: vi.fn(), shortAnswerAnalysis: vi.fn(), personalizedQuizPerformanceFeedback: mocks.feedback }));
beforeEach(() => {
  vi.clearAllMocks(); mocks.user = { uid: 'player', getIdToken: async () => 'fixture' };
  mocks.feedback.mockResolvedValue({ ok: true, data: analysis });
  mocks.request.mockImplementation(async () => new Response(JSON.stringify({ coinsAwarded: 100, isFirstAttempt: false, reviewResults: history.quizResults, duration: 1 })));
  vi.stubGlobal('fetch', (url: string, init: RequestInit) => url.endsWith('/start') ? Promise.resolve(new Response(JSON.stringify({ ...JSON.parse(init.body as string), startedAtMs: Date.now(), questions: [{ ...question, correct: undefined, explanation: undefined }] }))) : mocks.request(url, init));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('requests feedback only once, after server grading rather than during the blind attempt', async () => {
  render(<ArenaDetailPage />);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Start Challenge/i })); });
  fireEvent.click(screen.getByRole('button', { name: '4' }));
  expect(screen.queryByRole('button', { name: /Ask Shark Guru/i })).toBeNull();
  expect(mocks.feedback).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /finish|results/i }));
  await screen.findByRole('heading', { name: /100%/ });
  await act(async () => {});
  expect(mocks.feedback).toHaveBeenCalledTimes(1);
  expect(mocks.request).toHaveBeenCalledTimes(1);
});
it('directs a guest to login before a challenge starts', async () => {
  mocks.user = null;
  render(<ArenaDetailPage />);
  fireEvent.click(await screen.findByRole('button', { name: /Sign in to start/i }));
  expect(mocks.push).toHaveBeenCalledWith('/login');
  expect(screen.queryByRole('button', { name: '4' })).toBeNull();
  expect(mocks.feedback).not.toHaveBeenCalled();
});
it('discards the active challenge if authentication disappears before saving', async () => {
  const view = render(<ArenaDetailPage />);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Start Challenge/i })); });
  mocks.user = null; view.rerender(<ArenaDetailPage />);
  await waitFor(() => expect(screen.getByRole('button', { name: /Sign in to start/i })).toBeTruthy());
  expect(screen.queryByRole('button', { name: '4' })).toBeNull();
  expect(mocks.request).not.toHaveBeenCalled();
});

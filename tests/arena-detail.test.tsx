import ArenaDetailPage from '@/app/arena/[examId]/page';
import { arenaResponseError } from '@/lib/arena-detail';
import { act,cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { history,question } from './fixtures/quiz';

type Listener = { ref: string; next: (snapshot: unknown) => void; error: (error: unknown) => void; stop: ReturnType<typeof vi.fn> };
const mocks = vi.hoisted(() => ({
  user: { uid: 'player', getIdToken: async () => 'fixture' } as { uid: string; getIdToken: () => Promise<string> } | null,
  lang: 'en' as 'en' | 'vi', examId: 'exam', db: 'database' as string | null, listeners: [] as Listener[], initialError: '' as string, holdSnapshot: false,
  request: vi.fn(), toast: vi.fn(), errorToast: vi.fn(), push: vi.fn(), chat: vi.fn(),
  finish: null as null | ((result: typeof history) => Promise<boolean>),
}));
vi.mock('@/components/navigation', () => ({ default: () => null }));
vi.mock('@/components/ui-text', () => ({ UiText: () => null }));
vi.mock('@/components/app-preferences', () => ({ useLanguageState: () => [mocks.lang, vi.fn()], useThemeState: () => ['light', vi.fn()] }));
vi.mock('@/firebase', () => ({ useUser: () => ({ user: mocks.user, loading: false }), useFirestore: () => mocks.db }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/lib/error-toast', () => ({ showErrorToast: mocks.errorToast, showUnexpectedErrorToast: vi.fn() }));
const router = { push: mocks.push };
vi.mock('next/navigation', () => ({ useParams: () => ({ examId: mocks.examId }), useRouter: () => router }));
vi.mock('firebase/firestore', () => ({
  doc: () => 'exam', collection: () => 'attempts', query: () => 'attempts', orderBy: vi.fn(), limit: vi.fn(),
  onSnapshot: (ref: string, next: Listener['next'], error: Listener['error']) => {
    const stop = vi.fn(); mocks.listeners.push({ ref, next, error, stop });
    if (mocks.initialError === ref) error({ code: 'permission-denied', message: 'secret SDK message' });
    else if (!mocks.holdSnapshot) next(ref === 'exam' ? examSnapshot() : { docs: [] });
    return stop;
  },
}));
vi.mock('@/components/quiz-view', () => ({ default: (props: { onFinish: NonNullable<typeof mocks.finish>; askGuruDisabledReason?: string }) => {
  mocks.finish = props.onFinish;
  return <button disabled={!!props.askGuruDisabledReason}>Mock Guru</button>;
} }));
vi.mock('@/components/result-view', () => ({ default: (props: { onRetakeSame: () => void; onRetakeNew: () => void }) => <div>
  <button onClick={props.onRetakeSame}>Retake same</button><button onClick={props.onRetakeNew}>Retake new</button>
</div> }));
vi.mock('@/ai/client-flows', () => ({ aiCoachingChatbotForQuizReview: mocks.chat }));

function examSnapshot(data: unknown = { title: 'Test exam', authorId: 'author', createdAt: null, config: history.config, questions: [question], totalAttempts: 0 }) {
  return { id: mocks.examId, exists: () => true, data: () => data };
}
function receipt() { return new Response(JSON.stringify({ coinsAwarded: 100, isFirstAttempt: false })); }
async function start() { fireEvent.click(await screen.findByRole('button', { name: /Start Challenge|Bắt đầu/i })); }
async function finish(result = history) { let saved = false; await act(async () => { saved = await mocks.finish!(result); }); return saved; }
function listener(ref: string) { return mocks.listeners.filter(item => item.ref === ref).at(-1)!; }
beforeEach(() => {
  vi.clearAllMocks(); mocks.listeners = []; mocks.initialError = ''; mocks.lang = 'en'; mocks.examId = 'exam'; mocks.finish = null; mocks.db = 'database'; mocks.holdSnapshot = false;
  mocks.user = { uid: 'player', getIdToken: async () => 'fixture' };
  mocks.request.mockImplementation(async () => receipt());
  mocks.chat.mockResolvedValue({ ok: true, data: { aiResponse: 'Review explanation' } });
  localStorage.clear(); vi.stubGlobal('fetch', mocks.request);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('freezes ID, answers and duration for retry, suppresses concurrent saves, and gives every retake a new ID', async () => {
  render(<ArenaDetailPage />); await start();
  let reject!: (error: Error) => void;
  mocks.request.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
  let first!: Promise<boolean>;
  await act(async () => { first = mocks.finish!(history); });
  expect(await finish()).toBe(false);
  expect(mocks.request).toHaveBeenCalledTimes(1);
  await act(async () => { reject(new Error('disconnected')); await first; });
  expect(await finish({ ...history, totalTime: 99, quizResults: [{ ...history.quizResults[0], userAnswer: '3' }] })).toBe(true);
  expect(mocks.request.mock.calls[1][1].body).toBe(mocks.request.mock.calls[0][1].body);
  expect(JSON.parse(mocks.request.mock.calls[1][1].body).duration).toBe(1);
  fireEvent.click(screen.getByRole('button', { name: 'Retake same' })); await finish();
  fireEvent.click(screen.getByRole('button', { name: 'Retake new' })); await finish();
  expect(new Set([0, 2, 3].map(index => JSON.parse(mocks.request.mock.calls[index][1].body).requestId)).size).toBe(3);
});

it.each(['account', 'exam', 'unmount'] as const)('ignores a late submission after %s changes', async change => {
  const view = render(<ArenaDetailPage />); await start();
  let resolve!: (response: Response) => void;
  mocks.request.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  let pending!: Promise<boolean>;
  await act(async () => { pending = mocks.finish!(history); });
  if (change === 'account') mocks.user = { uid: 'other', getIdToken: async () => 'new-token' };
  if (change === 'exam') mocks.examId = 'other-exam';
  if (change === 'unmount') view.unmount(); else view.rerender(<ArenaDetailPage />);
  expect(mocks.request.mock.calls[0][1].signal.aborted).toBe(true);
  await act(async () => { resolve(receipt()); expect(await pending).toBe(false); });
  expect(screen.queryByRole('button', { name: 'Retake same' })).toBeNull();
  expect(mocks.toast).not.toHaveBeenCalled(); expect(mocks.errorToast).not.toHaveBeenCalled();
});

it('does not start a request after account change while obtaining a token', async () => {
  let resolve!: (token: string) => void;
  mocks.user!.getIdToken = () => new Promise(done => { resolve = done; });
  const view = render(<ArenaDetailPage />); await start();
  let pending!: Promise<boolean>; await act(async () => { pending = mocks.finish!(history); });
  mocks.user = null; view.rerender(<ArenaDetailPage />);
  await act(async () => { resolve('old-token'); expect(await pending).toBe(false); });
  expect(mocks.request).not.toHaveBeenCalled();
});

it.each([['auth/user-token-expired', 'AUTH-INVALID'], ['auth/network-request-failed', 'APP-NETWORK']])('classifies token failure %s without exposing SDK text', async (code, expected) => {
  mocks.user!.getIdToken = async () => { throw { code, message: 'private auth context' }; };
  render(<ArenaDetailPage />); await start();
  expect(await finish()).toBe(false);
  expect(mocks.errorToast).toHaveBeenCalledWith({ code: expected, message: '', values: {} }, 'en');
  expect(mocks.request).not.toHaveBeenCalled();
});

it.each(['en', 'vi'] as const)('preserves safe server diagnostics in %s', async lang => {
  const view = render(<ArenaDetailPage />); await start(); mocks.lang = lang; view.rerender(<ArenaDetailPage />);
  mocks.request.mockResolvedValueOnce(new Response(JSON.stringify({ code: 'APP-REQUEST-CONFLICT', error: 'secret raw text', values: { retryAfterSeconds: 5, operation: 'arena-submit', secret: 'hidden' } }), { status: 409 }));
  expect(await finish()).toBe(false);
  expect(mocks.errorToast).toHaveBeenCalledWith({ code: 'APP-REQUEST-CONFLICT', message: '', values: { retryAfterSeconds: 5, operation: 'arena-submit', httpStatus: 409 } }, lang);
});

it.each([
  ['AUTH-INVALID', 401], ['APP-PERMISSION-DENIED', 403], ['APP-REQUEST-CONFLICT', 409],
  ['ARENA-LEGACY-EXAM', 409], ['APP-CONFIG-MISSING', 503], ['APP-UNAVAILABLE', 503],
] as const)('retains the server code %s for a recoverable failed submission', async (code, status) => {
  render(<ArenaDetailPage />); await start();
  mocks.request.mockResolvedValueOnce(new Response(JSON.stringify({ code, error: 'raw message', values: {} }), { status }));
  expect(await finish()).toBe(false);
  expect(mocks.errorToast).toHaveBeenCalledWith({ code, message: '', values: { httpStatus: status } }, 'en');
  expect(await finish()).toBe(true);
  expect(mocks.request.mock.calls[0][1].body).toBe(mocks.request.mock.calls[1][1].body);
});

it.each(['not JSON', '{}', '{"coinsAwarded":"100","isFirstAttempt":false}', '{"coinsAwarded":-5,"isFirstAttempt":false}'])('rejects malformed submit success %s without rewards or results', async body => {
  render(<ArenaDetailPage />); await start();
  mocks.request.mockResolvedValueOnce(new Response(body));
  expect(await finish()).toBe(false);
  expect(mocks.errorToast).toHaveBeenCalledWith({ code: 'APP-DATA-INVALID', message: '', values: {} }, 'en');
  expect(screen.queryByRole('button', { name: 'Retake same' })).toBeNull();
});

it('presents a missing exam as a recoverable error', async () => {
  render(<ArenaDetailPage />);
  act(() => listener('exam').next({ exists: () => false }));
  expect(screen.getByRole('alert').textContent).toContain('ARENA-NOT-FOUND');
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByRole('button', { name: /Start Challenge/i })).toBeTruthy();
});

it.each(['exam', 'attempts'])('recovers an initial %s subscription error with a fresh listener', async ref => {
  mocks.initialError = ref; render(<ArenaDetailPage />);
  expect((await screen.findByRole('alert')).textContent).toContain('APP-PERMISSION-DENIED');
  expect(screen.queryByText('secret SDK message')).toBeNull();
  const old = listener(ref); mocks.initialError = ''; fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(old.stop).toHaveBeenCalled());
  expect(listener(ref)).not.toBe(old); expect(screen.queryByRole('alert')).toBeNull();
  act(() => old.error({ code: 'unavailable' })); expect(screen.queryByRole('alert')).toBeNull();
});

it.each(['en', 'vi'] as const)('shows localized terminal subscription errors and retry in %s', async lang => {
  mocks.lang = lang; render(<ArenaDetailPage />);
  act(() => listener('attempts').error({ code: 'unavailable' }));
  expect(screen.getByRole('alert').textContent).toContain(lang === 'en' ? 'Connection interrupted' : 'Kết nối bị gián đoạn');
  fireEvent.click(screen.getByRole('button', { name: lang === 'en' ? 'Retry' : 'Thử lại' }));
  expect(screen.queryByRole('alert')).toBeNull();
  act(() => listener('exam').error({ code: 'permission-denied' }));
  expect(screen.getByRole('alert').textContent).toContain(lang === 'en' ? 'permission' : 'quyền');
});

it('rejects malformed persisted exam and leaderboard data without rendering it', async () => {
  render(<ArenaDetailPage />);
  act(() => listener('attempts').next({ docs: [{ id: 'bad', data: () => ({ userName: {}, score: 'bad' }) }] }));
  expect(screen.getByRole('alert').textContent).toContain('ARENA-DATA-INVALID');
  act(() => listener('exam').next(examSnapshot({ title: 'broken' })));
  expect(screen.queryByRole('button', { name: /Start Challenge/i })).toBeNull();
  expect(screen.getByRole('alert').textContent).toContain('ARENA-DATA-INVALID');
});

it('keeps a stale exam disabled until the retried subscription delivers a valid snapshot', async () => {
  render(<ArenaDetailPage />);
  act(() => listener('exam').error({ code: 'unavailable' }));
  mocks.holdSnapshot = true;
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect((screen.getByRole('button', { name: /Start Challenge/i }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole('alert')).toBeTruthy();
  act(() => listener('exam').next(examSnapshot()));
  expect((screen.getByRole('button', { name: /Start Challenge/i }) as HTMLButtonElement).disabled).toBe(false);
  expect(screen.queryByRole('alert')).toBeNull();
});

it.each(['db', 'examId'] as const)('shows a recoverable error when %s is missing', async missing => {
  if (missing === 'db') mocks.db = null; else mocks.examId = '';
  render(<ArenaDetailPage />);
  expect(screen.getByRole('alert').textContent).toContain(missing === 'db' ? 'APP-CONFIG-MISSING' : 'APP-INVALID-INPUT');
  expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
});

it('disables competitive Guru and enables the existing chatbot with completed review context', async () => {
  render(<ArenaDetailPage />); await start();
  expect((screen.getByRole('button', { name: 'Mock Guru' }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole('note').textContent).toContain('after you finish');
  expect(screen.queryByRole('textbox')).toBeNull(); await finish();
  const input = screen.getByRole('textbox'); fireEvent.change(input, { target: { value: 'Explain my answer' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  await waitFor(() => expect(mocks.chat).toHaveBeenCalledTimes(1));
  expect(JSON.stringify(mocks.chat.mock.calls[0])).toContain('2+2?');
  expect(await screen.findByText('Review explanation')).toBeTruthy();
});

it('does not expose arbitrary payload messages or sensitive diagnostic values', () => {
  expect(arenaResponseError({ code: 'APP-CONFIG-MISSING', error: 'secret', values: { operation: 'Bearer token', lastFailure: 'https://private', providerCode: 'sk-secret', retryAfterSeconds: 3 } }, 503)).toEqual({ code: 'APP-CONFIG-MISSING', message: '', values: { retryAfterSeconds: 3, httpStatus: 503 } });
});

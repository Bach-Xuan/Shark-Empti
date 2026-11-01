import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useLearningSession } from '@/hooks/use-learning-session';
import { history, analysis } from './fixtures/quiz';
const mocks = vi.hoisted(() => ({ write: vi.fn(), feedback: vi.fn(), emit: vi.fn() }));
vi.mock('@/lib/learning-client', () => ({ writeLearningRecord: mocks.write, saveHistoryFeedback: mocks.feedback }));
vi.mock('@/firebase/error-emitter', () => ({ errorEmitter: { emit: mocks.emit } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const user = { uid: 'learner', getIdToken: vi.fn() };
beforeEach(() => { sessionStorage.clear(); vi.resetAllMocks(); });
it('freezes the entire creation payload across a locale change and excludes reader metadata', async () => {
 const { result, rerender } = renderHook(({ lang }: { lang: 'en' | 'vi' }) => useLearningSession(user, lang), { initialProps: { lang: 'en' as 'en' | 'vi' } });
 act(() => result.current.start(history.config, history.quizResults));
 mocks.write.mockRejectedValueOnce({ code: 'APP-UNAVAILABLE' }).mockResolvedValueOnce(undefined);
 await act(async () => expect(await result.current.finish({ ...history, id: 'draft-completion' })).toBe(false));
 const first = mocks.write.mock.calls[0][3];
 expect(first).not.toHaveProperty('id'); expect(first.lang).toBe('en');
 rerender({ lang: 'vi' });
 await act(async () => expect(await result.current.finish({ ...history, totalTime: 999 })).toBe(true));
 expect(mocks.write.mock.calls[1][3]).toEqual(first);
});
it('restores an uncertain completed save without changing its ID, date, locale or feedback', async () => {
 const first = renderHook(() => useLearningSession(user, 'en'));
 act(() => first.result.current.start(history.config, history.quizResults));
 mocks.write.mockRejectedValueOnce({ code: 'APP-UNAVAILABLE' }).mockResolvedValueOnce(undefined);
 await act(async () => expect(await first.result.current.finish(history)).toBe(false));
 const [, , id, payload] = mocks.write.mock.calls[0];
 const checkpoint = JSON.parse(sessionStorage.getItem('shark:draft:v1:learner:quiz-session')!).data;
 expect(checkpoint).toEqual({ id, completion: payload });
 first.unmount();
 const restored = renderHook(() => useLearningSession(user, 'vi'));
 expect(restored.result.current.draftId).toBe(id);
 expect(restored.result.current.restoredCompletion).toEqual(payload);
 await act(async () => expect(await restored.result.current.finish({ ...history, totalTime: 999 })).toBe(true));
 expect(mocks.write.mock.calls[1].slice(1, 4)).toEqual(['history', id, payload]);
});
it('keeps the quiz on failed saves and retries the same record without undefined analysis', async () => {
 const { result } = renderHook(() => useLearningSession(user, 'en'));
 act(() => result.current.start(history.config, []));
 mocks.write.mockRejectedValueOnce({ code: 'unavailable' }).mockResolvedValueOnce(undefined);
 await act(async () => expect(await result.current.finish({ ...history, analysis: undefined })).toBe(false));
 expect(result.current.session.status).toBe('quiz');
 const [, kind, recordId, data] = mocks.write.mock.calls[0];
 expect(data.analysis).toBeUndefined(); expect(data.schemaVersion).toBe(2); expect(kind).toBe('history');
 expect(typeof data.date).toBe('number');
 await act(async () => expect(await result.current.finish({ ...history, analysis: undefined })).toBe(true));
 expect(mocks.write.mock.calls[1][2]).toEqual(recordId);
 expect(mocks.write.mock.calls[1][3].date).toBe(data.date);
 expect(result.current.session.status).toBe('result');
});
it('does not navigate back to results after a save finishes beyond reset', async () => {
 const { result } = renderHook(() => useLearningSession(user, 'vi'));
 let resolve!: () => void; mocks.write.mockReturnValue(new Promise<void>(done => { resolve = done; }));
 act(() => result.current.start(history.config, []));
 let saving!: Promise<boolean>; act(() => { saving = result.current.finish(history); result.current.reset(); });
 expect((mocks.write.mock.calls[0][4] as AbortSignal).aborted).toBe(true);
 await act(async () => { resolve(); expect(await saving).toBe(false); });
 expect(result.current.session.status).toBe('setup');
});

it('persists recovered feedback and bilingual topics against the original stable history ID', async () => {
 const { result } = renderHook(() => useLearningSession(user, 'en'));
 mocks.write.mockResolvedValue(undefined);
 act(() => result.current.start(history.config, []));
 await act(async () => { await result.current.finish({ ...history, analysis: undefined }); });
 const recordId = mocks.write.mock.calls[0][2];
 await act(async () => expect(await result.current.recoverAnalysis({ ...analysis, topicEn: 'Addition', topicVi: 'Phép cộng' })).toBe(true));
 expect(mocks.feedback).toHaveBeenCalledWith(user, recordId, { analysis, topicEn: 'Addition', topicVi: 'Phép cộng' }, expect.any(AbortSignal));
 expect(result.current.session.results?.date).toBe(mocks.write.mock.calls[0][3].date);
 expect(result.current.session.results?.analysis).toEqual(analysis);
});

it('keeps recovery retryable after a write failure and refuses an old result callback after reset', async () => {
 const { result } = renderHook(() => useLearningSession(user, 'en'));
 mocks.write.mockResolvedValue(undefined);
 act(() => result.current.start(history.config, []));
 await act(async () => { await result.current.finish({ ...history, analysis: undefined }); });
 const recover = result.current.recoverAnalysis;
 mocks.feedback.mockRejectedValueOnce({ code: 'APP-UNAVAILABLE' });
 await act(async () => expect(await recover({ ...analysis, topicEn: 'A', topicVi: 'B' })).toBe(false));
 expect(result.current.session.results?.analysis).toBeUndefined();
 act(() => result.current.start(history.config, []));
 expect(await recover({ ...analysis, topicEn: 'A', topicVi: 'B' })).toBe(false);
 expect(mocks.write).toHaveBeenCalledTimes(1);
 expect(mocks.feedback).toHaveBeenCalledTimes(1);
});

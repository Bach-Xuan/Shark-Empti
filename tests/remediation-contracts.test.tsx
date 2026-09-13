import { act, cleanup, render, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import katex from 'katex';
import { LatexText } from '@/components/latex-text';
import { useMutation } from '@/hooks/use-mutation';
import { numericQuizConfigSchema } from '@/lib/quiz-config';
import { readHistoryItem } from '@/lib/history-schema';
import { answersMatch } from '@/lib/arena-scoring';
import { receiptExpiry, RECEIPT_RETENTION_MS } from '@/lib/receipt-retention';
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('does not render unchanged math on timer ticks and invalidates changed text', () => {
 const renderMath = vi.spyOn(katex, 'renderToString');
 const view = render(<LatexText text="Value $x^2$" />);
 for (let tick = 0; tick < 10; tick++) view.rerender(<LatexText text="Value $x^2$" />);
 expect(renderMath).toHaveBeenCalledTimes(1);
 view.rerender(<LatexText text="Giá trị $$x^3$$" />);
 expect(renderMath).toHaveBeenCalledTimes(2);
 expect(renderMath.mock.calls[1][1]).toMatchObject({ displayMode: true, throwOnError: false });
});
it('awaits durable completion, excludes duplicate requests and recovers rejection', async () => {
 const operation = vi.fn(), report = vi.fn();
 let reject!: (cause: unknown) => void;
 operation.mockReturnValueOnce(new Promise((_, fail) => { reject = fail; }));
 const { result } = renderHook(useMutation);
 let pending!: ReturnType<typeof result.current.run>;
 act(() => { pending = result.current.run(operation, report); });
 expect(result.current.pending).toBe(true);
 expect(await result.current.run(operation, report)).toEqual({ ok: false });
 expect(operation).toHaveBeenCalledTimes(1);
 await act(async () => { reject({ code: 'unavailable' }); await pending; });
 expect(report).toHaveBeenCalledWith({ code: 'unavailable' });
 operation.mockResolvedValueOnce(undefined);
 await act(async () => expect(await result.current.run(operation, report)).toEqual({ ok: true }));
 expect(result.current.pending).toBe(false);
});
it('accepts bounded numeric drafts and rejects partial or out-of-range numbers', () => {
 expect(numericQuizConfigSchema.parse({ numQuestions: '50', timeLimit: '' })).toEqual({ numQuestions: 50, timeLimit: undefined });
 for (const count of ['0','51','2x','1.5', -1, Infinity]) expect(numericQuizConfigSchema.safeParse({ numQuestions: count }).success).toBe(false);
});
it('identifies legacy history while retaining absent and invalid optional analysis', () => {
 const base = { date: '2026-09-13', config: { topic: 'x' }, quizResults: [] };
 for (const analysis of [undefined, { broken: true }]) expect(readHistoryItem('id', { ...base, analysis })).toMatchObject({ schemaVersion: 1, analysis: undefined });
 expect(readHistoryItem('id', { ...base, schemaVersion: 2 })?.schemaVersion).toBe(2);
 expect(readHistoryItem('id', { ...base, schemaVersion: 99 })).toBeNull();
});
it('uses an absolute numeric boundary without scaling errors at large magnitude', () => {
 const q = (correct: string) => ({ question: '', type: 'Short Answer', correct });
 expect(answersMatch(q('0'), '0.000000999')).toBe(true);
 expect(answersMatch(q('0'), '0.000001')).toBe(true);
 expect(answersMatch(q('0'), '0.000001001')).toBe(false);
 expect(answersMatch(q('1000000'), '1000000.0000005')).toBe(true);
 expect(answersMatch(q('1000000'), '1000000.000002')).toBe(false);
});
it('retains receipts beyond the supported retry window with explicit timestamp expiry', () => {
 const created = new Date('2026-09-13T00:00:00Z');
 expect(receiptExpiry(created).getTime() - created.getTime()).toBe(RECEIPT_RETENTION_MS);
 expect(created.toISOString()).toBe('2026-09-13T00:00:00.000Z');
});

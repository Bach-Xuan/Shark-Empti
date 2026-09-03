import { expect, it } from 'vitest';
import { calculateDashboardStats } from '@/lib/stats-utils';
import { translations } from '@/lib/translations';
import { history } from './fixtures/quiz';
it.each(['constructor', 'toString', '__proto__'])('aggregates the topic %s normally', topic => {
  const result = calculateDashboardStats([{ ...history, config: { ...history.config, topic } }], translations.en, 'en');
  expect(result?.processedGroupedInsights[0]).toMatchObject({ topic, strengths: ['Addition'], totalQuestions: 1 });
});
it('averages valid measurements without counting missing analysis as zero', () => {
  const result = calculateDashboardStats([history, { ...history, analysis: undefined }], translations.en, 'en');
  expect(result?.totalAttempts).toBe(2);
  expect(result?.radarData.every(metric => metric.A === 100)).toBe(true);
});
it('represents unmeasured skills as missing, not zero', () => {
  expect(calculateDashboardStats([{ ...history, analysis: undefined }], translations.en, 'en')?.radarData.every(metric => metric.A === null)).toBe(true);
});
it('retains valid zero measurements', () => {
  const zero = { ...history, analysis: { ...history.analysis!, cognitiveMetrics: { ...history.analysis!.cognitiveMetrics, conceptMastery: 0 } } };
  expect(calculateDashboardStats([history, zero], translations.en, 'en')?.radarData[0].A).toBe(50);
});
it('does not let invalid legacy metrics dilute valid measurements', () => {
  const invalid = { ...history, analysis: { ...history.analysis!, cognitiveMetrics: { ...history.analysis!.cognitiveMetrics, conceptMastery: Number.NaN, logicalReasoning: -1 } } };
  const result = calculateDashboardStats([history, invalid], translations.en, 'en');
  expect(result?.radarData.every(metric => metric.A === 100)).toBe(true);
});
it('translates timeout categories without changing stored codes', () => {
  const expired = { ...history, quizResults: [{ ...history.quizResults[0], isCorrect: false, errorCategory: 'Time Expired' }] };
  expect(calculateDashboardStats([expired], translations.vi, 'vi')?.mostFrequentError).toBe('Hết thời gian');
  expect(expired.quizResults[0].errorCategory).toBe('Time Expired');
});

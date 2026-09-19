import { expect, it } from 'vitest';
import { calculateDashboardStats } from '@/lib/stats-utils';
import { roadmapRecommendations, roadmapTopicId } from '@/lib/roadmap-identity';
import { translations } from '@/lib/translations';
import { history } from './fixtures/quiz';

const session = { ...history, id: 'first', config: { ...history.config, topicEn: 'Addition', topicVi: 'Phép cộng' } };
it('keeps topic and task identity across display locales and selected-session subsets', () => {
  const en = calculateDashboardStats([session], translations.en, 'en')!.processedGroupedInsights[0];
  const vi = calculateDashboardStats([session], translations.vi, 'vi')!.processedGroupedInsights[0];
  expect(vi.topic).not.toBe(en.topic);
  expect(vi.topicId).toBe(en.topicId);
  expect(vi.recommendations[0].id).toBe(en.recommendations[0].id);
  expect(vi.recommendations[0].text).toBe('Luyện tập');
  const added = { ...session, id: 'second', date: '2026-09-04', analysis: { ...session.analysis!, en: { ...session.analysis!.en, recommendations: ['New'] }, vi: { ...session.analysis!.vi, recommendations: ['Mới'] } } };
  const all = calculateDashboardStats([session, added], translations.en, 'en')!.processedGroupedInsights[0];
  expect(all.recommendations.find(rec => rec.text === 'Practice')?.id).toBe(en.recommendations[0].id);
  expect(calculateDashboardStats([added, session], translations.en, 'en')).toEqual(calculateDashboardStats([session, added], translations.en, 'en'));
});
it('survives reordered recommendation pairs and deduplicates exact pairs only', () => {
  const pair = { ...session, analysis: { ...session.analysis!, en: { ...session.analysis!.en, recommendations: ['A', 'B', 'A', 'A'] }, vi: { ...session.analysis!.vi, recommendations: ['Một', 'Hai', 'Một', 'Khác'] } } };
  const reversed = { ...pair, analysis: { ...pair.analysis, en: { ...pair.analysis.en, recommendations: [...pair.analysis.en.recommendations].reverse() }, vi: { ...pair.analysis.vi, recommendations: [...pair.analysis.vi.recommendations].reverse() } } };
  const keys = (s: typeof pair) => roadmapRecommendations(s, 'en').map(rec => rec.id).sort();
  expect(keys(pair)).toEqual(keys(reversed));
  expect(keys(pair)).toHaveLength(3);
  expect(calculateDashboardStats([pair, pair], translations.en, 'en')!.processedGroupedInsights[0].recommendations).toHaveLength(3);
});
it('does not merge identical display labels belonging to different topic contexts', () => {
  const other = { ...session, config: { ...session.config, subject: 'physics' } };
  expect(roadmapTopicId(other.config)).not.toBe(roadmapTopicId(session.config));
  expect(calculateDashboardStats([session, other], translations.en, 'en')!.processedGroupedInsights).toHaveLength(2);
});
it('has stable fallback identities for incomplete bilingual legacy analysis', () => {
  const incomplete = { ...session, analysis: { ...session.analysis!, vi: { strengths: [], weaknesses: [], recommendations: [] } } };
  expect(roadmapRecommendations(incomplete, 'vi')).toEqual(roadmapRecommendations(incomplete, 'en'));
  expect(roadmapRecommendations({ ...session, analysis: undefined }, 'vi')).toEqual([]);
});
it('does not transfer completion identity to edited bilingual content', () => {
  const changed = { ...session, analysis: { ...session.analysis!, vi: { ...session.analysis!.vi, recommendations: ['Changed'] } } };
  expect(roadmapRecommendations(changed, 'en')[0].id).not.toBe(roadmapRecommendations(session, 'en')[0].id);
});

import { act, cleanup, render, renderHook, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ProfilePrintReport } from '@/components/profile-print-report';
import { useProfileReport } from '@/hooks/use-profile-report';
import { calculateDashboardStats } from '@/lib/stats-utils';
import { writeRoadmapChecks } from '@/lib/roadmap-storage';
import { translations } from '@/lib/translations';
import { history } from './fixtures/quiz';

const mocks = vi.hoisted(() => ({ items: [] as unknown[] }));
vi.mock('@/hooks/use-history', () => ({ useHistory: () => ({ items: mocks.items }) }));
afterEach(() => { cleanup(); localStorage.clear(); });
it('prints every topic directly under body, with completed tasks matched by stable IDs', () => {
  const stats = calculateDashboardStats([history], translations.vi, 'vi')!;
  const group = stats.processedGroupedInsights[0];
  const view = render(<div style={{ height: 100, overflow: 'hidden' }} role="dialog">
    <ProfilePrintReport stats={stats} roadmapStatus={{ [group.topicId]: { [group.recommendations[0].id]: true } }} name="Learner" issued="19/09/2026" t={translations.vi} lang="vi" />
  </div>);
  const report = screen.getByRole('article', { hidden: true });
  expect(report.parentElement).toBe(document.body);
  expect(within(report).getByText('Luyện tập')).toBeTruthy();
  const heading = within(report).getByRole('heading', { name: translations.vi.completedTasks, hidden: true });
  expect(heading.nextElementSibling?.textContent).toContain('Luyện tập');
  expect(within(report).getAllByRole('table', { hidden: true })).toHaveLength(2);
  view.unmount();
  expect(document.querySelector('.profile-print-report')).toBeNull();
});
it('resets report selection on account changes and reads completion for a selected subset', () => {
  mocks.items = [{ ...history, id: 'first' }, { ...history, id: 'second', date: '2026-09-04' }, history];
  const group = calculateDashboardStats([history], translations.en, 'en')!.processedGroupedInsights[0];
  writeRoadmapChecks('one', { [group.topicId]: { [group.recommendations[0].id]: true } });
  const { result, rerender } = renderHook(({ uid, lang }: { uid: string; lang: 'en' | 'vi' }) => useProfileReport({ uid }, translations[lang], lang), { initialProps: { uid: 'one', lang: 'en' } });
  expect(result.current.filteredReportHistory).toHaveLength(2);
  act(() => { result.current.setSelectedSessionIds(['second']); result.current.setIsReportViewOpen(true); });
  expect(result.current.reportStats?.totalAttempts).toBe(1);
  rerender({ uid: 'one', lang: 'vi' });
  expect(result.current.roadmapStatus[group.topicId][result.current.reportStats!.processedGroupedInsights[0].recommendations[0].id]).toBe(true);
  rerender({ uid: 'two', lang: 'vi' });
  expect(result.current.selectedSessionIds).toEqual([]);
  expect(result.current.isReportViewOpen).toBe(false);
  expect(result.current.roadmapStatus).toEqual({});
  expect(result.current.reportStats).toBeNull();
});

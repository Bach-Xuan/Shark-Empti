'use client';
import { useEffect, useMemo, useState } from 'react';
import { useHistory } from './use-history';
import { useRoadmapChecks } from './use-roadmap-checks';
import { calculateDashboardStats } from '@/lib/stats-utils';
import type { TranslationSet } from '@/lib/translations';
import type { Language, QuizHistoryItem } from '@/lib/types';

type ReportDialog =
  | { kind: 'select'; uid: string }
  | { kind: 'preview'; uid: string; rows: QuizHistoryItem[] };

export function useProfileReport(user: { uid: string } | null, t: TranslationSet, lang: Language) {
  const [dialog, setDialog] = useState<ReportDialog | null>(null);
  const isReportSelectOpen = dialog?.kind === 'select' && dialog.uid === user?.uid;
  const preview = dialog?.kind === 'preview' && dialog.uid === user?.uid ? dialog : null;
  const isReportViewOpen = preview !== null;
  const reportOpen = isReportSelectOpen || isReportViewOpen;
  const historyPage = useHistory(reportOpen ? 'immediate' : 'off');
  const history = historyPage.items;
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const { roadmapStatus } = useRoadmapChecks(reportOpen ? user?.uid : undefined);

  const [reportSearchQuery, setReportSearchQuery] = useState('');
  const [reportSortOrder, setReportSortOrder] = useState<'recent' | 'alphabetical'>('recent');

  useEffect(() => {
    setSelectedSessionIds([]);
    setDialog(null);
    setReportSearchQuery('');
  }, [user?.uid]);

  const selectedRows = useMemo(() => {
    const ids = new Set(selectedSessionIds);
    return history.filter(row => row.id && ids.has(row.id));
  }, [history, selectedSessionIds]);
  const reportStats = useMemo(() => preview ? calculateDashboardStats(preview.rows, t, lang) : null, [preview, t, lang]);

  const openSelection = () => {
    if (!user) return;
    setSelectedSessionIds([]);
    setReportSearchQuery('');
    setDialog({ kind: 'select', uid: user.uid });
  };
  const closeReport = () => {
    setDialog(null);
    setSelectedSessionIds([]);
  };
  const generateReport = () => {
    if (!user || !isReportSelectOpen || historyPage.loading || historyPage.error || !selectedRows.length) return false;
    // Preview, copy and print must describe the same rows even if a live page changes.
    setDialog({ kind: 'preview', uid: user.uid, rows: selectedRows });
    return true;
  };

  const filteredReportHistory = useMemo(() => {
    if (!isReportSelectOpen) return [];
    let result = history.filter(session => !!session.id);

    if (reportSearchQuery.trim()) {
      const lowerQuery = reportSearchQuery.toLowerCase();
      result = result.filter(h => {
        const topic = lang === 'vi' ? (h.config.topicVi || h.config.topic) : (h.config.topicEn || h.config.topic);
        return topic.toLowerCase().includes(lowerQuery);
      });
    }

    if (reportSortOrder === 'alphabetical') {
      result.sort((a, b) => {
        const topicA = lang === 'vi' ? (a.config.topicVi || a.config.topic) : (a.config.topicEn || a.config.topic);
        const topicB = lang === 'vi' ? (b.config.topicVi || b.config.topic) : (b.config.topicEn || b.config.topic);
        return topicA.localeCompare(topicB);
      });
    }

    return result;
  }, [isReportSelectOpen, history, reportSearchQuery, reportSortOrder, lang]);

  return {
    historyPage, isReportSelectOpen, isReportViewOpen, openSelection, closeReport, generateReport, selectedCount: selectedRows.length,
    selectedSessionIds, setSelectedSessionIds, roadmapStatus, reportSearchQuery, setReportSearchQuery,
    reportSortOrder, setReportSortOrder, reportStats, filteredReportHistory,
  };
}

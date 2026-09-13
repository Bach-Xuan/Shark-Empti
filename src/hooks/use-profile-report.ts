'use client';
import { useEffect, useMemo, useState } from 'react';
import { useHistory } from './use-history';
import { readRoadmapChecks } from '@/lib/roadmap-storage';
import { calculateDashboardStats } from '@/lib/stats-utils';
import type { TranslationSet } from '@/lib/translations';
import type { Language } from '@/lib/types';
export function useProfileReport(user: { uid: string } | null, t: TranslationSet, lang: Language) {
  // Report States
  const historyPage = useHistory();
  const history = historyPage.items;
  const [isReportSelectOpen, setIsReportSelectOpen] = useState(false);
  const [isReportViewOpen, setIsReportViewOpen] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [roadmapStatus, setRoadmapStatus] = useState<Record<string, Record<number, boolean>>>({});

  // Report Filter States
  const [reportSearchQuery, setReportSearchQuery] = useState('');
  const [reportSortOrder, setReportSortOrder] = useState<'recent' | 'alphabetical'>('recent');

  // Load Roadmap Status
  useEffect(() => {
    setRoadmapStatus(readRoadmapChecks(user?.uid));
  }, [isReportSelectOpen, user?.uid]);



  // Logic to process report stats for SELECTED sessions only
  const reportStats = useMemo(() => {
    const selectedHistory = history.filter(h => h.id && selectedSessionIds.includes(h.id));
    return calculateDashboardStats(selectedHistory, t, lang);
  }, [history, selectedSessionIds, t, lang]);

  // Filter and Sort history for the selection list
  const filteredReportHistory = useMemo(() => {
    let result = [...history];

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
    } else {
      result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    return result;
  }, [history, reportSearchQuery, reportSortOrder, lang]);


return { historyPage, history, isReportSelectOpen, setIsReportSelectOpen, isReportViewOpen, setIsReportViewOpen, selectedSessionIds, setSelectedSessionIds, roadmapStatus, reportSearchQuery, setReportSearchQuery, reportSortOrder, setReportSortOrder, reportStats, filteredReportHistory };
}

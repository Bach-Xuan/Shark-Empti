'use client';
import { createPortal } from 'react-dom';
import { LatexText } from './latex-text';
import type { DashboardStats } from '@/lib/stats-utils';
import type { RoadmapChecks } from '@/lib/roadmap-storage';
import type { TranslationSet } from '@/lib/translations';
import type { Language } from '@/lib/types';
import { uiMessage } from '@/lib/i18n';

// Scoped to the lifetime of the open report. Body siblings (including Radix
// portals) disappear entirely, so they cannot reserve space or clip pages.
export const reportPrintCss = `
.profile-print-report { display: none; }
@media print {
  @page { size: A4; margin: 16mm; }
  html:has(.profile-print-report), body:has(.profile-print-report) {
    height: auto !important; min-height: 0 !important; overflow: visible !important;
    position: static !important; margin: 0 !important; padding: 0 !important;
    background: white !important; color: black !important;
  }
  body:has(.profile-print-report) > :not(.profile-print-report) { display: none !important; }
  .profile-print-report {
    display: block !important; position: static !important; width: auto !important;
    max-width: none !important; height: auto !important; max-height: none !important;
    overflow: visible !important; color: #111 !important; background: white !important;
    font: 11pt/1.5 Arial, sans-serif; overflow-wrap: anywhere; color-scheme: light;
  }
  .profile-print-report * { animation: none !important; transition: none !important; box-shadow: none !important; }
  .profile-print-report h1 { font-size: 22pt; }
  .profile-print-report h2 { font-size: 17pt; }
  .profile-print-report h3 { font-size: 13pt; }
  .profile-print-report h1, .profile-print-report h2, .profile-print-report h3 {
    break-after: avoid-page; page-break-after: avoid;
    margin: 14pt 0 7pt; font-weight: bold; line-height: 1.25;
  }
  .profile-print-report p { margin: 7pt 0; }
  .profile-print-report ul { list-style: disc outside; margin: 7pt 0 14pt; padding-left: 20pt; }
  .profile-print-report li { margin: 5pt 0; }
  .profile-print-report header { margin-bottom: 20pt; }
  .profile-print-report section { display: block; break-inside: auto; }
  .profile-print-report .report-topic { break-before: page; page-break-before: always; }
  .profile-print-report p, .profile-print-report li { orphans: 3; widows: 3; }
  .profile-print-report table { width: 100%; margin: 12pt 0; border-collapse: collapse; table-layout: fixed; }
  .profile-print-report thead { display: table-header-group; }
  .profile-print-report tr { break-inside: avoid; }
  .profile-print-report th, .profile-print-report td { padding: 5pt; border: 1px solid #aaa; text-align: left; }
  .profile-print-report .overflow-x-auto, .profile-print-report .katex-display { overflow: visible !important; white-space: normal; }
}`;

export interface ProfilePrintReportProps {
  stats: DashboardStats;
  roadmapStatus: RoadmapChecks;
  name: string;
  issued: string;
  t: TranslationSet;
  lang: Language;
}

// Semantic, unconstrained document: no viewport containers, responsive charts,
// theme-dependent colors, or indivisible topic cards. Tables preserve the chart
// values in print, including missing measurements, without a hidden-size race.
export function ProfilePrintDocument({ stats, roadmapStatus, name, issued, t, lang }: ProfilePrintReportProps) {
  return <article className="profile-print-report" lang={lang} aria-label={t.academicReport}>
    <style>{reportPrintCss}</style>
    <header><h1>{t.academicReport}</h1><p>{t.reportFor}: {name}</p>
      <p>{uiMessage(lang, 'profile.date_issued')}: {issued}</p></header>
    <section>
      <h2>{t.dashboard}</h2>
      <p>{t.totalAttempts}: {stats.totalAttempts} · {t.totalErrors}: {stats.totalErrors}</p>
      <p>{t.frequentError}: {stats.mostFrequentError}</p>
      <table><caption>{t.academicReport}</caption><thead><tr><th>{t.dashboard}</th><th>%</th></tr></thead>
        <tbody>{stats.radarData.map(metric => <tr key={metric.subject}><th scope="row">{metric.subject}</th><td>{metric.A === null ? '—' : metric.A.toFixed(1)}</td></tr>)}</tbody></table>
      <table><caption>{t.totalErrors}</caption><thead><tr><th>{t.frequentError}</th><th>{t.totalErrors}</th></tr></thead>
        <tbody>{stats.barData.map(error => <tr key={error.name}><th scope="row">{error.name}</th><td>{error.count}</td></tr>)}</tbody></table>
    </section>
    {stats.processedGroupedInsights.map(group => {
      const checks = roadmapStatus[group.topicId] ?? {};
      return <section className="report-topic" key={group.topicId}>
        <h2><LatexText text={group.topic} /></h2>
        <h3>{t.strengths}</h3><ul>{group.strengths.map(text => <li key={text}><LatexText text={text} /></li>)}</ul>
        <h3>{t.weaknesses}</h3><ul>{group.weaknesses.map(text => <li key={text}><LatexText text={text} /></li>)}</ul>
        <h3>{t.completedTasks}</h3><ul>{group.recommendations.filter(rec => checks[rec.id]).map(rec => <li key={rec.id}><LatexText text={rec.text} /></li>)}</ul>
        <h3>{t.pendingTasks}</h3><ul>{group.recommendations.filter(rec => !checks[rec.id]).map(rec => <li key={rec.id}><LatexText text={rec.text} /></li>)}</ul>
      </section>;
    })}
    {!stats.processedGroupedInsights.length && <p>{t.noHistory}</p>}
  </article>;
}

export function ProfilePrintReport(props: ProfilePrintReportProps) {
  return createPortal(<ProfilePrintDocument {...props} />, document.body);
}

"use client";
import { formatStoredDate } from '@/lib/date-format';
import { useUser } from '@/firebase';
import { copyTextToClipboard } from '@/lib/clipboard';
import { showUnexpectedErrorToast } from '@/lib/error-toast';
import { uiMessage } from '@/lib/i18n';
import { errorCategoryLabel } from '@/lib/quiz-labels';
import { useRoadmapChecks } from '@/hooks/use-roadmap-checks';

import { LatexText } from '@/components/latex-text';
import { UiText } from "@/components/ui-text";
import { Button } from '@/components/ui/button';
import { Card,CardContent,CardHeader,CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
Dialog,
DialogContent,
DialogHeader,
DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from '@/hooks/use-toast';
import { calculateDashboardStats } from '@/lib/stats-utils';
import { BaseViewProps,QuizHistoryItem } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
AlertCircle,
BookOpen,
BrainCircuit,
Check,
CheckCircle2,
ChevronDown,ChevronUp,
Clock,
Copy,
History,
Info,
LayoutDashboard,
Map,
Pencil,
SearchX,
Sigma,
Sparkles,
Star,
StickyNote,
Target,
TrendingUp,
XCircle,
Zap
} from 'lucide-react';
import { useCallback,useMemo,useRef,useState } from 'react';
import {
Bar,
BarChart,
CartesianGrid,
PolarAngleAxis,
PolarGrid,
Radar,RadarChart,
Tooltip as RechartsTooltip,
ResponsiveContainer,
XAxis,YAxis
} from 'recharts';
import FeatureHelp from './feature-help';
import { Badge } from './ui/badge';

import { LatexQuickToolbar } from '@/components/latex-toolbar';

import { DashboardInsightList,DashboardMetricCard } from './dashboard-cards';

const CustomRadarTick = (props: { x?: number; y?: number; payload?: { value?: string }; textAnchor?: 'start' | 'middle' | 'end' | 'inherit' }) => {
  const { x, y, payload, textAnchor } = props;
  const label = payload?.value ?? '';

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        textAnchor={textAnchor}
        fill="hsl(var(--foreground))"
        dy="0.35em"
        className="text-[8px] md:text-[11px] font-black uppercase font-headline"
      >
        {label.toUpperCase()}
      </text>
    </g>
  );
};

interface DashboardViewProps extends BaseViewProps {
  history: QuizHistoryItem[];
  personalNotes: string;
  onNotesChange: (notes: string) => Promise<boolean>;
  stats?: ReturnType<typeof calculateDashboardStats>;
  onFixWeakness?: (concept: string, type: 'practice' | 'flashcards') => void;
}

export default function DashboardView({ t, history, lang, personalNotes, onNotesChange, onFixWeakness, stats }: DashboardViewProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const savingNotes = useRef(false);
  const [tempNotesContent, setTempNotesContent] = useState("");
  const [activeCopiedId, setActiveCopiedId] = useState<string | null>(null);
  const [expandedAttemptIdx, setExpandedAttemptIdx] = useState<number | null>(null);

  const [isAttemptsOpen, setIsAttemptsOpen] = useState(false);
  const [isErrorsOpen, setIsErrorsOpen] = useState(false);
  const [isRoadmapOpen, setIsRoadmapOpen] = useState(false);

  const { roadmapStatus, toggleCheck } = useRoadmapChecks(user?.uid);

  const dashboardStats = useMemo(() => stats === undefined ? calculateDashboardStats(history, t, lang) : stats, [stats, history, t, lang]);

  const sortedHistory = useMemo(() =>
    [...history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  , [history]);

  const allErrors = useMemo(() => {
    return history.flatMap(session =>
      session.quizResults
        .filter(r => !r.isCorrect)
        .map(r => ({ ...r, sessionDate: session.date, topic: lang === 'vi' ? (session.config.topicVi || session.config.topic) : (session.config.topicEn || session.config.topic) }))
    ).sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime());
  }, [history, lang]);


  const getStartTime = (finishDate: string, durationSeconds: number) => {
    const finish = new Date(finishDate);
    const start = new Date(finish.getTime() - durationSeconds * 1000);
    return start.toLocaleTimeString(lang === 'vi' ? 'vi-VN' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  };



  const handleCopySection = useCallback(async (sectionType: 'insights' | 'feedback' | 'notes') => {
    let copyText = "";

    if (sectionType === 'notes') {
      copyText = personalNotes;
    } else if (dashboardStats?.processedGroupedInsights.length) {
      const sectionTitle = sectionType === 'insights' ? t.analyticsHistory : t.recommendations;
      copyText += `${sectionTitle.toUpperCase()}\n\n`;

      dashboardStats.processedGroupedInsights.forEach(group => {
        copyText += `--- ${group.topic.toUpperCase()} ---\n`;
        if (sectionType === 'insights') {
          if (group.strengths.length) copyText += `${t.strengths.toUpperCase()}:\n${group.strengths.map(s => `• ${s}`).join('\n')}\n`;
          if (group.weaknesses.length) copyText += `${t.weaknesses.toUpperCase()}:\n${group.weaknesses.map(w => `• ${w}`).join('\n')}\n`;
        } else {
          copyText += `${t.recommendations.toUpperCase()}:\n${group.recommendations.map(r => `• ${r.text}`).join('\n')}\n`;
        }
        copyText += '\n';
      });
    }

    if (!copyText) return;

    if (await copyTextToClipboard(copyText.trim())) {
      setActiveCopiedId(sectionType);
      toast({ title: t.copied });
      setTimeout(() => setActiveCopiedId(null), 2000);
    } else toast({ variant: 'destructive', title: uiMessage(lang, 'quicknotes.could_not_copy_please_try_again') });
  }, [dashboardStats, t, personalNotes, toast, lang]);

  const handleSaveNotes = async () => {
    if (savingNotes.current) return;
    savingNotes.current = true;
    setIsSavingNotes(true);
    try {
      if (await onNotesChange(tempNotesContent)) setIsEditingNotes(false);
    } catch {
      showUnexpectedErrorToast('APP-NOTES-SAVE-FAILED', 'Notes could not be saved.', {}, lang);
    } finally {
      savingNotes.current = false;
      setIsSavingNotes(false);
    }
  };

  const insertLatex = (type: 'inline' | 'block') => {
    if (savingNotes.current) return;
    const wrapper = type === 'inline' ? '$' : '$$';
    setTempNotesContent(prev => prev + wrapper + wrapper);
  };

  const insertSnippet = (snippet: string) => {
    if (savingNotes.current) return;
    setTempNotesContent(prev => prev + `$${snippet}$`);
  };

  const getErrorIcon = (errorLabel: string) => {
    const label = errorLabel.toUpperCase();
    if (label === t.carelessMistake.toUpperCase()) return <Zap className="text-white w-5 h-5 md:w-10 md:h-10" />;
    if (label === t.conceptError.toUpperCase()) return <BookOpen className="text-white w-5 h-5 md:w-10 md:h-10" />;
    if (label === t.reasoningError.toUpperCase()) return <BrainCircuit className="text-white w-5 h-5 md:w-10 md:h-10" />;
    if (label === t.misinterpretation.toUpperCase()) return <SearchX className="text-white w-5 h-5 md:w-10 md:h-10" />;
    return <TrendingUp className="text-white w-5 h-5 md:w-10 md:h-10" />;
  };

  const toggleAttemptExpand = (idx: number) => {
    setExpandedAttemptIdx(expandedAttemptIdx === idx ? null : idx);
  };

  const focusTopics = useMemo(() => {
    if (!dashboardStats) return [];
    return [...dashboardStats.processedGroupedInsights]
      .filter(g => g.errorCount > 0)
      .sort((a, b) => b.errorRate - a.errorRate)
      .slice(0, 3);
  }, [dashboardStats]);

  if (!history || history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] md:min-h-[60vh] text-center p-6 md:p-8 border-[4px] md:border-[6px] border-dashed rounded-[2.5rem] md:rounded-[4rem] border-muted-foreground/10 animate-in fade-in zoom-in-95 duration-1000">
        <div className="w-20 h-20 md:w-40 md:h-40 rounded-[2rem] md:rounded-[3rem] bg-muted/30 flex items-center justify-center mb-6 md:mb-10 border-2 md:border-[3px] border-border shadow-duo">
          <History className="w-10 h-10 md:w-20 md:h-20 text-muted-foreground opacity-40" />
        </div>
        <h2 className="text-2xl md:text-6xl font-headline font-black uppercase text-primary mb-4 md:mb-6 tracking-tighter whitespace-normal break-words">{t.noHistory}</h2>
        <p className="max-w-md text-muted-foreground font-black text-xs md:text-2xl uppercase tracking-[0.15em] md:tracking-[0.2em] leading-relaxed opacity-60 whitespace-normal break-words">
          {t.completeQuizHint}
        </p>
      </div>
    );
  }

  const chartAxisStyle = {
    fontSize: isMobile ? 8 : 11,
    fontWeight: 900,
    fill: 'hsl(var(--foreground))',
    fontFamily: 'Space Grotesk, sans-serif',
    textTransform: 'uppercase' as const,
    opacity: 1
  };


  return (
    <div className="flex flex-col gap-10 md:gap-24 animate-slide-up-snappy pb-24 px-1 md:px-0 scroll-mt-32">
      <div id="overview-header" className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6 scroll-mt-32 px-2">
        <h1 className="text-3xl md:text-8xl font-headline font-black text-primary flex items-center gap-3 md:gap-6 uppercase tracking-tighter group whitespace-normal break-words text-left">
          <LayoutDashboard className="w-8 h-8 md:w-20 md:h-20 group-hover:-translate-y-1 transition-transform duration-500 shrink-0" /> {t.dashboard}
          <FeatureHelp
            helpTitle={t.helpTitle}
            title={t.dashboard}
            items={t.dashboardHelp}
            storageKey="shark_help_dashboard_seen"
          />
        </h1>
      </div>

      <div id="overview-metrics" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-12 scroll-mt-32 px-2">
        <DashboardMetricCard
          title={t.totalAttempts}
          value={dashboardStats?.totalAttempts ?? 0}
          icon={<Target className="text-blue-500 w-5 h-5 md:w-12 md:h-12" />}
          onExpand={() => setIsAttemptsOpen(true)}
        />
        <DashboardMetricCard
          title={t.totalErrors}
          value={dashboardStats?.totalErrors ?? 0}
          icon={<AlertCircle className="text-red-500 w-5 h-5 md:w-12 md:h-12" />}
          onExpand={() => setIsErrorsOpen(true)}
        />
        <DashboardMetricCard
          title={t.frequentError}
          value={dashboardStats?.mostFrequentError.toUpperCase() || '---'}
          icon={getErrorIcon(dashboardStats?.mostFrequentError || '')}
          highlight
        />
      </div>

      <div id="charts-section" className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-16 scroll-mt-32 px-2">
        <Card className="card-duo p-4 md:p-12 group border-primary/20 shadow-none hover:shadow-[0_20px_0_0_var(--duo-shadow)] overflow-hidden">
          <CardHeader className="px-0 pt-0 mb-4 md:mb-8">
            <CardTitle className="font-headline font-black text-sm md:text-3xl flex items-center gap-2.5 md:gap-4 uppercase tracking-tighter text-foreground whitespace-normal break-words text-left">
              <div className="w-8 h-8 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-primary/10 flex items-center justify-center border-2 border-primary/20 transition-transform group-hover:-translate-y-1 shrink-0">
                <BrainCircuit className="w-5 h-5 md:w-7 md:h-7 text-primary" />
              </div>
              {t.learningSkillsChart}
            </CardTitle>
          </CardHeader>
          <div className="h-[300px] sm:h-[450px] md:h-[700px] relative">
            {dashboardStats?.radarData.some(metric => metric.A !== null) ? <ResponsiveContainer width="100%" height="100%">
              <RadarChart
                cx="50%"
                cy="50%"
                outerRadius={isMobile ? "55%" : "80%"}
                data={dashboardStats?.radarData}
                margin={{ top: 30, right: isMobile ? 60 : 120, bottom: 30, left: isMobile ? 60 : 120 }}
              >
                <PolarGrid stroke="hsl(var(--muted-foreground))" strokeWidth={1} opacity={0.15} />
                <PolarAngleAxis dataKey="subject" tick={<CustomRadarTick />} />
                <Radar
                  name={t.learningSkillsChart}
                  dataKey="A"
                  stroke="hsl(var(--primary))"
                  strokeWidth={isMobile ? 4 : 8}
                  fill="hsl(var(--primary))"
                  fillOpacity={0.6}
                />
              </RadarChart>
            </ResponsiveContainer> : <div className="flex h-full items-center justify-center"><UiText id="noData" /></div>}
          </div>
        </Card>

        <Card className="card-duo p-4 md:p-12 group border-primary/20 shadow-none hover:shadow-[0_20px_0_0_var(--duo-shadow)] overflow-hidden">
          <CardHeader className="px-0 pt-0 mb-4 md:mb-8">
            <CardTitle className="font-headline font-black text-sm md:text-3xl flex items-center gap-2.5 md:gap-4 uppercase tracking-tighter text-foreground whitespace-normal break-words text-left">
              <div className="w-8 h-8 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-primary/10 flex items-center justify-center border-2 border-primary/20 transition-transform group-hover:-translate-y-1 shrink-0">
                <History className="w-5 h-5 md:w-7 md:h-7 text-primary" />
              </div>
              {t.errorStats}
            </CardTitle>
          </CardHeader>
          <div className="h-[300px] sm:h-[450px] md:h-[700px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dashboardStats?.barData} margin={{ bottom: 80, top: 10, left: -5, right: 10 }}>
                <CartesianGrid strokeDasharray="6 6" vertical={false} stroke="hsl(var(--muted-foreground))" opacity={0.1} />
                <XAxis
                  dataKey="name"
                  tick={chartAxisStyle}
                  tickFormatter={(val) => isMobile && val.length > 10 ? val.substring(0, 8) + '..' : val}
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis tick={chartAxisStyle} axisLine={false} tickLine={false} width={40} />
                <RechartsTooltip
                  cursor={{ fill: 'hsl(var(--primary))', opacity: 0.05 }}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    color: 'hsl(var(--foreground))',
                    borderRadius: '1.5rem',
                    border: '2px solid hsl(var(--border))',
                    fontWeight: '900',
                    textTransform: 'uppercase',
                    fontSize: '10px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                    padding: '12px'
                  }}
                  itemStyle={{ color: 'hsl(var(--primary))', padding: 0 }}
                  labelStyle={{ marginBottom: '4px', color: 'hsl(var(--foreground))' }}
                />
                <Bar
                  name={t.total.toUpperCase()}
                  dataKey="count"
                  fill="hsl(var(--primary))"
                  radius={[10, 10, 0, 0]}
                  barSize={isMobile ? 30 : 60}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 px-2">
        <div id="insights-section" className="scroll-mt-32">
          <DashboardInsightList
            title={t.analyticsHistory}
            icon={<Star className="w-5 h-5 md:w-8 md:h-8 fill-current" />}
            data={dashboardStats?.processedGroupedInsights || []}
            type="insights"
            t={t}
            onCopy={() => handleCopySection('insights')}
            isCopied={activeCopiedId === 'insights'}
            onAction={onFixWeakness}
            roadmapStatus={roadmapStatus}
            toggleCheck={toggleCheck}
          />
        </div>
        <div id="recommendations-section" className="scroll-mt-32">
          <DashboardInsightList
            title={t.recommendations}
            icon={<BrainCircuit className="w-5 h-5 md:w-8 md:h-8" />}
            data={dashboardStats?.processedGroupedInsights || []}
            type="feedback"
            t={t}
            onCopy={() => handleCopySection('feedback')}
            isCopied={activeCopiedId === 'feedback'}
            onAction={onFixWeakness}
            onExpandRoadmap={() => setIsRoadmapOpen(true)}
            roadmapStatus={roadmapStatus}
            toggleCheck={toggleCheck}
          />
        </div>
      </div>

      <Card id="notes-section" className="card-duo p-5 md:p-20 border-primary/20 bg-primary/5 mt-4 md:mt-12 shadow-none hover:shadow-[0_20px_0_0_var(--duo-shadow)] scroll-mt-32 mx-2">
        <CardHeader className="px-0 pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 md:gap-12 mb-6 md:mb-12">
          <CardTitle className="font-headline font-black text-lg md:text-5xl flex items-center gap-3 md:gap-6 text-primary uppercase tracking-tighter whitespace-normal break-words text-left">
            <StickyNote className="w-6 h-6 md:w-16 md:h-16 shrink-0" /> {t.personalNotes}
          </CardTitle>
          <div className="flex gap-2 md:gap-4 shrink-0">
            {!isEditingNotes && personalNotes && (
              <Button variant="outline" size="sm" onClick={() => handleCopySection('notes')} className="btn-duo font-black h-10 w-10 md:h-14 md:w-14 p-0 rounded-xl md:rounded-2xl border-2 md:border-[3px] flex items-center justify-center bg-card shadow-none">
                {activeCopiedId === 'notes' ? <Check className="w-4 h-4 md:w-6 md:h-6 text-green-500" /> : <Copy className="w-4 h-4 md:w-6 md:h-6" />}
              </Button>
            )}
            {!isEditingNotes && (
              <Button variant="outline" size="sm" onClick={() => { setTempNotesContent(personalNotes); setIsEditingNotes(true); }} className="btn-duo font-black h-10 w-10 md:h-14 md:w-14 p-0 rounded-xl md:rounded-2xl border-2 md:border-[3px] text-primary flex items-center justify-center bg-card shadow-none">
                <Pencil className="w-4 h-4 md:w-6 md:h-6" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {isEditingNotes ? (
            <div className="space-y-4 md:space-y-8 animate-in zoom-in-95 duration-300">
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-1.5 md:gap-2 justify-end mb-[-0.5rem]">
                  <Button variant="ghost" size="sm" onClick={() => insertLatex('inline')} className="h-7 md:h-8 px-2 md:px-3 text-[9px] md:text-[10px] font-black bg-muted/50 rounded-lg md:rounded-xl hover:bg-primary/10 transition-all"><UiText id="inlineMath" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => insertLatex('block')} className="h-7 md:h-8 px-2 md:px-3 text-[9px] md:text-[10px] font-black bg-muted/50 rounded-lg md:rounded-xl hover:bg-primary/10 transition-all"><UiText id="blockMath" /></Button>
                </div>

                <LatexQuickToolbar onSelect={insertSnippet} />
              </div>

              <Textarea
                disabled={isSavingNotes}
                className="min-h-[120px] md:min-h-[300px] bg-background border-2 md:border-[4px] border-primary/20 rounded-xl md:rounded-[2.5rem] focus:ring-4 md:ring-[10px] focus:ring-primary/5 font-bold p-4 md:p-10 text-xs md:text-2xl shadow-inner transition-all"
                placeholder={t.notesPlaceholder}
                value={tempNotesContent}
                onChange={(e) => setTempNotesContent(e.target.value)}
              />

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
                <p className="text-[7px] md:text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest flex items-center gap-1.5 md:gap-3">
                  <Sigma className="w-2.5 h-2.5 md:w-5 md:h-5" /> {t.latexHelp}
                </p>
                <div className="flex gap-3 md:gap-4 justify-end">
                  <Button disabled={isSavingNotes} variant="ghost" onClick={() => setIsEditingNotes(false)} className="btn-duo rounded-xl md:rounded-2xl px-6 md:px-8 h-9 md:h-14 text-[9px] md:text-xs font-black uppercase tracking-widest bg-card">{t.cancel}</Button>
                  <Button disabled={isSavingNotes} onClick={handleSaveNotes} className="btn-duo bg-primary text-white rounded-xl md:rounded-2xl px-8 md:px-16 h-9 md:h-14 text-[9px] md:text-xs font-black uppercase tracking-widest border-2 md:border-[3px] border-white/20 shadow-none">{t.save}</Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="min-h-[80px] md:min-h-[250px] bg-background/50 p-5 md:p-16 rounded-xl md:rounded-[3rem] border-2 md:border-[4px] border-dashed border-primary/20 italic text-muted-foreground text-xs md:text-2xl font-bold leading-relaxed shadow-inner animate-in fade-in duration-500 overflow-y-auto">
              {personalNotes ? <LatexText text={personalNotes} /> : t.notesPlaceholder}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isRoadmapOpen} onOpenChange={setIsRoadmapOpen}>
        <DialogContent className="max-w-7xl w-[95vw] rounded-[2rem] border-[4px] border-border shadow-2xl p-0 overflow-hidden bg-background">
          <div className="bg-primary p-6 md:p-10 text-white border-b-[4px] border-border relative">
             <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <DialogTitle className="text-2xl md:text-5xl font-headline font-black uppercase tracking-tight flex items-center gap-4 text-left">
                    <Map className="w-8 h-8 md:w-16 md:h-16" /> {t.studyRoadmap}
                  </DialogTitle>
                  <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] opacity-80 text-left">{t.appTagline}</p>
                </div>
             </div>
             <Sparkles className="absolute bottom-4 right-10 w-20 h-20 text-white/10" />
          </div>

          <ScrollArea className="max-h-[70vh] p-6 md:p-10 custom-scrollbar">
            <div className="space-y-12 pb-10">
              <div className="space-y-6">
                <h3 className="text-lg md:text-3xl font-headline font-black text-primary uppercase tracking-tight flex items-center gap-3 border-b-4 border-primary/10 pb-4 text-left">
                  <Zap className="w-6 h-6 md:w-10 md:h-10 fill-current" /> {t.focusRecommendations}
                </h3>

                {focusTopics.length > 0 ? (
                  <div className="space-y-4">
                    <p className="text-[10px] md:text-sm font-black text-muted-foreground uppercase tracking-widest px-2 italic text-left">
                      {t.topTopicsWithErrors}:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {focusTopics.map((topic, idx) => (
                        <Card key={idx} className="card-duo p-6 md:p-8 bg-red-500/5 border-red-500/20 hover:border-red-500/40 transition-all flex flex-col justify-between gap-6 shadow-none h-full">
                           <div className="space-y-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center font-black text-red-600 text-xs shrink-0">#{idx+1}</div>
                                <h4 className="font-black text-base md:text-xl text-foreground uppercase tracking-tight leading-tight text-left"><LatexText text={topic.topic} /></h4>
                              </div>
                              <div className="space-y-1.5 pl-11">
                                 <div className="flex items-center gap-1.5 text-[9px] md:text-xs font-black text-red-600 uppercase tracking-widest">
                                   <AlertCircle className="w-3.5 h-3.5" /> {t.errorRate}: {Math.round(topic.errorRate * 100)}%
                                 </div>
                                 <p className="text-[9px] md:text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                                   {topic.errorCount} {uiMessage(lang, "dashboardview.errors")} / {topic.totalQuestions} {uiMessage(lang, "dashboardview.total")}
                                 </p>
                              </div>
                           </div>
                           <Button
                             onClick={() => { setIsRoadmapOpen(false); if(onFixWeakness) onFixWeakness(topic.topic, 'practice'); }}
                             className="btn-duo bg-red-500 text-white h-12 md:h-14 rounded-xl font-black uppercase text-[9px] md:text-xs tracking-widest w-full mt-4"
                           >
                             <Zap className="w-4 h-4 mr-2" /> {t.fixMyWeakness}
                           </Button>
                        </Card>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-8 md:p-12 bg-muted/20 border-4 border-dashed border-border rounded-[2rem] text-center">
                    <Info className="w-10 h-10 md:w-16 md:h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="font-black uppercase tracking-widest text-xs md:text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
                      {t.insufficientDataForFocus}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-8">
                <h3 className="text-lg md:text-3xl font-headline font-black text-primary uppercase tracking-tight flex items-center gap-3 border-b-4 border-primary/10 pb-4 text-left">
                  <History className="w-6 h-6 md:w-10 md:h-10" /> {t.studyRoadmap}
                </h3>

                <div className="relative pl-6 md:pl-10 space-y-12">
                   <div className="absolute left-2 md:left-3.5 top-0 bottom-0 w-1.5 md:w-2 bg-muted/50 rounded-full" />

                   {dashboardStats?.processedGroupedInsights.map((group, gIdx) => {
                      const topicChecks = roadmapStatus[group.topicId] || {};
                      const isTopicDone = group.recommendations.length > 0 && group.recommendations.every(rec => !!topicChecks[rec.id]);

                      return (
                        <div key={group.topicId} className="relative group/topic animate-in slide-in-from-left-4 duration-500" style={{ animationDelay: `${gIdx * 100}ms` }}>
                          <div className={cn(
                            "absolute -left-[1.85rem] md:-left-[2.85rem] top-0 w-8 h-8 md:w-12 md:h-12 rounded-full border-[4px] md:border-[6px] z-10 flex items-center justify-center transition-all duration-500",
                            isTopicDone ? "bg-green-500 border-green-200 scale-110 shadow-lg" : "bg-card border-muted-foreground/20"
                          )}>
                            {isTopicDone ? <Check className="text-white w-4 h-4 md:w-6 md:h-6 stroke-[3.5px]" /> : <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-muted-foreground/40" />}
                          </div>

                          <div className="space-y-6">
                            <div className="flex flex-col gap-1 text-left">
                              <h4 className={cn(
                                "font-headline font-black text-lg md:text-3xl uppercase tracking-tight transition-all",
                                isTopicDone ? "line-through text-muted-foreground/60" : "text-foreground"
                              )}>
                                <LatexText text={group.topic} />
                              </h4>
                              {isTopicDone && (
                                <span className="text-[8px] md:text-10px font-black uppercase text-green-500 tracking-widest animate-pulse"><UiText id="completed" /></span>
                              )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                               {group.recommendations.map(rec => (
                                  <label
                                    key={rec.id}
                                    className={cn(
                                      "flex items-start gap-4 p-4 md:p-6 rounded-xl md:rounded-2xl border-2 transition-all group/rec cursor-pointer active:translate-y-0.5",
                                      topicChecks[rec.id]
                                        ? "bg-muted/10 border-border opacity-60"
                                        : "bg-card border-primary/5 hover:border-primary/20 hover:shadow-md"
                                    )}
                                  >
                                    <div className="mt-1 shrink-0">
                                      <Checkbox
                                        checked={!!topicChecks[rec.id]}
                                        onCheckedChange={() => toggleCheck(group.topicId, rec.id)}
                                        aria-label={rec.text}
                                        className="w-5 h-5 md:w-6 md:h-6 border-2"
                                      />
                                    </div>
                                    <p className={cn(
                                      "text-[10px] md:text-lg font-bold leading-relaxed transition-all text-left",
                                      topicChecks[rec.id] ? "line-through text-muted-foreground italic" : "text-foreground"
                                    )}>
                                      <LatexText text={rec.text} />
                                    </p>
                                  </label>
                               ))}
                            </div>
                          </div>
                        </div>
                      );
                   })}
                </div>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={isAttemptsOpen} onOpenChange={setIsAttemptsOpen}>
        <DialogContent className="max-w-4xl w-[95vw] rounded-[1.5rem] md:rounded-[2.5rem] border-[3px] md:border-[4px] border-border shadow-2xl p-4 md:p-10 bg-background">
          <DialogHeader className="mb-4 md:mb-8">
            <DialogTitle className="text-lg md:text-4xl font-headline font-black text-primary uppercase tracking-tight flex items-center gap-2.5 md:gap-4 whitespace-normal break-words text-left">
              <History className="w-5 h-5 md:w-12 md:h-12 shrink-0" /> {t.detailedSessionHistory}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[55vh] md:h-[65vh] pr-1 md:pr-4 custom-scrollbar">
            <div className="space-y-3 md:space-y-6">
              {sortedHistory.map((item, idx) => {
                const sessionTopic = lang === 'vi' ? (item.config.topicVi || item.config.topic) : (item.config.topicEn || item.config.topic);
                return (
                  <Card key={idx} className="card-duo overflow-hidden border-border bg-card hover:border-primary/30 transition-all duration-300 shadow-none">
                    <div
                      className="p-3 md:p-8 flex items-center justify-between cursor-pointer group"
                      onClick={() => toggleAttemptExpand(idx)}
                    >
                      <div className="flex items-center gap-3 md:gap-6 flex-1 min-w-0">
                        <div className="w-8 h-8 md:w-14 md:h-14 rounded-lg md:rounded-2xl bg-muted flex flex-col items-center justify-center border-2 border-border shrink-0">
                          <span className="text-[6px] md:text-[10px] font-black uppercase tracking-tighter opacity-60">
                            {new Date(item.date).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US', { month: 'short' })}
                          </span>
                          <span className="text-xs md:text-xl font-black leading-none">{new Date(item.date).getDate()}</span>
                        </div>
                        <div className="flex flex-col gap-0.5 md:gap-1 min-w-0 flex-1 text-left">
                          <h4 className="font-headline font-black text-[10px] md:text-xl uppercase tracking-tight text-foreground whitespace-normal break-words leading-tight">
                            <LatexText text={sessionTopic} />
                          </h4>
                          <div className="flex items-center gap-2 md:gap-3">
                            <span className="text-[6px] md:text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1">
                              <Clock className="w-2 md:w-3 h-2 md:h-3" /> {getStartTime(item.date, item.totalTime)}
                            </span>
                            <span className="text-[6px] md:text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-1">
                              <Target className="w-2 md:w-3 h-2 md:h-3" /> {item.quizResults.filter(r => r.isCorrect).length}/{item.quizResults.length}
                            </span>
                          </div>
                        </div>
                      </div>
                      {expandedAttemptIdx === idx ? <ChevronUp className="w-3 h-3 md:w-6 md:h-6 text-primary shrink-0" /> : <ChevronDown className="w-3 h-3 md:w-6 md:h-6 text-muted-foreground shrink-0" />}
                    </div>
                    {expandedAttemptIdx === idx && (
                      <div className="px-4 md:px-8 pb-4 md:pb-8 pt-1 space-y-6 md:space-y-10 border-t-2 md:border-t-[4px] border-border/50 animate-in slide-in-from-top-2 duration-300">
                        <div className="grid grid-cols-2 gap-2 md:gap-4 mt-4">
                          <div className="p-2 md:p-4 rounded-lg md:rounded-2xl bg-muted/30 border-2 border-border">
                            <span className="text-[6px] md:text-[8px] font-black uppercase tracking-widest text-muted-foreground block mb-1">{t.scoreLabel}</span>
                            <span className="text-sm md:text-xl font-black text-primary">{Math.round((item.quizResults.filter(r => r.isCorrect).length / item.quizResults.length) * 100)}%</span>
                          </div>
                          <div className="p-2 md:p-4 rounded-lg md:rounded-2xl bg-muted/30 border-2 border-border">
                            <span className="text-[6px] md:text-[8px] font-black uppercase tracking-widest text-muted-foreground block mb-1">{t.duration}</span>
                            <span className="text-sm md:text-xl font-black">{Math.floor(item.totalTime / 60)}{t.minShort} {item.totalTime % 60}{t.secShort}</span>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h5 className="text-[8px] md:text-xs font-black uppercase text-primary tracking-[0.2em] flex items-center gap-2 text-left">
                             <Target className="w-3 h-3 md:w-4 md:h-4" /> {uiMessage(lang, "dashboardview.question_details")}
                          </h5>
                          <div className="space-y-4 md:space-y-8">
                            {item.quizResults.map((res, qIdx) => (
                              <div key={qIdx} className="p-4 md:p-6 rounded-xl md:rounded-2xl border-2 border-border/50 bg-muted/10 space-y-4">
                                <div className="flex items-start gap-3">
                                  {res.isCorrect ? (
                                    <CheckCircle2 className="w-4 h-4 md:w-6 md:h-6 text-green-600 dark:text-green-400 stroke-[3px] shrink-0 mt-1" />
                                  ) : (
                                    <XCircle className="w-4 h-4 md:w-6 md:h-6 text-red-500 shrink-0 mt-1" />
                                  )}
                                  <div className="space-y-4 flex-1 min-w-0 text-left">
                                    <div className="flex flex-col gap-2">
                                      {res.section && (
                                        <Badge variant="outline" className="w-fit bg-primary/5 text-primary border-primary/10 text-[7px] md:text-[9px] font-black uppercase tracking-widest px-2">
                                          <BookOpen className="w-2.5 h-2.5 mr-1" /> {res.section}
                                        </Badge>
                                      )}
                                      <p className="text-xs md:text-lg font-bold text-foreground leading-snug break-words">
                                        <span className="opacity-50 mr-2"><UiText id="questionOrdinal" /> {qIdx + 1}.</span>
                                        <LatexText text={res.question} />
                                      </p>
                                    </div>
                                    <div className="grid grid-cols-1 gap-4 pt-2">
                                      <div className="flex flex-col gap-1.5">
                                        <span className="text-[7px] md:text-[9px] font-black uppercase text-muted-foreground tracking-widest">{t.yourAnswer}:</span>
                                        <div className={cn(
                                          "text-[10px] md:text-base font-bold p-3 md:p-4 rounded-xl border-2",
                                          res.isCorrect ? "bg-green-50/50 border-green-200 text-green-700" : "bg-red-50/50 border-red-200 text-red-700"
                                        )}>
                                          <LatexText text={res.userAnswer || '---'} />
                                        </div>
                                      </div>

                                      <div className="flex flex-col gap-1.5">
                                        <span className="text-[7px] md:text-[9px] font-black uppercase text-muted-foreground tracking-widest">{t.correctAnswer}:</span>
                                        <div className="text-[10px] md:text-base font-bold p-3 md:p-4 rounded-xl border-2 bg-green-50/50 border-green-200 text-green-700">
                                          <LatexText text={res.correct} />
                                        </div>
                                      </div>

                                      {res.explanation && (
                                        <div className="flex flex-col gap-1.5">
                                          <span className="text-[7px] md:text-[9px] font-black uppercase text-muted-foreground tracking-widest">{t.explanation}:</span>
                                          <div className="text-[10px] md:text-base font-bold p-3 md:p-4 rounded-xl border-2 border-primary/10 bg-primary/5 text-foreground leading-relaxed italic">
                                            <LatexText text={res.explanation} />
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={isErrorsOpen} onOpenChange={setIsErrorsOpen}>
        <DialogContent className="max-w-4xl w-[95vw] rounded-[1.5rem] md:rounded-[2.5rem] border-[3px] md:border-[4px] border-border shadow-2xl p-4 md:p-10 bg-background">
          <DialogHeader className="mb-4 md:mb-8">
            <DialogTitle className="text-lg md:text-4xl font-headline font-black text-destructive uppercase tracking-tight flex items-center gap-2.5 md:gap-4 whitespace-normal break-words text-left">
              <AlertCircle className="w-5 h-5 md:w-12 md:h-12 shrink-0" /> {t.detailedErrorAnalysis}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[55vh] md:h-[65vh] pr-1 md:pr-4 custom-scrollbar">
            <div className="space-y-3 md:space-y-6">
              {allErrors.map((error, idx) => (
                <Card key={idx} className="card-duo p-4 md:p-8 bg-card border-border hover:border-destructive/30 transition-all duration-300 shadow-none">
                  <div className="flex flex-col gap-3 md:gap-6">
                    <div className="flex flex-col gap-2 md:gap-3 flex-1 min-w-0 text-left">
                      <div className="flex flex-wrap items-center gap-1.5 md:gap-3">
                        <div className="px-2 md:px-4 py-1 md:py-2 bg-destructive text-white rounded-lg md:rounded-2xl text-[6px] md:text-10px font-black uppercase tracking-widest border-2 border-white/20 shadow-duo flex items-center gap-1 md:gap-1.5">
                          <AlertCircle className="w-2 md:w-3 h-2 md:h-3" /> {errorCategoryLabel(error.errorCategory, t, lang)}
                        </div>
                        <div className="px-2 md:px-4 py-1 md:py-2 bg-primary/10 text-primary rounded-lg md:rounded-2xl text-[6px] md:text-10px font-black uppercase tracking-widest border-2 border-primary/20 flex items-center gap-1 md:gap-1.5">
                          <Target className="w-2 md:w-3 h-2 md:h-3" /> <LatexText text={error.topic} />
                        </div>
                        {error.section && (
                          <div className="px-2 md:px-4 py-1 md:py-2 bg-muted text-muted-foreground rounded-lg md:rounded-2xl text-[6px] md:text-10px font-black uppercase tracking-widest border-2 border-border/50 flex items-center gap-1 md:gap-1.5">
                            <BookOpen className="w-2 md:w-3 h-2 md:h-3" /> {error.section}
                          </div>
                        )}
                        <span className="text-[6px] md:text-10px font-black uppercase text-muted-foreground tracking-widest ml-auto">
                          {formatStoredDate(error.sessionDate, lang)}
                        </span>
                      </div>
                      <h4 className="font-headline font-black text-xs md:text-xl text-foreground leading-snug whitespace-normal break-words mt-2">
                        <LatexText text={error.question} />
                      </h4>
                      <div className="space-y-4 md:space-y-4 bg-muted/30 p-4 md:p-6 rounded-xl md:rounded-[2rem] border-2 md:border-[4px] border-border/50 mt-2">
                        <div className="text-[9px] md:text-xs font-bold text-muted-foreground whitespace-normal break-words">
                          <span className="uppercase text-[7px] md:text-[10px] tracking-widest mr-2 opacity-60 block mb-1">{t.yourAnswer}:</span>
                          <div className="text-destructive p-3 rounded-lg bg-red-50/50 border border-red-100"><LatexText text={error.userAnswer} /></div>
                        </div>
                        <div className="text-[9px] md:text-xs font-bold text-green-600 whitespace-normal break-words">
                          <span className="uppercase text-[7px] md:text-[10px] tracking-widest mr-2 opacity-60 block mb-1">{t.correctAnswer}:</span>
                          <div className="p-3 rounded-lg bg-green-50/50 border-green-100"><LatexText text={error.correct} /></div>
                        </div>
                        {error.explanation && (
                          <div className="text-[9px] md:text-xs font-bold text-foreground whitespace-normal break-words pt-2 border-t border-border/50 text-left">
                            <span className="uppercase text-[7px] md:text-[10px] tracking-widest mr-2 opacity-60 block mb-1">{t.explanation}:</span>
                            <div className="italic opacity-80 leading-relaxed"><LatexText text={error.explanation} /></div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}


"use client";
import { uiMessage } from '@/lib/i18n';
import { copyTextToClipboard } from '@/lib/clipboard';

import { personalizedQuizPerformanceFeedback } from '@/ai/flows/personalized-quiz-feedback-flow';
import { LatexText } from '@/components/latex-text';
import { UiText } from "@/components/ui-text";
import { Button } from '@/components/ui/button';
import { Card,CardContent,CardHeader,CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { showErrorToast,showUnexpectedErrorToast } from '@/lib/error-toast';
import type { QuizQuestion } from '@/lib/learning-session';
import { TranslationSet } from '@/lib/translations';
import { Language,QuizAnalysis,QuizHistoryItem } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AlertCircle,ArrowRight,BrainCircuit,Check,Copy,Loader2,RefreshCw,RotateCcw,Trophy } from 'lucide-react';
import { useCallback,useEffect,useRef,useState } from 'react';

interface ResultViewProps {
  t: TranslationSet;
  lang: Language;
  results: Omit<QuizHistoryItem, 'date' | 'lang'>;
  onViewDashboard: () => void;
  onRetakeSame: (questions: QuizQuestion[]) => void;
  onRetakeNew: () => void;
  isArena?: boolean;
}

export default function ResultView({ t, lang, results, onViewDashboard, onRetakeSame, onRetakeNew, isArena }: ResultViewProps) {
  const { toast } = useToast();
  const [analysisData, setAnalysisData] = useState<QuizAnalysis | null>(results.analysis || null);
  const [requestLanguage] = useState(lang);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [isAnalyzing, setIsAnalyzing] = useState(!results.analysis);
  const [error, setError] = useState<boolean>(false);
  const [activeCopiedId, setActiveCopiedId] = useState<string | null>(null);

  const fetchAnalysis = useCallback(async () => {
    setIsAnalyzing(true);
    setError(false);
    try {
      const data = await personalizedQuizPerformanceFeedback({
        quizResults: results.quizResults,
        originalTopic: results.config.topic
      });
      if (!mounted.current) return;
      if (!data.ok) {
        showErrorToast(data.error, requestLanguage);
        setError(true);
        return;
      }
      setAnalysisData(data.data);
    } catch (e) {
      console.error("AI Performance Analysis failed", e);
      if (!mounted.current) return;
      showUnexpectedErrorToast('AI-REQUEST-FAILED', 'The performance analysis could not be generated.', {}, requestLanguage);
      setError(true);
    } finally {
      if (mounted.current) setIsAnalyzing(false);
    }
  }, [results, requestLanguage]);

  useEffect(() => {
    if (!results.analysis) {
      fetchAnalysis();
    }
  }, [results.analysis, fetchAnalysis]);

  // Determine current language analysis
  const currentAnalysis = analysisData?.[lang];
  const currentTopic = lang === 'vi' ? (results.config.topicVi || results.config.topic) : (results.config.topicEn || results.config.topic);

  const handleCopyToClipboard = useCallback(async (items: string[], title: string, id: string) => {
    const textContent = `${title.toUpperCase()}\n${items.map(item => `• ${item}`).join('\n')}`;
    if (await copyTextToClipboard(textContent)) {
      setActiveCopiedId(id);
      toast({ title: t.copied });
      setTimeout(() => setActiveCopiedId(null), 2000);
    } else showUnexpectedErrorToast('APP-CLIPBOARD-FAILED', '', {}, lang);
  }, [t.copied, toast, lang]);

  const correctCount = results.quizResults.filter(r => r.isCorrect).length;
  const quizScore = results.quizResults.length ? Math.round((correctCount / results.quizResults.length) * 100) : 0;

  const getScoreFeedback = () => {
    if (quizScore >= 90) return { text: t.scoreExcellent, variant: "primary" };
    if (quizScore >= 70) return { text: t.scoreGreat, variant: "green" };
    if (quizScore >= 50) return { text: t.scoreGood, variant: "orange" };
    return { text: t.scoreKeepTrying, variant: "muted" };
  };

  const scoreFeedback = getScoreFeedback();
  const timeMinutes = Math.floor(results.totalTime / 60);
  const timeSeconds = results.totalTime % 60;

  const retakeQuestions = results.quizResults.map(r => ({
    question: r.question,
    options: r.options,
    correct: r.correct,
    explanation: r.explanation,
    type: r.type,
    difficulty: r.difficulty,
    section: r.section
  }));

  return (
    <div className="space-y-8 md:space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700 pb-20 px-2 md:px-0">
      {/* Header Section */}
      <div className="text-center space-y-4">
        <div className="inline-block p-6 md:p-8 rounded-full bg-secondary shadow-duo relative mt-16 mb-4 group">
          <Trophy className={cn("w-16 h-16 md:w-24 md:h-24 fill-current transition-all group-hover:scale-105 duration-500", quizScore < 50 ? 'text-muted-foreground' : 'text-primary')} />
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] md:text-xs font-black px-4 md:px-6 py-2 md:py-3 rounded-2xl shadow-xl whitespace-nowrap border-2 border-white/20 z-10 animate-in zoom-in-50 duration-500 delay-300">
            {scoreFeedback.text}
          </div>
        </div>

        <h1 className="text-5xl md:text-8xl font-headline font-black text-primary uppercase tracking-tighter">
          {t.scoreLabel}: {quizScore}%
        </h1>

        <p className="text-muted-foreground font-black text-[10px] md:text-base uppercase tracking-widest px-4 max-w-2xl mx-auto leading-relaxed">
          {t.topic.toUpperCase()}: {currentTopic.toUpperCase()} - {t.completedIn.toUpperCase()} {timeMinutes}{t.minShort} {timeSeconds}{t.secShort}
        </p>
      </div>

      {/* Analysis Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
        {isAnalyzing ? (
          <div className="md:col-span-3 flex flex-col items-center justify-center p-12 bg-muted/10 rounded-[2.5rem] border-4 border-dashed border-border/50 animate-pulse">
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
            <p className="font-black uppercase tracking-widest text-sm text-muted-foreground">{t.analyzingResults}</p>
          </div>
        ) : error || !currentAnalysis ? (
          <div className="md:col-span-3 flex flex-col items-center justify-center p-12 bg-destructive/5 rounded-[2.5rem] border-4 border-dashed border-destructive/20 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-destructive" />
            <p className="font-black uppercase tracking-widest text-sm text-destructive">{uiMessage(lang, "resultview.could_not_load_analysis")}</p>
            <Button variant="outline" onClick={fetchAnalysis} className="btn-duo border-destructive/20 text-destructive font-black uppercase tracking-widest text-xs px-8 h-12">
              {uiMessage(lang, "resultview.retry")}
            </Button>
          </div>
        ) : (
          <>
            <PerformanceInsightCard
              title={t.strengths}
              copyLabel={t.copy}
              items={currentAnalysis.strengths}
              variantClass="text-green-700 border-green-500/20 bg-green-500/5 hover-lift"
              onCopy={() => handleCopyToClipboard(currentAnalysis.strengths, t.strengths, 'strengths')}
              isCopied={activeCopiedId === 'strengths'}
            />
            <PerformanceInsightCard
              title={t.weaknesses}
              copyLabel={t.copy}
              items={currentAnalysis.weaknesses}
              variantClass="text-red-700 border-red-500/20 bg-red-500/5 hover-lift"
              onCopy={() => handleCopyToClipboard(currentAnalysis.weaknesses, t.weaknesses, 'weaknesses')}
              isCopied={activeCopiedId === 'weaknesses'}
            />
            <PerformanceInsightCard
              title={t.recommendations}
              copyLabel={t.copy}
              items={currentAnalysis.recommendations}
              variantClass="text-primary border-primary/20 bg-primary/5 hover-lift"
              onCopy={() => handleCopyToClipboard(currentAnalysis.recommendations, t.recommendations, 'recommendations')}
              isCopied={activeCopiedId === 'recommendations'}
              isEducational
            />
          </>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col md:flex-row gap-4 md:gap-8 justify-center items-center pt-8">
        <div className="flex flex-col sm:flex-row w-full md:w-auto gap-4 md:gap-6 min-w-0">
          <Button variant="outline" size="lg" onClick={() => onRetakeSame(retakeQuestions)} className="btn-duo h-14 md:h-18 rounded-2xl flex-1 md:px-10 border-[3px] font-black text-xs md:text-sm uppercase tracking-wider bg-card">
            <RotateCcw className="mr-2 w-5 h-5" /> {t.retakeSame}
          </Button>
          {!isArena && (
            <Button variant="outline" size="lg" onClick={onRetakeNew} className="btn-duo h-14 md:h-18 rounded-2xl flex-1 md:px-10 border-[3px] font-black text-xs md:text-sm uppercase tracking-wider bg-card">
              <RefreshCw className="mr-2 w-5 h-5" /> {t.retakeNew}
            </Button>
          )}
        </div>
        <Button size="lg" onClick={onViewDashboard} className="btn-duo h-16 md:h-22 w-full md:w-auto rounded-[2rem] px-16 text-xl md:text-3xl font-black bg-primary text-white border-[4px] border-white/20 uppercase tracking-tight">
          {t.dashboard} <ArrowRight className="ml-3 w-8 h-8 md:w-10 md:h-10" />
        </Button>
      </div>
    </div>
  );
}

function PerformanceInsightCard({ title, copyLabel, items, variantClass, onCopy, isCopied, isEducational }: { title: string, copyLabel: string, items: string[], variantClass: string, onCopy: () => void, isCopied: boolean, isEducational?: boolean }) {
  return (
    <Card className={cn("card-duo border-[3px] transition-all duration-300 overflow-hidden", variantClass)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 p-6 md:p-8">
        <CardTitle className="font-headline font-black text-sm md:text-lg uppercase tracking-tight flex items-center gap-2">
          <div className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-current animate-pulse" /> {title}
        </CardTitle>
        {items && items.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 md:h-10 md:w-10 rounded-xl opacity-40 hover:opacity-100 hover:bg-current/10 transition-all"
            onClick={(e) => { e.stopPropagation(); onCopy(); }}
            aria-label={`${copyLabel}: ${title}`}
          >
            {isCopied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-6 md:p-8 pt-0 md:pt-0">
        <ul className="space-y-3 md:space-y-4">
          {items && items.length > 0 ? (
            items.map((item, i) => (
              <li key={i} className="flex gap-3 text-xs md:text-base font-bold leading-relaxed break-words hover:translate-x-0.5 transition-transform">
                {isEducational ? (
                  <BrainCircuit className="w-4 h-4 md:w-5 md:h-5 shrink-0 mt-0.5 opacity-60" />
                ) : (
                  <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-current shrink-0 mt-2 opacity-60" />
                )}
                <LatexText text={item} />
              </li>
            ))
          ) : (
            <li className="text-xs italic opacity-50"><UiText id="noData" /></li>
          )}
        </ul>
      </CardContent>
    </Card>
  );
}

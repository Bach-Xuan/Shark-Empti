
"use client";
import { messages, uiMessage } from '@/lib/i18n';
import type { DashboardStats } from '@/lib/stats-utils';

import { validateAcademicTopic } from '@/ai/flows/academic-validation-flow';
import { generateFlashcards } from '@/ai/flows/generate-flashcards-flow';
import { generatePractice } from '@/ai/flows/generate-practice-flow';
import { LatexText } from '@/components/latex-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs,TabsContent,TabsList,TabsTrigger } from '@/components/ui/tabs';
import { useFirestore,useUser } from '@/firebase';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';
import { showErrorToast,showUnexpectedErrorToast } from '@/lib/error-toast';
import { TranslationSet } from '@/lib/translations';
import { Flashcard,Language,PracticeQuestion } from '@/lib/types';
import { cn } from '@/lib/utils';
import { addDoc,collection } from 'firebase/firestore';
import {
ArrowLeft,
ArrowRight,
BrainCircuit,
Check,
CheckCircle2,
Gamepad2,
Info,
Layers,
Loader2,
MessageSquare,
RotateCcw,
Sparkles,
Target,
Trophy,
XCircle,
Zap
} from 'lucide-react';
import React,{ useEffect,useMemo,useRef,useState } from 'react';
import FeatureHelp from './feature-help';

interface PlaygroundViewProps {
  t: TranslationSet;
  lang: Language;
  weakPoints: DashboardStats['processedGroupedInsights'];
  totalAttempts: number;
  totalErrors: number;
  initialConfig: { tab: 'flashcards' | 'practice'; concept?: string } | null;
  onAskGuru: (message: string) => void;
}

export default function PlaygroundView({ t, lang, weakPoints, totalAttempts, totalErrors, initialConfig, onAskGuru }: PlaygroundViewProps) {
  const [activeTab, setActiveTab] = useState<'flashcards' | 'practice'>(initialConfig?.tab || 'flashcards');

  return (
    <div className="flex flex-col items-center w-full space-y-8 md:space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700 pb-20">
      {/* Header Section */}
      <div className="text-center space-y-4 px-4 pt-4">
        <div className="inline-flex p-4 md:p-6 bg-primary/10 rounded-[1.5rem] md:rounded-[3rem] border-4 border-primary/20 mb-2 animate-bounce-subtle">
          <Gamepad2 className="w-8 h-8 md:w-16 text-primary" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl md:text-7xl font-headline font-black text-primary uppercase tracking-tighter leading-tight flex items-center justify-center gap-4">
            {t.playground}
            <FeatureHelp
              helpTitle={t.helpTitle}
              title={t.playground}
              items={t.playgroundHelp}
              storageKey="shark_help_playground_seen"
            />
          </h1>
          <p className="text-muted-foreground font-black text-[9px] md:text-lg uppercase tracking-[0.2em] opacity-60">
            {t.appTagline}
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={value => { if (value === 'flashcards' || value === 'practice') setActiveTab(value); }} className="w-full flex flex-col items-center">
        <div className="flex justify-center mb-6 md:mb-12 px-4 w-full">
          <TabsList className="h-14 md:h-20 p-1.5 md:p-2 bg-muted/30 border-[3px] md:border-[4px] border-border rounded-full w-full max-w-md shadow-inner">
            <TabsTrigger
              value="flashcards"
              className="flex-1 rounded-full h-full font-black uppercase text-[8px] md:text-xs tracking-[0.1em] md:tracking-[0.15em] data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-[0_4px_0_0_rgba(0,0,0,0.2)] md:data-[state=active]:shadow-[0_8px_0_0_rgba(0,0,0,0.2)] transition-all duration-300 gap-1.5 md:gap-3 group active:translate-y-1"
            >
              <Layers className="w-3.5 h-3.5 md:w-5 md:h-5 group-data-[state=active]:animate-pulse" />
              {t.flashcards}
            </TabsTrigger>
            <TabsTrigger
              value="practice"
              className="flex-1 rounded-full h-full font-black uppercase text-[8px] md:text-xs tracking-[0.1em] md:tracking-[0.15em] data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-[0_4px_0_0_rgba(0,0,0,0.2)] md:data-[state=active]:shadow-[0_8px_0_0_rgba(0,0,0,0.2)] transition-all duration-300 gap-1.5 md:gap-3 group active:translate-y-1"
            >
              <Zap className="w-3.5 h-3.5 md:w-5 md:h-5 group-data-[state=active]:animate-pulse" />
              {t.practice}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="flashcards" className="w-full animate-in zoom-in-95 duration-500 outline-hidden flex flex-col items-center focus:ring-0">
          <FlashcardGame t={t} lang={lang} weakPoints={weakPoints} totalAttempts={totalAttempts} initialConcept={initialConfig?.tab === 'flashcards' ? initialConfig.concept : undefined} />
        </TabsContent>

        <TabsContent value="practice" className="w-full animate-in zoom-in-95 duration-500 outline-hidden flex flex-col items-center focus:ring-0">
          <PracticeMode
            t={t}
            lang={lang}
            weakPoints={weakPoints}
            totalAttempts={totalAttempts}
            totalErrors={totalErrors}
            initialConcept={initialConfig?.tab === 'practice' ? initialConfig.concept : undefined}
            onAskGuru={onAskGuru}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FlashcardGame({ t, lang, weakPoints, totalAttempts, initialConcept }: { t: TranslationSet, lang: Language, weakPoints: DashboardStats['processedGroupedInsights'], totalAttempts: number, initialConcept?: string }) {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [topic, setTopic] = useState(initialConcept || (weakPoints[0]?.topic || ""));
  const [numCards, setNumCards] = useState(10);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const startSession = async () => {
    if (pending.current) return;
    if (!topic.trim()) {
      showUnexpectedErrorToast('VALIDATION-TOPIC-REQUIRED', 'Enter a topic before starting.', {}, lang);
      return;
    }

    pending.current = true;
    setIsValidating(true);
    try {
      const validation = await validateAcademicTopic({
        topic: topic,
        language: lang as 'en' | 'vi'
      });

      if (!mounted.current) return;
      if (!validation.ok) {
        showErrorToast(validation.error, lang);
        return;
      }

      if (!validation.data.isValid) {
        toast({
          variant: "destructive",
          title: t.invalidTopic.toUpperCase(),
          description: validation.data.reason || t.notAcademic.toUpperCase(),
        });
        setIsValidating(false);
        return;
      }

      setIsValidating(false);
      setIsGenerating(true);

      const result = await generateFlashcards({ topic, numCards, language: lang as 'en' | 'vi' });
      if (!mounted.current) return;
      if (!result.ok) {
        showErrorToast(result.error, lang);
        return;
      }
      setCards(result.data.cards);
      setCurrentIdx(0);
      setIsFlipped(false);

      if (user && db) {
        const sessionRef = collection(db, 'users', user.uid, 'flashcards');
        addDoc(sessionRef, {
          userId: user.uid,
          sourceType: initialConcept ? 'weak_point' : 'manual',
          sourceValue: topic,
          cards: result.data.cards,
          createdAt: new Date().toISOString()
        }).catch(error => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({ path: sessionRef.path, operation: 'create' }, error));
        });
      }
    } catch (e) {
      console.error(e);
      showUnexpectedErrorToast('AI-REQUEST-FAILED', 'Flashcards could not be generated.', {}, lang);
      setIsValidating(false);
    } finally {
      pending.current = false;
      setIsValidating(false);
      setIsGenerating(false);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIdx(currentIndex - 1);
      setIsFlipped(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < cards.length - 1) {
      setCurrentIdx(currentIndex + 1);
      setIsFlipped(false);
    }
  };

  const handleFinish = () => {
    setCards([]);
  };

  const handleNumChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = parseInt(e.target.value);
    if (isNaN(val)) {
      setNumCards(0);
      return;
    }
    if (val > 50) val = 50;
    setNumCards(val);
  };

  const handleNumBlur = () => {
    if (numCards < 1) setNumCards(1);
  };

  const isFlashcardsDisabled = totalAttempts === 0;

  if (isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center p-8 md:p-24 space-y-8 md:space-y-10">
        <div className="relative">
          <Loader2 className="w-16 h-16 md:w-28 md:h-28 animate-spin text-primary opacity-20" />
          <Sparkles className="absolute inset-0 m-auto w-8 h-8 md:w-14 md:h-14 text-primary animate-pulse" />
        </div>
        <p className="text-lg md:text-4xl font-headline font-black text-primary animate-pulse uppercase tracking-tight text-center max-w-lg leading-tight px-4">
          {t.generatingFlashcards}
        </p>
      </div>
    );
  }

  if (cards.length > 0) {
    const card = cards[currentIndex];
    const isLastCard = currentIndex === cards.length - 1;

    return (
      <div className="w-full max-w-4xl space-y-6 md:space-y-12 px-4 animate-in fade-in duration-500">
        <div className="space-y-3 md:space-y-4">
          <div className="flex justify-between items-center px-1">
            <span className="text-[9px] md:text-sm font-black text-muted-foreground uppercase tracking-[0.2em]">{t.progress}: {currentIndex + 1} / {cards.length}</span>
            <Button variant="ghost" onClick={() => setCards([])} className="h-8 md:h-10 px-3 md:px-4 rounded-lg md:rounded-xl font-black uppercase text-[9px] md:text-xs tracking-widest hover:bg-destructive/10 hover:text-destructive transition-colors border-2 border-transparent">{t.cancel}</Button>
          </div>
          <div className="progress-duo h-2.5 md:h-4 border-[2px]">
            <div className="progress-duo-bar" style={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }} />
          </div>
        </div>

        <div className="relative h-[300px] sm:h-[400px] md:h-[500px] perspective-2000">
          <div className="w-full h-full transition-all duration-300 hover:-translate-y-2">
            <div
              onClick={() => setIsFlipped(!isFlipped)}
              className={cn(
                "w-full h-full relative preserve-3d transition-transform duration-700 cursor-pointer",
                isFlipped && "rotate-y-180"
              )}
            >
              {/* Front Side */}
              <div className="absolute inset-0 backface-hidden p-6 md:p-12 flex flex-col items-center justify-center text-center bg-card border-[3px] md:border-[5px] border-border rounded-[1.2rem] md:rounded-[3rem] shadow-duo group">
                <div className="w-10 h-10 md:w-16 md:h-16 rounded-xl md:rounded-[1.2rem] bg-primary/10 flex items-center justify-center border-[2px] md:border-[3px] border-primary/20 shrink-0 mb-4 md:mb-6 group-hover:scale-110 transition-transform">
                  <MessageSquare className="w-5 h-5 md:w-8 md:h-8 text-primary" />
                </div>
                <div className="flex-1 flex flex-col justify-center w-full min-h-0 overflow-y-auto custom-scrollbar px-2">
                  <h3 className="text-lg sm:text-2xl md:text-3xl font-headline font-black leading-tight text-foreground uppercase tracking-tight">
                    <LatexText text={card.front} />
                  </h3>
                </div>
                <p className="text-[7px] md:text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-40 animate-pulse mt-3 md:mt-4">
                  {uiMessage(lang, "playgroundview.tap_to_reveal")}
                </p>
              </div>

              {/* Back Side */}
              <div className="absolute inset-0 backface-hidden rotate-y-180 p-6 md:p-12 flex flex-col items-center justify-center text-center bg-primary/5 border-[3px] md:border-[5px] border-primary/30 rounded-[1.2rem] md:rounded-[3rem] shadow-duo">
                <div className="w-10 h-10 md:w-16 md:h-16 rounded-xl md:rounded-[1.2rem] bg-primary/20 flex items-center justify-center border-[2px] md:border-[3px] border-primary/30 shrink-0 mb-4 md:mb-6">
                  <Sparkles className="w-5 h-5 md:w-8 md:h-8 text-primary" />
                </div>
                <div className="flex-1 flex flex-col justify-center w-full min-h-0 overflow-y-auto custom-scrollbar px-2 italic">
                  <div className="text-sm sm:text-lg md:text-2xl font-bold leading-relaxed text-foreground whitespace-pre-wrap">
                    <LatexText text={card.back} />
                  </div>
                </div>
                <p className="text-[7px] md:text-[10px] font-black uppercase tracking-[0.3em] text-primary opacity-60 mt-3 md:mt-4">
                  {uiMessage(lang, "playgroundview.reverse")}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 md:gap-8 justify-center">
          <Button
            variant="outline"
            disabled={currentIndex === 0}
            onClick={handlePrev}
            className="btn-duo flex-1 h-12 md:h-20 rounded-xl md:rounded-[2rem] border-[3px] border-border text-foreground font-black uppercase tracking-[0.1em] md:tracking-[0.15em] text-[9px] md:text-lg bg-card disabled:opacity-50"
          >
            <ArrowLeft className="mr-1.5 md:mr-3 w-3.5 h-3.5 md:w-6 md:h-6" /> {t.prevCard}
          </Button>

          {isLastCard ? (
            <Button
              onClick={handleFinish}
              className="btn-duo flex-1 h-12 md:h-20 rounded-xl md:rounded-[2rem] bg-foreground text-background border-[3px] border-foreground/20 font-black uppercase tracking-[0.1em] md:tracking-[0.15em] text-[9px] md:text-lg"
            >
              <Check className="mr-1.5 md:mr-3 w-3.5 h-3.5 md:w-6 md:h-6" /> {t.finishSession}
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              className="btn-duo flex-1 h-12 md:h-20 rounded-xl md:rounded-[2rem] bg-primary text-white border-[3px] border-white/20 font-black uppercase tracking-[0.1em] md:tracking-[0.15em] text-[9px] md:text-lg"
            >
              {t.nextCard} <ArrowRight className="ml-1.5 md:ml-3 w-3.5 h-3.5 md:w-6 md:h-6" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card className="card-duo w-full max-w-3xl p-6 md:p-16 space-y-8 md:space-y-14 group shadow-none hover:shadow-[0_15px_0_0_var(--duo-shadow)] border-primary/10 mx-2">
      <div className="space-y-4 text-center">
        <div className={cn(
          "w-16 h-16 md:w-28 md:h-28 rounded-xl md:rounded-[2.5rem] bg-primary/10 flex items-center justify-center border-[2px] md:border-[3px] border-primary/20 mx-auto transition-transform group-hover:scale-110 duration-500 shadow-duo",
          isFlashcardsDisabled && "opacity-40"
        )}>
          <Layers className="w-8 h-8 md:w-14 md:h-14 text-primary" />
        </div>
        <h2 className="text-2xl md:text-5xl font-headline font-black text-primary uppercase tracking-tighter leading-tight">{t.flashcards}</h2>
        <p className="text-[9px] md:text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">{uiMessage(lang, "playgroundview.review_core_concepts")}</p>
      </div>

      <div className="space-y-8 md:space-y-10">
        <div className="space-y-4 group">
          <Label className="text-[9px] md:text-xs font-black uppercase text-muted-foreground tracking-[0.2em] px-1 flex items-center gap-2 group-hover:text-primary transition-colors">
            <Target className="w-3.5 h-3.5 md:w-4 md:h-4 transition-transform group-hover:-translate-y-0.5" /> {t.topic}
          </Label>

          {!isFlashcardsDisabled ? (
            <div className="flex flex-wrap gap-2 md:gap-3">
              {weakPoints.map((wp, i) => (
                <Button
                  key={i}
                  variant={topic === wp.topic ? "default" : "outline"}
                  onClick={() => setTopic(wp.topic)}
                  className={cn(
                    "h-10 md:h-16 rounded-lg md:rounded-[1.5rem] text-[9px] md:text-sm font-black uppercase tracking-widest border-[2px] md:border-[3px] px-4 md:px-10 btn-duo shadow-none transition-all",
                    topic === wp.topic
                      ? "bg-primary text-white border-primary/20 translate-y-[-4px] shadow-duo"
                      : "bg-card border-border hover:border-primary/40 hover:bg-primary/5"
                  )}
                >
                  <LatexText text={wp.topic} />
                </Button>
              ))}
              {weakPoints.length === 0 && (
                <p className="text-[10px] md:text-sm font-black text-muted-foreground uppercase tracking-widest opacity-50 px-2 italic">
                  {t.noWeakPoints}
                </p>
              )}
            </div>
          ) : (
            <div className="p-8 md:p-16 bg-muted/20 border-[2px] md:border-[3px] border-dashed border-border rounded-xl md:rounded-[2rem] text-center animate-in fade-in duration-700 flex flex-col items-center gap-3 md:gap-4">
              <div className="w-10 h-10 md:w-16 md:h-16 rounded-full bg-muted/40 flex items-center justify-center">
                <Info className="w-5 h-5 md:w-8 md:h-8 text-muted-foreground opacity-50" />
              </div>
              <p className="text-[8px] md:text-sm font-black text-muted-foreground uppercase tracking-[0.2em] leading-loose max-w-sm">
                {t.noHistoryToFlashcards}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-4 group">
          <Label className="text-[9px] md:text-xs font-black uppercase text-muted-foreground tracking-[0.2em] px-1 flex items-center gap-2 group-hover:text-primary transition-colors">
            <Layers className="w-3.5 h-3.5 md:w-4 md:h-4" /> {t.numCards} (1-50)
          </Label>
          <div className="flex items-center gap-3 md:gap-6">
            <Input
              type="number"
              value={numCards}
              onChange={handleNumChange}
              onBlur={handleNumBlur}
              min={1} max={50}
              disabled={isFlashcardsDisabled}
              className="h-12 md:h-20 rounded-xl md:rounded-[1.5rem] border-[3px] border-border font-black text-lg md:text-4xl bg-muted/10 text-center w-24 md:w-40 shadow-inner focus:ring-4 md:ring-8 focus:ring-primary/10 transition-all focus:border-primary disabled:opacity-30"
            />
            <span className="text-muted-foreground font-black uppercase text-[9px] md:text-xs tracking-[0.2em]">{uiMessage(lang, "playgroundview.cards")}</span>
          </div>
        </div>

        <Button
          onClick={startSession}
          disabled={!topic.trim() || isGenerating || isValidating || isFlashcardsDisabled}
          className="w-full h-14 md:h-24 rounded-xl md:rounded-[2.5rem] btn-duo bg-primary text-white border-[3px] md:border-[5px] border-white/20 font-black text-base md:text-3xl uppercase tracking-[0.1em] shadow-duo group active:translate-y-2"
        >
          {isValidating ? (
             <div className="flex items-center gap-2 md:gap-3">
               <Loader2 className="w-5 h-5 md:w-10 md:h-10 animate-spin" />
               {t.analyzing}
             </div>
          ) : (
            <div className="flex items-center gap-2 md:gap-3">
              {t.startLearning} <ArrowRight className="ml-1.5 md:ml-4 w-5 h-5 md:w-10 md:h-10 group-hover:translate-x-2 transition-transform" />
            </div>
          )}
        </Button>
      </div>
    </Card>
  );
}

type PracticeFeedback = PracticeQuestion & { userAnswer: string; isCorrect: boolean };
function PracticeMode({ t, lang, weakPoints, totalAttempts, totalErrors, initialConcept, onAskGuru }: { t: TranslationSet, lang: Language, weakPoints: DashboardStats['processedGroupedInsights'], totalAttempts: number, totalErrors: number, initialConcept?: string, onAskGuru: (msg: string) => void }) {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();

  const topicsWithMistakes = useMemo(() =>
    weakPoints.filter(wp => wp.errorCount && wp.errorCount > 0)
  , [weakPoints]);

  const [concept, setConcept] = useState(initialConcept || (topicsWithMistakes[0]?.topic || ""));
  const [numQuestions, setNumQuestions] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [currentIndex, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<PracticeFeedback[]>([]);
  const [currentFeedback, setCurrentFeedback] = useState<PracticeFeedback | null>(null);
  const [shortAnswer, setShortAnswer] = useState("");
  const [isFinishing, setIsFinishing] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(false);
  const advancing = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  useEffect(() => {
    if (!concept && topicsWithMistakes.length > 0) {
      setConcept(topicsWithMistakes[0].topic);
    }
  }, [topicsWithMistakes, concept]);

  const startSession = async () => {
    if (pending.current) return;
    if (!concept.trim()) {
      showUnexpectedErrorToast('VALIDATION-CONCEPT-REQUIRED', 'Enter a concept before starting.', {}, lang);
      return;
    }

    pending.current = true;
    setIsValidating(true);
    try {
      const validation = await validateAcademicTopic({
        topic: concept,
        language: lang as 'en' | 'vi'
      });

      if (!mounted.current) return;
      if (!validation.ok) {
        showErrorToast(validation.error, lang);
        return;
      }

      if (!validation.data.isValid) {
        toast({
          variant: "destructive",
          title: t.invalidTopic.toUpperCase(),
          description: validation.data.reason || t.notAcademic.toUpperCase(),
        });
        setIsValidating(false);
        return;
      }

      setIsValidating(false);
      setIsGenerating(true);

      const result = await generatePractice({ concept, numQuestions, language: lang as 'en' | 'vi' });
      if (!mounted.current) return;
      if (!result.ok) {
        showErrorToast(result.error, lang);
        return;
      }
      setQuestions(result.data.questions);
      setCurrentIdx(0);
      setAnswers([]);
    } catch (e) {
      console.error(e);
      showUnexpectedErrorToast('AI-REQUEST-FAILED', 'Practice questions could not be generated.', {}, lang);
      setIsValidating(false);
    } finally {
      pending.current = false;
      setIsValidating(false);
      setIsGenerating(false);
    }
  };

  const handleRetry = () => {
    setCurrentIdx(0);
    setAnswers([]);
    setCurrentFeedback(null);
    setIsFinishing(false);
    setShortAnswer("");
  };

  const handleAnswer = (ans: string) => {
    if (currentFeedback) return;
    advancing.current = false;
    const q = questions[currentIndex];
    const isCorrect = ans.toLowerCase().trim() === q.correct.toLowerCase().trim();
    const feedback = { ...q, userAnswer: ans, isCorrect };
    setCurrentFeedback(feedback);
  };

  const handleNext = () => {
    if (!currentFeedback || isFinishing || advancing.current) return;
    advancing.current = true;
    const updated = [...answers, currentFeedback];
    setAnswers(updated);
    setCurrentFeedback(null);
    setShortAnswer("");

    if (currentIndex + 1 < questions.length) {
      setCurrentIdx(currentIndex + 1);
    } else {
      setIsFinishing(true);
      const score = Math.round((updated.filter(a => a.isCorrect).length / questions.length) * 100);
      if (user && db) {
        const sessionRef = collection(db, 'users', user.uid, 'practice');
        addDoc(sessionRef, {
          userId: user.uid,
          concept,
          questions,
          userAnswers: updated,
          score,
          createdAt: new Date().toISOString()
        }).catch(error => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({ path: sessionRef.path, operation: 'create' }, error));
        });
      }
    }
  };

  const handleAskGuruForDetail = () => {
    const q = questions[currentIndex];
    if (!q || !currentFeedback) return;
    const message = `${t.askSharkGuruPrompt}\n\n📍 **${messages(lang).common.question}**: "${q.question}"\n✅ **${t.correctAnswer}**: "${q.correct}"\n📝 **${t.explanation}**: "${q.explanation}"`;
    onAskGuru(message);
  };

  const handleBackToPlayground = () => {
    setQuestions([]);
    setAnswers([]);
    setCurrentIdx(0);
    setCurrentFeedback(null);
    setIsFinishing(false);
    setShortAnswer("");
  };

  const handleNumChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = parseInt(e.target.value);
    if (isNaN(val)) {
      setNumQuestions(0);
      return;
    }
    if (val > 50) val = 50;
    setNumQuestions(val);
  };

  const handleNumBlur = () => {
    if (numQuestions < 1) setNumQuestions(1);
  };

  const isPracticeDisabled = totalAttempts === 0 || totalErrors === 0;
  const disabledMessage = totalAttempts === 0 ? t.noHistoryToPractice : t.noMistakesToPractice;

  if (isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center p-8 md:p-24 space-y-8 md:space-y-10 text-center">
        <div className="relative">
          <Loader2 className="w-16 h-16 md:w-28 md:h-28 animate-spin text-primary opacity-20" />
          <Zap className="absolute inset-0 m-auto w-8 h-8 md:w-14 md:h-14 text-primary animate-pulse" />
        </div>
        <p className="text-lg md:text-4xl font-headline font-black text-primary animate-pulse uppercase tracking-tight max-w-lg leading-tight px-4">
          {t.generatingPractice}
        </p>
      </div>
    );
  }

  if (isFinishing) {
    const correctCount = answers.filter(a => a.isCorrect).length;
    const score = Math.round((correctCount / questions.length) * 100);
    return (
      <div className="w-full max-w-4xl space-y-6 md:space-y-16 animate-in zoom-in-95 duration-500 px-4">
        <Card className="card-duo p-6 md:p-20 text-center space-y-8 md:space-y-10 border-primary/20 bg-primary/5">
          <div className="relative inline-block">
            <div className="w-20 h-20 md:w-40 md:h-40 rounded-full bg-secondary mx-auto flex items-center justify-center shadow-duo border-4 border-white/20">
              <Trophy className="w-10 h-10 md:w-20 md:h-20 text-primary fill-current animate-bounce-subtle" />
            </div>
            <div className="absolute -top-2 -right-2 md:-top-3 md:-right-3 bg-primary text-white rounded-lg md:rounded-2xl px-3 md:px-6 py-1 md:py-3 text-sm md:text-3xl font-black shadow-xl border-2 md:border-4 border-white/20 animate-in zoom-in-50 delay-300">
              {score}%
            </div>
          </div>

          <div className="space-y-3 md:space-y-4">
            <h2 className="text-2xl md:text-6xl font-headline font-black text-primary uppercase tracking-tighter leading-tight">{t.practiceResult}</h2>
            <p className="text-sm md:text-2xl font-bold text-muted-foreground italic leading-relaxed max-w-2xl mx-auto px-1">
              {score >= 80 ? t.scoreImprovement : t.scoreRetry}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 md:gap-6 justify-center pt-4 md:pt-8">
            <Button variant="outline" onClick={handleRetry} className="btn-duo h-12 md:h-20 rounded-xl md:rounded-[2rem] px-6 md:px-10 font-black uppercase text-[9px] md:text-lg tracking-widest bg-card">
              <RotateCcw className="mr-1.5 md:mr-3 w-4 h-4 md:w-6 md:h-6" /> {t.retryPractice}
            </Button>
            <Button onClick={handleBackToPlayground} className="btn-duo h-12 md:h-20 rounded-xl md:rounded-[2rem] px-6 md:px-12 bg-primary text-white font-black uppercase text-[9px] md:text-lg tracking-widest border-2 md:border-4 border-white/20">
              {t.backToPlayground} <ArrowRight className="ml-1.5 md:ml-3 w-4 h-4 md:w-6 md:h-6" />
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (questions.length > 0) {
    const q = questions[currentIndex];
    return (
      <div className="w-full max-w-5xl space-y-6 md:space-y-12 animate-in slide-in-from-bottom-8 duration-500 px-4">
        <div className="space-y-3 md:space-y-4">
          <div className="flex justify-between items-end text-[8px] md:text-sm font-black text-muted-foreground uppercase tracking-[0.2em] px-1">
            <span className="bg-muted px-2.5 py-1 md:px-4 md:py-1.5 rounded-full border-2">{t.practice}: {currentIndex + 1} / {questions.length}</span>
            <span className="text-primary truncate max-w-[120px] md:max-w-md flex items-center gap-1.5 md:gap-2">
              <BrainCircuit className="w-3.5 h-3.5 md:w-5 md:h-5" /> {concept.toUpperCase()}
            </span>
          </div>
          <div className="progress-duo h-2.5 md:h-5 border-[2px]">
            <div className="progress-duo-bar" style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }} />
          </div>
        </div>

        <Card className="card-duo p-5 md:p-16 min-h-[350px] md:min-h-[550px] flex flex-col justify-between shadow-none hover:shadow-[0_15px_0_0_var(--duo-shadow)] transition-all relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />

          <div className="space-y-6 md:space-y-12 relative z-10">
            <h2 className="text-lg sm:text-2xl md:text-3xl font-headline font-black leading-normal tracking-tight text-foreground uppercase">
              <LatexText text={q.question} />
            </h2>

            {q.type === 'Multiple Choice' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
                {q.options?.map((opt, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    disabled={!!currentFeedback}
                    onClick={() => handleAnswer(opt)}
                    className={cn(
                      "h-auto min-h-[60px] md:min-h-[90px] py-3.5 md:py-6 px-5 md:px-10 rounded-xl md:rounded-[2rem] border-[3px] font-black text-[11px] md:text-xl whitespace-normal break-words leading-tight btn-duo bg-card transition-all text-left justify-start",
                      currentFeedback && opt === q.correct ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-900/30" :
                      currentFeedback && opt === currentFeedback.userAnswer && !currentFeedback.isCorrect ? "border-red-500 bg-red-50 text-red-700 dark:bg-red-900/30" :
                      "border-border hover:border-primary/40 hover:bg-primary/5"
                    )}
                  >
                    <LatexText text={opt} />
                  </Button>
                ))}
              </div>
            ) : (
              <div className="space-y-5 md:space-y-10">
                <Input
                  value={shortAnswer}
                  onChange={(e) => setShortAnswer(e.target.value)}
                  disabled={!!currentFeedback}
                  placeholder={t.typeYourAnswer}
                  className="h-14 md:h-24 rounded-xl md:rounded-[2rem] border-[3px] border-border font-black text-sm md:text-4xl text-center bg-muted/10 shadow-inner px-6 md:px-8 focus:ring-4 md:ring-8 focus:ring-primary/10 transition-all focus:border-primary"
                  onKeyDown={(e) => e.key === 'Enter' && handleAnswer(shortAnswer)}
                />
                {!currentFeedback && (
                  <Button onClick={() => handleAnswer(shortAnswer)} disabled={!shortAnswer.trim()} className="w-full h-12 md:h-20 rounded-xl md:rounded-[2rem] btn-duo bg-primary text-white border-[3px] md:border-[4px] border-white/20 font-black text-base md:text-3xl uppercase tracking-[0.1em]">
                    {t.submitAnswer}
                  </Button>
                )}
              </div>
            )}
          </div>

          {currentFeedback && (
            <div className={cn(
              "mt-8 md:mt-16 p-6 md:p-12 rounded-xl md:rounded-[3rem] border-[3px] md:border-[5px] animate-in slide-in-from-top-6 duration-500 space-y-6 md:space-y-10 shadow-2xl relative",
              currentFeedback.isCorrect ? "bg-green-50 border-green-200 dark:bg-green-900/20" : "bg-red-50 border-red-200 dark:bg-red-900/20"
            )}>
              <div className="flex items-center gap-3 md:gap-8">
                {currentFeedback.isCorrect ? <CheckCircle2 className="w-8 h-8 md:w-16 md:h-16 text-green-500" /> : <XCircle className="w-8 h-8 md:w-16 md:h-16 text-red-500" />}
                <span className={cn("text-xl md:text-5xl font-headline font-black uppercase tracking-tighter", currentFeedback.isCorrect ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400")}>
                  {currentFeedback.isCorrect ? t.correct : t.incorrect}
                </span>
              </div>

              <div className="space-y-6 md:space-y-8">
                <div className="space-y-2">
                  <p className="font-black text-muted-foreground uppercase text-[7px] md:text-xs tracking-widest pl-1">{t.correctAnswer}:</p>
                  <div className="p-4 md:p-6 bg-white/40 dark:bg-black/20 rounded-xl md:rounded-2xl border-2 border-current/10">
                    <p className="text-sm md:text-2xl font-bold text-foreground whitespace-normal break-words">
                      <LatexText text={q.correct} />
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between pl-1">
                    <span className="uppercase text-[7px] md:text-xs font-black text-muted-foreground tracking-widest">{t.explanation}:</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAskGuruForDetail}
                      className="h-9 md:h-12 rounded-lg md:rounded-2xl text-[9px] md:text-sm font-black uppercase tracking-[0.15em] border-[2px] border-primary/20 text-primary hover:bg-primary/10 flex items-center gap-2 transition-all active:scale-95"
                    >
                      <Sparkles className="w-3.5 h-3.5 md:w-4 md:h-4 fill-current" /> {t.askShark}
                    </Button>
                  </div>
                  <div className="p-5 md:p-10 bg-primary/5 rounded-2xl md:rounded-[2.5rem] border-2 border-primary/10 text-[11px] md:text-lg font-bold leading-relaxed italic text-foreground whitespace-normal break-words shadow-inner">
                    <LatexText text={q.explanation} />
                  </div>
                </div>
              </div>

              <Button onClick={handleNext} className="w-full h-12 md:h-20 rounded-xl md:rounded-[2rem] btn-duo bg-foreground text-background font-headline font-black text-base md:text-4xl uppercase tracking-tighter">
                {currentIndex + 1 === questions.length ? t.finish : t.continue}
              </Button>
            </div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <Card className="card-duo w-full max-w-3xl p-6 md:p-16 space-y-8 md:space-y-14 group shadow-none hover:shadow-[0_15px_0_0_var(--duo-shadow)] border-primary/10 mx-2">
      <div className="space-y-4 text-center">
        <div className={cn(
          "w-16 h-16 md:w-28 md:h-28 rounded-xl md:rounded-[2.5rem] bg-primary/10 flex items-center justify-center border-[2px] md:border-[3px] border-primary/20 mx-auto transition-transform group-hover:scale-110 duration-500 shadow-duo",
          isPracticeDisabled && "opacity-40"
        )}>
          <BrainCircuit className="w-8 h-8 md:w-14 md:h-14 text-primary" />
        </div>
        <h2 className="text-2xl md:text-5xl font-headline font-black text-primary uppercase tracking-tighter leading-tight">{t.mistakePractice}</h2>
        <p className="text-[9px] md:text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">{uiMessage(lang, "playgroundview.master_your_mistakes")}</p>
      </div>

      <div className="space-y-8 md:space-y-10">
        <div className="space-y-4 group">
          <Label className="text-[9px] md:text-xs font-black uppercase text-muted-foreground tracking-[0.2em] px-1 flex items-center gap-2 group-hover:text-primary transition-colors">
            <Target className="w-3.5 h-3.5 md:w-4 md:h-4 transition-transform group-hover:-translate-y-0.5" /> {t.selectTarget}
          </Label>

          {!isPracticeDisabled && topicsWithMistakes.length > 0 ? (
            <div className="flex flex-wrap gap-2 md:gap-3">
              {topicsWithMistakes.map((wp, i) => (
                <Button
                  key={i}
                  variant={concept === wp.topic ? "default" : "outline"}
                  onClick={() => setConcept(wp.topic)}
                  className={cn(
                    "h-10 md:h-16 rounded-lg md:rounded-[1.5rem] text-[9px] md:text-sm font-black uppercase tracking-widest border-[2px] md:border-[3px] px-4 md:px-10 btn-duo shadow-none transition-all",
                    concept === wp.topic
                      ? "bg-primary text-white border-primary/20 translate-y-[-4px] shadow-duo"
                      : "bg-card border-border hover:border-primary/40 hover:bg-primary/5"
                  )}
                >
                  <LatexText text={wp.topic} />
                </Button>
              ))}
            </div>
          ) : (
            <div className="p-8 md:p-16 bg-muted/20 border-[2px] md:border-[3px] border-dashed border-border rounded-xl md:rounded-[2rem] text-center animate-in fade-in duration-700 flex flex-col items-center gap-3 md:gap-4">
              <div className="w-10 h-10 md:w-16 md:h-16 rounded-full bg-muted/40 flex items-center justify-center">
                <Info className="w-5 h-5 md:w-8 md:h-8 text-muted-foreground opacity-50" />
              </div>
              <p className="text-[8px] md:text-sm font-black text-muted-foreground uppercase tracking-[0.2em] leading-loose max-w-sm">
                {disabledMessage}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-4 group">
          <Label className="text-[9px] md:text-xs font-black uppercase text-muted-foreground tracking-[0.2em] px-1 flex items-center gap-2 group-hover:text-primary transition-colors">
             <Zap className="w-3.5 h-3.5 md:w-4 md:h-4" /> {t.numQuestions} (1-50)
          </Label>
          <div className="flex items-center gap-3 md:gap-6">
            <Input
              type="number"
              value={numQuestions}
              onChange={handleNumChange}
              onBlur={handleNumBlur}
              min={1} max={50}
              disabled={isPracticeDisabled}
              className="h-12 md:h-20 rounded-xl md:rounded-[1.5rem] border-[3px] border-border font-black text-lg md:text-4xl bg-muted/10 text-center w-24 md:w-40 shadow-inner focus:ring-4 md:ring-8 focus:ring-primary/10 transition-all focus:border-primary disabled:opacity-30"
            />
            <span className="text-muted-foreground font-black uppercase text-[9px] md:text-xs tracking-[0.2em]">{uiMessage(lang, "playgroundview.practice_questions")}</span>
          </div>
        </div>

        <Button
          onClick={startSession}
          disabled={!concept.trim() || isGenerating || isValidating || isPracticeDisabled}
          className="w-full h-14 md:h-24 rounded-xl md:rounded-[2.5rem] btn-duo bg-primary text-white border-[3px] md:border-[5px] border-white/20 font-black text-base md:text-3xl uppercase tracking-[0.1em] shadow-duo group active:translate-y-2"
        >
          {isValidating ? (
            <div className="flex items-center gap-2 md:gap-3">
              <Loader2 className="w-5 h-5 md:w-10 md:h-10 animate-spin" />
              {t.analyzing}
            </div>
          ) : (
            <div className="flex items-center gap-2 md:gap-3">
              {t.startPractice} <ArrowRight className="ml-2 md:ml-4 w-5 h-5 md:w-10 md:h-10 group-hover:translate-x-2 transition-transform" />
            </div>
          )}
        </Button>
      </div>
    </Card>
  );
}


"use client";
import { uiMessage } from '@/lib/i18n';
import type { DashboardStats } from '@/lib/stats-utils';

import { generateFlashcards,validateAcademicTopic } from '@/ai/client-flows';
import { LatexText } from '@/components/latex-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFirestore,useUser } from '@/firebase';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';
import { getAiError } from '@/lib/ai-error-message';
import { showErrorToast,showUnexpectedErrorToast } from '@/lib/error-toast';
import { TranslationSet } from '@/lib/translations';
import { Flashcard,Language } from '@/lib/types';
import { cn } from '@/lib/utils';
import { addDoc,collection } from 'firebase/firestore';
import {
ArrowLeft,
ArrowRight,
Check,
Info,
Layers,
Loader2,
MessageSquare,
Sparkles,
Target
} from 'lucide-react';
import React,{ useEffect,useId,useRef,useState } from 'react';

export default function FlashcardGame({ t, lang, weakPoints, totalAttempts, initialConcept }: { t: TranslationSet, lang: Language, weakPoints: DashboardStats['processedGroupedInsights'], totalAttempts: number, initialConcept?: string }) {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [topic, setTopic] = useState(initialConcept || (weakPoints[0]?.topic || ""));
  const [numCards, setNumCards] = useState(10);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const cardId = useId();
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
      setCurrentIndex(0);
      setIsFlipped(false);

      if (user && db) {
        const sessionRef = collection(db, 'users', user.uid, 'flashcards');
        await addDoc(sessionRef, {
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
      showErrorToast(getAiError(e), lang);
      setIsValidating(false);
    } finally {
      pending.current = false;
      setIsValidating(false);
      setIsGenerating(false);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsFlipped(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(currentIndex + 1);
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
            <button type="button" aria-pressed={isFlipped} aria-describedby={`${cardId}-${isFlipped ? 'back' : 'front'}`} aria-label={isFlipped ? uiMessage(lang, "playgroundview.reverse") : uiMessage(lang, "playgroundview.tap_to_reveal")}
              onClick={() => setIsFlipped(!isFlipped)}
              className={cn(
                "w-full h-full relative preserve-3d transition-transform duration-700 cursor-pointer rounded-[1.2rem] md:rounded-[3rem] focus-visible:outline-4 focus-visible:outline-primary focus-visible:outline-offset-4",
                isFlipped && "rotate-y-180"
              )}
            >
              {/* Front Side */}
              <span aria-hidden={isFlipped} className="absolute inset-0 backface-hidden p-6 md:p-12 flex flex-col items-center justify-center text-center bg-card border-[3px] md:border-[5px] border-border rounded-[1.2rem] md:rounded-[3rem] shadow-duo group">
                <span className="w-10 h-10 md:w-16 md:h-16 rounded-xl md:rounded-[1.2rem] bg-primary/10 flex items-center justify-center border-[2px] md:border-[3px] border-primary/20 shrink-0 mb-4 md:mb-6 group-hover:scale-110 transition-transform">
                  <MessageSquare className="w-5 h-5 md:w-8 md:h-8 text-primary" />
                </span>
                <span className="flex-1 flex flex-col justify-center w-full min-h-0 overflow-y-auto custom-scrollbar px-2">
                  <span id={`${cardId}-front`} className="text-lg sm:text-2xl md:text-3xl font-headline font-black leading-tight text-foreground uppercase tracking-tight">
                    <LatexText text={card.front} />
                  </span>
                </span>
                <span className="text-[7px] md:text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-40 animate-pulse mt-3 md:mt-4">
                  {uiMessage(lang, "playgroundview.tap_to_reveal")}
                </span>
              </span>

              {/* Back Side */}
              <span aria-hidden={!isFlipped} className="absolute inset-0 backface-hidden rotate-y-180 p-6 md:p-12 flex flex-col items-center justify-center text-center bg-primary/5 border-[3px] md:border-[5px] border-primary/30 rounded-[1.2rem] md:rounded-[3rem] shadow-duo">
                <span className="w-10 h-10 md:w-16 md:h-16 rounded-xl md:rounded-[1.2rem] bg-primary/20 flex items-center justify-center border-[2px] md:border-[3px] border-primary/30 shrink-0 mb-4 md:mb-6">
                  <Sparkles className="w-5 h-5 md:w-8 md:h-8 text-primary" />
                </span>
                <span className="flex-1 flex flex-col justify-center w-full min-h-0 overflow-y-auto custom-scrollbar px-2 italic">
                  <span id={`${cardId}-back`} className="text-sm sm:text-lg md:text-2xl font-bold leading-relaxed text-foreground whitespace-pre-wrap">
                    <LatexText text={card.back} />
                  </span>
                </span>
                <span className="text-[7px] md:text-[10px] font-black uppercase tracking-[0.3em] text-primary opacity-60 mt-3 md:mt-4">
                  {uiMessage(lang, "playgroundview.reverse")}
                </span>
              </span>
            </button>
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


"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Clock, Loader2, Sparkles, AlertTriangle, BookOpen } from 'lucide-react';
import { shortAnswerAnalysis } from '@/ai/flows/short-answer-analysis-flow';
import { generateQuestions } from '@/ai/flows/generate-questions-flow';
import { personalizedQuizPerformanceFeedback } from '@/ai/flows/personalized-quiz-feedback-flow';
import { LatexText } from '@/components/latex-text';
import { QuizConfig } from '@/lib/types';
import { TranslationSet } from '@/lib/translations';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { getAiErrorMessage } from '@/lib/ai-error-message';

interface QuizViewProps {
  t: TranslationSet;
  lang: string;
  config: QuizConfig;
  initialQuestions: any[] | null;
  onFinish: (results: any, analysis?: any) => void;
  onAskGuru: (message: string) => void;
}

export default function QuizView({ t, lang, config, initialQuestions, onFinish, onAskGuru }: QuizViewProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [questions, setQuestions] = useState<any[]>(initialQuestions || []);
  const [answers, setAnswers] = useState<any[]>([]);
  const [currentFeedback, setCurrentFeedback] = useState<any>(null);
  const [shortAnswerInput, setShortAnswerInput] = useState("");
  const [overallTimer, setOverallTimer] = useState(0);
  const [remainingTime, setRemainingTime] = useState<number | null>(null);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoading, setIsLoading] = useState(!initialQuestions);
  const [isFinishing, setIsFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (config.timeLimit && !isNaN(parseInt(config.timeLimit))) {
      setRemainingTime(parseInt(config.timeLimit) * 60);
    }
  }, [config.timeLimit]);

  useEffect(() => {
    if (initialQuestions) {
      setQuestionStartTime(Date.now());
      return;
    }

    async function loadQuestions() {
      setIsLoading(true);
      setError(null);
      try {
        const result = await generateQuestions({
          subject: config.subject === 'none' ? undefined : config.subject,
          grade: config.grade === 'none' ? undefined : config.grade,
          topic: config.topic,
          excludeNotes: config.excludeNotes,
          type: config.type,
          difficulty: config.difficulty,
          numQuestions: Math.min(parseInt(config.numQuestions) || 5, 50),
          language: lang as 'en' | 'vi',
        });
        setQuestions(result.questions);
        setQuestionStartTime(Date.now());
      } catch (err) {
        console.error("Failed to generate questions", err);
        setError(getAiErrorMessage(err, lang as 'en' | 'vi'));
      } finally {
        setIsLoading(false);
      }
    }
    loadQuestions();
  }, [config, lang, initialQuestions]);

  const handleAutoFinish = useCallback(async () => {
    if (isFinishing) return;
    setIsFinishing(true);
    
    const finalAnswers = [...answers];
    if (currentFeedback) finalAnswers.push(currentFeedback);
    
    const remainingCount = questions.length - finalAnswers.length;
    for (let i = 0; i < remainingCount; i++) {
      const q = questions[finalAnswers.length];
      finalAnswers.push({
        ...q,
        userAnswer: "-",
        isCorrect: false,
        timeTakenSeconds: 0,
        errorCategory: "Time Expired",
        aiFeedback: null
      });
    }

    try {
      const analysis = await personalizedQuizPerformanceFeedback({ 
        quizResults: finalAnswers,
        originalTopic: config.topic
      });
      
      const bilingualConfig = {
        ...config,
        topicEn: analysis.topicEn,
        topicVi: analysis.topicVi
      };

      onFinish({
        quizResults: finalAnswers,
        totalTime: overallTimer,
        config: bilingualConfig
      }, analysis);
    } catch (e) {
      onFinish({
        quizResults: finalAnswers,
        totalTime: overallTimer,
        config
      });
    }
  }, [answers, currentFeedback, questions, lang, onFinish, overallTimer, config, isFinishing]);

  useEffect(() => {
    if (isLoading || isFinishing) return;

    const interval = setInterval(() => {
      setOverallTimer(prev => prev + 1);
      if (remainingTime !== null) {
        setRemainingTime(prev => (prev !== null && prev > 0 ? prev - 1 : prev));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isLoading, isFinishing, remainingTime !== null]);

  useEffect(() => {
    if (remainingTime === 0 && !isFinishing) {
      handleAutoFinish();
    }
  }, [remainingTime, isFinishing, handleAutoFinish]);

  const handleAnswer = useCallback(async (userAnswer: string) => {
    if (isAnalyzing || !!currentFeedback || !userAnswer.trim()) return;

    const currentQ = questions[currentIdx];
    const timeTaken = (Date.now() - questionStartTime) / 1000;
    
    let isCorrect = false;
    let aiFeedback = null;

    if (currentQ.type === 'Short Answer') {
      setIsAnalyzing(true);
      try {
        const result = await shortAnswerAnalysis({
          userAnswer,
          questionText: currentQ.question,
          correctAnswer: currentQ.correct,
          language: lang as 'en' | 'vi'
        });
        isCorrect = result.isCorrect;
        aiFeedback = result.feedback;
      } catch (e) {
        isCorrect = userAnswer.toLowerCase().trim() === currentQ.correct.toLowerCase().trim();
      } finally {
        setIsAnalyzing(false);
      }
    } else {
      isCorrect = userAnswer.toLowerCase().trim() === currentQ.correct.toLowerCase().trim();
    }

    const errorCategory = !isCorrect ? (timeTaken < 5 ? "Careless Mistake" : "Concept Error") : null;

    const result = {
      ...currentQ,
      userAnswer,
      isCorrect,
      timeTakenSeconds: timeTaken,
      errorCategory,
      aiFeedback
    };

    setCurrentFeedback(result);
  }, [questions, currentIdx, questionStartTime, isAnalyzing, currentFeedback, lang]);

  const handleNextAction = useCallback(async () => {
    const updatedAnswers = [...answers, currentFeedback];
    setAnswers(updatedAnswers);
    setCurrentFeedback(null);
    setShortAnswerInput("");
    
    if (currentIdx + 1 < questions.length) {
      setCurrentIdx(currentIdx + 1);
      setQuestionStartTime(Date.now());
    } else {
      setIsFinishing(true);
      try {
        const analysis = await personalizedQuizPerformanceFeedback({ 
          quizResults: updatedAnswers,
          originalTopic: config.topic
        });

        const bilingualConfig = {
          ...config,
          topicEn: analysis.topicEn,
          topicVi: analysis.topicVi
        };

        onFinish({
          quizResults: updatedAnswers,
          totalTime: overallTimer,
          config: bilingualConfig
        }, analysis);
      } catch (e) {
        onFinish({
          quizResults: updatedAnswers,
          totalTime: overallTimer,
          config
        });
      } finally {
        setIsFinishing(false);
      }
    }
  }, [answers, currentFeedback, currentIdx, questions.length, lang, onFinish, overallTimer, config]);

  const handleAskGuruForDetail = useCallback(() => {
    const currentQ = questions[currentIdx];
    if (!currentQ || !currentFeedback) return;
    
    const message = `${t.askSharkGuruPrompt}\n\n📍 **Question**: "${currentQ.question}"\n✅ **Correct Answer**: "${currentQ.correct}"\n📝 **Initial Explanation**: "${currentQ.explanation}"`;
    onAskGuru(message);
  }, [questions, currentIdx, currentFeedback, onAskGuru, t.askSharkGuruPrompt]);

  const formattedRemainingTime = useMemo(() => {
    if (remainingTime === null) return null;
    const m = Math.floor(remainingTime / 60);
    const s = remainingTime % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }, [remainingTime]);

  if (isLoading || isFinishing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 md:p-20 space-y-8 animate-in fade-in duration-500">
        <Loader2 className="w-16 h-16 md:w-24 md:h-24 animate-spin text-primary opacity-90 stroke-[3px]" />
        <div className="max-w-3xl w-full text-center">
          <p className="text-xl md:text-5xl font-headline font-black text-primary animate-pulse tracking-tight uppercase leading-tight whitespace-normal break-words px-4">
            {isLoading ? t.generatingQuestions : (remainingTime === 0 ? t.timeExpired : t.analyzingResults)}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="card-duo p-8 md:p-16 text-center space-y-6 max-w-xl mx-auto mt-20">
        <AlertTriangle className="w-16 h-16 md:w-20 md:h-20 text-destructive mx-auto" />
        <h2 className="text-xl md:text-3xl font-headline font-black uppercase text-destructive whitespace-normal break-words">{error}</h2>
        <Button onClick={() => window.location.reload()} className="btn-duo h-14 md:h-18 px-10 md:px-14 rounded-2xl bg-primary text-white text-lg font-black uppercase tracking-wider">
          {lang === 'vi' ? 'THỬ LẠI' : 'RETRY'}
        </Button>
      </Card>
    );
  }

  const currentQ = questions[currentIdx];
  if (!currentQ) return null;

  const progress = ((currentIdx + 1) / questions.length) * 100;
  const isMultipleChoice = currentQ.type === "Multiple Choice" || currentQ.type === "True/False";

  return (
    <div className="max-w-4xl mx-auto space-y-8 md:space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700 px-1">
      <div className="space-y-4 md:space-y-6">
        <div className="flex justify-between items-center text-[10px] md:text-xs font-black text-muted-foreground uppercase tracking-[0.2em] px-1">
          <span>{t.progress} {currentIdx + 1} / {questions.length}</span>
          <div className="flex items-center gap-2 md:gap-4">
            <span className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full border-2 transition-all",
              remainingTime !== null && remainingTime < 30 ? "bg-red-500/10 border-red-500 text-red-500 animate-pulse" : "bg-muted/50 border-border/50 text-foreground shadow-sm"
            )}>
              <Clock className={cn("w-3.5 h-3.5 md:w-4 md:h-4", remainingTime !== null && remainingTime < 30 ? "text-red-500" : "text-primary")} /> 
              <span className="text-[10px] md:text-sm font-black">{formattedRemainingTime || `${Math.floor(overallTimer / 60)}:${(overallTimer % 60).toString().padStart(2, '0')}`}</span>
            </span>
          </div>
        </div>
        <div className="progress-duo h-4 md:h-6 border-2 border-border/30">
          <div className="progress-duo-bar" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <Card className="card-duo p-6 md:p-16 min-h-[400px] flex flex-col justify-between overflow-hidden relative group transition-all duration-700">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
        
        <div className="space-y-8 md:space-y-10 relative z-10">
          <div className="space-y-4">
            {currentQ.section && (
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-black uppercase text-[8px] md:text-xs tracking-widest py-1 md:py-1.5 px-3 md:px-4 rounded-lg md:rounded-xl">
                <BookOpen className="w-3 h-3 md:w-4 md:h-4 mr-1.5 md:mr-2" /> {currentQ.section}
              </Badge>
            )}
            <h2 className="text-xl md:text-4xl font-headline font-black leading-relaxed tracking-tight text-foreground whitespace-normal break-words">
              <LatexText text={currentQ.question} />
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {isMultipleChoice ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {currentQ.options?.map((opt: string, idx: number) => (
                  <Button
                    key={`${currentIdx}-${idx}`}
                    variant="outline"
                    disabled={!!currentFeedback || isAnalyzing}
                    onClick={() => handleAnswer(opt)}
                    className={cn(
                      "min-h-[4.5rem] h-auto py-4 rounded-2xl md:rounded-3xl border-[3px] font-black text-sm md:text-xl text-left justify-start px-6 md:px-8 btn-duo shadow-duo whitespace-normal break-words flex items-center transition-all",
                      currentFeedback && opt === currentQ.correct 
                        ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
                        : currentFeedback && opt === currentFeedback.userAnswer && !currentFeedback.isCorrect 
                        ? "border-red-500 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400" 
                        : "border-border text-foreground hover:border-primary/50 hover:bg-primary/5 hover:-translate-y-1"
                    )}
                  >
                    <span className="w-full whitespace-normal break-words leading-tight">
                      <LatexText text={opt} />
                    </span>
                  </Button>
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="relative group">
                  <input 
                    type="text"
                    placeholder={t.typeYourAnswer}
                    disabled={!!currentFeedback || isAnalyzing}
                    className="w-full h-16 md:h-28 px-6 md:px-10 rounded-2xl md:rounded-3xl border-[3px] border-border font-black text-lg md:text-3xl focus:outline-none focus:border-primary focus:ring-[4px] focus:ring-primary/10 bg-muted/20 text-foreground disabled:opacity-50 transition-all placeholder:text-muted-foreground/30 shadow-inner"
                    value={shortAnswerInput}
                    onChange={(e) => setShortAnswerInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAnswer(shortAnswerInput)}
                  />
                  {isAnalyzing && (
                    <div className="absolute right-4 md:right-6 top-1/2 -translate-y-1/2 flex items-center gap-2 md:gap-3 text-primary font-black bg-background/80 backdrop-blur-md px-3 md:px-4 py-1.5 md:py-2 rounded-xl md:rounded-2xl border-primary/20 animate-pulse">
                      <Sparkles className="w-4 h-4 md:w-6 md:h-6 animate-spin duration-1000" />
                      <span className="text-[9px] md:text-xs uppercase tracking-widest whitespace-normal break-words">{t.analyzing}</span>
                    </div>
                  )}
                </div>
                {!currentFeedback && !isAnalyzing && (
                  <Button 
                    onClick={() => handleAnswer(shortAnswerInput)}
                    disabled={!shortAnswerInput.trim()}
                    className="w-full h-14 md:h-20 rounded-[1.2rem] md:rounded-[2rem] font-black text-lg md:text-2xl bg-primary text-white btn-duo shadow-duo border-[4px] border-primary/20 uppercase tracking-widest"
                  >
                    <span className="whitespace-normal break-words leading-tight">{t.submitAnswer}</span>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {currentFeedback && (
          <div className={cn(
            "mt-10 md:mt-12 p-6 md:p-10 rounded-2xl md:rounded-3xl border-[3px] animate-in slide-in-from-top-6 duration-500 shadow-2xl relative overflow-hidden",
            currentFeedback.isCorrect 
              ? "bg-green-50/80 border-green-200 dark:bg-green-900/20 dark:border-green-500/50" 
              : "bg-red-50/80 border-red-200 dark:bg-red-900/20 dark:border-red-500/50"
          )}>
            <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 mb-6">
              <div className="flex items-center gap-3 md:gap-4">
                {currentFeedback.isCorrect ? 
                  <CheckCircle2 className="w-8 h-8 md:w-14 md:h-14 text-green-500" /> : 
                  <XCircle className="w-8 h-8 md:w-14 md:h-14 text-red-500" />
                }
                <span className={cn(
                  "text-2xl md:text-5xl font-headline font-black uppercase tracking-tighter whitespace-normal break-words",
                  currentFeedback.isCorrect ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"
                )}>
                  {currentFeedback.isCorrect ? t.correct : t.incorrect}
                </span>
              </div>
              {currentFeedback.errorCategory === 'Careless Mistake' && (
                <div className="inline-block px-3 py-1.5 bg-red-100 text-red-800 rounded-xl text-[9px] md:text-xs font-black uppercase tracking-widest border-2 border-red-200 dark:bg-red-500/30 dark:text-red-200 dark:border-red-500/30 w-fit whitespace-normal break-words">
                  {t.carelessMistake}
                </div>
              )}
            </div>

            <div className="space-y-6 md:space-y-8">
              <div className="space-y-2">
                <p className="font-black text-muted-foreground uppercase text-[9px] md:text-xs tracking-widest pl-1">{t.correctAnswer}:</p>
                <div className="p-5 md:p-8 bg-white/40 dark:bg-black/20 rounded-2xl md:rounded-[2rem] border-2 border-current/10">
                  <p className="text-base md:text-2xl font-bold text-foreground whitespace-normal break-words">
                    <LatexText text={currentQ.correct} />
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between pl-1">
                  <span className="uppercase text-[9px] md:text-xs font-black text-muted-foreground tracking-widest">{t.explanation}:</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleAskGuruForDetail}
                    className="h-8 md:h-10 rounded-lg md:rounded-xl text-[9px] md:text-xs font-black uppercase tracking-widest border-2 border-primary/20 text-primary hover:bg-primary/10 transition-all active:scale-95"
                  >
                    <Sparkles className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5 md:mr-2 fill-current" /> {t.askShark}
                  </Button>
                </div>
                <div className="p-5 md:p-10 bg-primary/5 rounded-2xl md:rounded-[2.5rem] border-2 border-primary/10 text-xs md:text-xl font-bold leading-relaxed italic text-foreground whitespace-normal break-words shadow-inner">
                  <LatexText text={currentQ.explanation} />
                </div>
              </div>

              {currentFeedback.aiFeedback && (
                <div className="text-xs md:text-lg text-primary font-black mt-4 flex items-start gap-3 md:gap-4 bg-primary/10 p-4 md:p-6 rounded-2xl md:rounded-3xl border-[3px] border-primary/20 animate-in zoom-in-95 duration-300">
                  <Sparkles className="w-5 h-5 md:w-8 md:h-8 shrink-0 mt-0.5 text-primary" /> 
                  <div className="text-foreground">
                    <span className="text-primary/70 uppercase text-[9px] md:text-10px tracking-widest block mb-1">{t.sharkFeedback}</span>
                    <div className="whitespace-normal break-words">
                      <LatexText text={currentFeedback.aiFeedback} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Button 
              onClick={handleNextAction} 
              className="w-full mt-10 md:mt-12 h-14 md:h-24 rounded-[1.2rem] md:rounded-[2.5rem] text-lg md:text-4xl font-headline font-black btn-duo shadow-duo bg-foreground text-background hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-tighter"
            >
              <span className="whitespace-normal break-words leading-tight">{currentIdx + 1 === questions.length ? t.finish : t.continue}</span>
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

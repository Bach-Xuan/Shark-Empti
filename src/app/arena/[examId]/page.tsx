"use client";
import { useLanguageState,useThemeState } from '@/components/app-preferences';
import { showErrorToast,showUnexpectedErrorToast } from '@/lib/error-toast';
import { createAppError,type AppError } from '@/lib/app-error';
import { arenaDetailMessages,arenaResponseError,arenaSubscriptionError } from '@/lib/arena-detail';
import { errorMessages,translatedError } from '@/lib/i18n/errors';
import { readArenaExam,readArenaAttempt } from '@/lib/public-firestore-schema';
import AiChatbot from '@/components/ai-chatbot';
import { uiMessage } from '@/lib/i18n';
import { quizLabel } from '@/lib/quiz-labels';

import Navigation from '@/components/navigation';
import QuizView from '@/components/quiz-view';
import ResultView from '@/components/result-view';
import { Avatar,AvatarFallback,AvatarImage } from '@/components/ui/avatar';
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useFirestore,useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { isTrustedArenaExam } from '@/lib/arena-scoring';
import { arenaLeaderboardQuery } from '@/lib/arena-leaderboard';
import { translations,TranslationSet } from '@/lib/translations';
import { ArenaAttempt,ArenaExam,QuizAnalysis,QuizHistoryItem } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
doc,
onSnapshot,
} from 'firebase/firestore';
import {
ArrowLeft,
Clock,
Coins,
Layers,
Loader2,
Medal,
PlayCircle,
Sparkles,
Target,
Users
} from 'lucide-react';
import { useParams,useRouter } from 'next/navigation';
import React,{ useEffect,useRef,useState } from 'react';

export default function ArenaDetailPage() {
  const { user } = useUser();
  const params = useParams();
  const examId = typeof params.examId === 'string' ? params.examId : '';
  return <ArenaDetailSession key={JSON.stringify([examId, user?.uid ?? null])} examId={examId} />;
}

function ArenaDetailSession({ examId }: { examId: string }) {
  const { user, loading: authLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [lang, setLang] = useLanguageState();
  const currentLanguage = useRef(lang);
  useEffect(() => { currentLanguage.current = lang; }, [lang]);
  const [theme, setTheme] = useThemeState();
  const [exam, setExam] = useState<ArenaExam | null>(null);
  const [leaderboard, setLeaderboard] = useState<ArenaAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'details' | 'quiz' | 'result'>('details');
  const [lastResults, setLastResults] = useState<QuizHistoryItem | null>(null);
  const [earnedCoins, setEarnedCoins] = useState(0);
  const pendingSubmission = useRef<{ body: string; results: QuizHistoryItem } | null>(null);
  const submitting = useRef(false);
  const starting = useRef(false);
  const [isStarting, setIsStarting] = useState(false);
  const pendingStart = useRef<string | null>(null);
  const activeAttempt = useRef<string | null>(null);
  const mounted = useRef(false);
  const requestController = useRef<AbortController | null>(null);
  const [examError, setExamError] = useState<AppError | null>(null);
  const [leaderboardError, setLeaderboardError] = useState<AppError | null>(null);
  const [examRetry, setExamRetry] = useState(0);
  const [leaderboardRetry, setLeaderboardRetry] = useState(0);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; requestController.current?.abort(); };
  }, []);


  useEffect(() => {
    if (!examId || !db) {
      setExamError(createAppError(!examId ? 'APP-INVALID-INPUT' : 'APP-CONFIG-MISSING', ''));
      setLoading(false);
      return;
    }
    let active = true;
    const examRef = doc(db, 'arenaExams', examId);
    const unsubExam = onSnapshot(examRef, (snapshot) => {
      if (!active) return;
      if (snapshot.exists()) {
        const parsed = readArenaExam(snapshot.id, snapshot.data());
        setExam(parsed);
        setExamError(parsed ? null : createAppError('ARENA-DATA-INVALID', ''));
      } else {
        setExam(null);
        setExamError(createAppError('ARENA-NOT-FOUND', ''));
      }
      setLoading(false);
    }, (error) => {
      if (!active) return;
      setExamError(arenaSubscriptionError(error));
      setLoading(false);
    });
    return () => { active = false; unsubExam(); };
  }, [db, examId, examRetry]);

  useEffect(() => {
    if (!examId || !db) return;
    let active = true;
    const q = arenaLeaderboardQuery(db, examId);
    const unsubLeaderboard = onSnapshot(q, (snapshot) => {
      if (!active) return;
      const parsed = snapshot.docs.map(item => readArenaAttempt(item.id, item.data()));
      const data = parsed.filter((item): item is ArenaAttempt => item !== null);
      setLeaderboardError(data.length !== parsed.length ? createAppError('ARENA-DATA-INVALID', '') : null);
      setLeaderboard(data);
    }, (error) => {
      if (!active) return;
      setLeaderboard([]);
      setLeaderboardError(arenaSubscriptionError(error));
    });

    return () => { active = false; unsubLeaderboard(); };
  }, [db, examId, leaderboardRetry]);

  const t: TranslationSet = translations[lang];
  const copy = arenaDetailMessages[lang];
  const startAttempt = async () => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    if (!exam || examError || submitting.current || starting.current) return;
    starting.current = true;
    setIsStarting(true);
    pendingStart.current ??= crypto.randomUUID();
    const requestId = pendingStart.current;
    const controller = new AbortController();
    requestController.current = controller;
    try {
      const token = await user.getIdToken();
      if (!mounted.current || controller.signal.aborted) return;
      const response = await fetch(`/api/arena/${encodeURIComponent(examId)}/start`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId }), signal: controller.signal,
      });
      const body: unknown = await response.json().catch(() => null);
      if (!mounted.current || controller.signal.aborted) return;
      if (!response.ok) {
        if (response.status === 409) pendingStart.current = null;
        showErrorToast(arenaResponseError(body, response.status), currentLanguage.current);
        return;
      }
      if (!body || typeof body !== 'object' || !('requestId' in body) || body.requestId !== requestId) {
        showErrorToast(createAppError('APP-DATA-INVALID', ''), currentLanguage.current);
        return;
      }
      activeAttempt.current = requestId;
      pendingStart.current = null;
      pendingSubmission.current = null;
      setLastResults(null);
      setEarnedCoins(0);
      setView('quiz');
    } catch {
      if (mounted.current && !controller.signal.aborted) showErrorToast(createAppError('APP-NETWORK', ''), currentLanguage.current);
    } finally {
      starting.current = false;
      if (mounted.current) setIsStarting(false);
    }
  };

  const handleFinishQuiz = async (results: Omit<QuizHistoryItem, 'date' | 'lang'>, analysis?: QuizAnalysis) => {
    if (!user) {
      showUnexpectedErrorToast('AUTH-REQUIRED', '', {}, lang);
      return false;
    }
    if (!mounted.current || !db || !exam || !activeAttempt.current || submitting.current) return false;
    submitting.current = true;
    pendingSubmission.current ??= {
      body: JSON.stringify({ answers: results.quizResults.map(result => result.userAnswer), requestId: activeAttempt.current }),
      results: { ...results, ...(analysis ? { analysis } : {}), date: new Date().toISOString(), lang },
    };
    const pending = pendingSubmission.current;
    const controller = new AbortController();
    requestController.current = controller;

    try {
      const token = await user.getIdToken();
      if (!mounted.current || controller.signal.aborted) return false;
      const response = await fetch(`/api/arena/${encodeURIComponent(examId)}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: pending.body,
        signal: controller.signal,
      });
      const submission: unknown = await response.json().catch(() => null);
      if (!mounted.current || controller.signal.aborted) return false;
      if (!response.ok) {
        showErrorToast(arenaResponseError(submission, response.status), currentLanguage.current);
        return false;
      }
      if (!submission || typeof submission !== 'object' || !('coinsAwarded' in submission)
        || typeof submission.coinsAwarded !== 'number' || !Number.isFinite(submission.coinsAwarded)
        || submission.coinsAwarded < 0 || !('isFirstAttempt' in submission) || typeof submission.isFirstAttempt !== 'boolean') {
        showErrorToast(createAppError('APP-DATA-INVALID', ''), currentLanguage.current);
        return false;
      }

      setEarnedCoins(submission.coinsAwarded);
      if (submission.isFirstAttempt) toast({ title: t.firstAttemptBonus.toUpperCase() });

      setLastResults(pending.results);
      setView('result');
      return true;
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
      const authenticationFailure = typeof code === 'string' && code.startsWith('auth/') && code !== 'auth/network-request-failed';
      if (mounted.current && !controller.signal.aborted) showErrorToast(createAppError(authenticationFailure ? 'AUTH-INVALID' : 'APP-NETWORK', ''), currentLanguage.current);
      return false;
    } finally {
      submitting.current = false;
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>;
  if (!exam) return <div className="min-h-screen flex flex-col items-center justify-center gap-4">
    {examError && <SubscriptionError error={examError} label={copy.exam} lang={lang} onRetry={() => setExamRetry(value => value + 1)} />}
    <Button onClick={() => router.push('/arena')}>{t.backToArena}</Button>
  </div>;
  const isLegacyExam = !isTrustedArenaExam(exam.questions || []);

  return (
    <div className="min-h-screen flex flex-col bg-background transition-colors duration-500">
      <Navigation
        view="arena" setView={() => {}} lang={lang}
        changeLang={(l) => { setLang(l);  }}
        theme={theme} onThemeChange={(isDark) => {
          const nt = isDark ? 'dark' : 'light';
          setTheme(nt);


        }} t={t}
      />

      <main className="flex-1 main-container pt-24 md:pt-36 space-y-10 pb-20">
        {examError && <SubscriptionError error={examError} label={copy.exam} lang={lang} onRetry={() => setExamRetry(value => value + 1)} />}
        {view === 'details' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12 items-start">
            <div className="lg:col-span-2 space-y-8">
              <Button variant="ghost" onClick={() => router.push('/arena')} className="btn-duo h-12 px-6 rounded-2xl border-transparent hover:border-border font-black uppercase text-xs tracking-widest gap-2">
                <ArrowLeft className="w-5 h-5" /> {t.back}
              </Button>

              <Card className="card-duo p-8 md:p-16 bg-card border-primary/20 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />

                <div className="space-y-10 relative z-10">
                  <div className="space-y-4">
                    <Badge className="bg-primary text-white font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-xl">
                      {quizLabel('subject', exam.config.subject, t).toUpperCase()}
                    </Badge>
                    <h1 className="text-3xl md:text-6xl font-headline font-black text-foreground uppercase tracking-tight leading-tight">
                      {exam.title}
                    </h1>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 md:gap-6">
                    <DetailItem icon={<Target className="text-blue-500" />} label={t.difficulty} value={quizLabel('difficulty', exam.config.difficulty, t)} />
                    <DetailItem icon={<Layers className="text-purple-500" />} label={t.questionType} value={quizLabel('type', exam.config.type, t)} />
                    <DetailItem icon={<Sparkles className="text-orange-500" />} label={t.numQuestions} value={exam.config.numQuestions} />
                    <DetailItem icon={<Clock className="text-green-500" />} label={t.timer} value={exam.config.timeLimit ? `${exam.config.timeLimit} ${t.minShort}` : t.none} />
                  </div>

                  <div className="pt-10 flex flex-col md:flex-row items-center gap-6">
                    <Button
                      onClick={startAttempt}
                      disabled={isStarting || isLegacyExam || authLoading || !!examError}
                      className="w-full md:w-auto h-16 md:h-24 px-12 md:px-20 rounded-[1.5rem] md:rounded-[3rem] btn-duo bg-primary text-white font-headline font-black text-xl md:text-3xl uppercase tracking-widest border-4 border-white/20 gap-4"
                    >
                      <PlayCircle className="w-8 h-8 md:w-12 md:h-12" /> {isLegacyExam ? uiMessage(lang, "arena.legacy_exam_unavailable") : !user ? uiMessage(lang, 'arena.sign_in_to_start') : t.takeExam}
                    </Button>
                    {isLegacyExam && <p className="text-xs font-bold text-destructive max-w-md">{uiMessage(lang, "arena.this_exam_contains_legacy_free_text_answers")}</p>}
                    <div className="flex items-center gap-4 text-muted-foreground bg-muted/30 px-6 py-3 rounded-2xl border-2 border-border">
                       <Users className="w-6 h-6" />
                       <span className="font-black text-lg">{exam.totalAttempts} {uiMessage(lang, "arena.learners_challenged")}</span>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="card-duo p-8 md:p-12 space-y-8 bg-primary/5 border-primary/10">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center shadow-duo">
                       <Coins className="w-7 h-7 animate-bounce-subtle" />
                    </div>
                    <div className="flex flex-col">
                       <h3 className="font-headline font-black text-xl md:text-3xl text-primary uppercase tracking-tight">{t.rewards}</h3>
                       <p className="text-[10px] md:text-xs font-black uppercase text-muted-foreground tracking-widest">{t.earnedCoins}</p>
                    </div>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="p-6 rounded-2xl border-2 bg-card flex items-center gap-4">
                       <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-primary font-black">100</div>
                       <p className="text-xs font-bold leading-relaxed">{uiMessage(lang, "arena.earn_shark_coins_equal_to_your_final")}</p>
                    </Card>
                    <Card className="p-6 rounded-2xl border-2 bg-card flex items-center gap-4">
                       <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-black">+50</div>
                       <p className="text-xs font-bold leading-relaxed">{uiMessage(lang, "arena.be_the_first_one_to_finish_the")}</p>
                    </Card>
                 </div>
              </Card>
            </div>

            <div className="space-y-8">
              <div className="flex items-center gap-3 md:gap-4 px-2">
                <Medal className="w-6 h-6 md:w-10 md:h-10 text-primary" />
                <h2 className="text-xl md:text-4xl font-headline font-black text-foreground uppercase tracking-tight">{t.leaderboard}</h2>
              </div>
              <p className="px-2 text-sm text-muted-foreground">{copy.ranking}</p>

              <Card className="card-duo overflow-hidden border-border bg-card">
                 {leaderboardError && <SubscriptionError error={leaderboardError} label={copy.leaderboard} lang={lang} onRetry={() => setLeaderboardRetry(value => value + 1)} />}
                 <div className="p-6 border-b-4 border-border/30 bg-muted/20">
                    <div className="grid grid-cols-12 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                       <div className="col-span-2">{t.rank}</div>
                       <div className="col-span-6">{t.player}</div>
                       <div className="col-span-2 text-right">{t.score}</div>
                       <div className="col-span-2 text-right">{t.time}</div>
                    </div>
                 </div>
                 <div className="divide-y-2 divide-border/20">
                    {leaderboard.length === 0 && !leaderboardError ? (
                      <div className="p-12 text-center text-muted-foreground italic font-black uppercase text-xs opacity-50">{uiMessage(lang, "arena.no_results_yet")}</div>
                    ) : leaderboard.map((item, idx) => (
                      <div key={item.id} className={cn("p-4 md:p-6 grid grid-cols-12 items-center gap-2 md:gap-4 transition-all hover:bg-primary/5", item.userId === user?.uid && "bg-primary/10 border-y-2 border-primary/20")}>
                         <div className="col-span-2 flex justify-center">
                            {idx < 3 ? (
                              <div className={cn("w-6 h-6 md:w-10 md:h-10 rounded-lg flex items-center justify-center font-black text-xs md:text-xl",
                                idx === 0 ? "bg-yellow-400 text-yellow-900 shadow-[0_4px_0_0_#ca8a04]" :
                                idx === 1 ? "bg-slate-300 text-slate-700 shadow-[0_4px_0_0_#94a3b8]" :
                                "bg-amber-600 text-amber-100 shadow-[0_4px_0_0_#78350f]"
                              )}>
                                {idx + 1}
                              </div>
                            ) : (
                              <span className="font-black text-xs md:text-lg text-muted-foreground">#{idx + 1}</span>
                            )}
                         </div>
                         <div className="col-span-6 flex items-center gap-2 md:gap-3 min-w-0">
                            <Avatar className="w-8 h-8 md:w-10 md:h-10 border-2 border-border shrink-0">
                               <AvatarImage src={item.userPhoto} />
                               <AvatarFallback>{item.userName[0]}</AvatarFallback>
                            </Avatar>
                            <span className="font-black text-[10px] md:text-sm uppercase tracking-tight truncate">{item.userName}</span>
                         </div>
                         <div className="col-span-2 text-right font-black text-sm md:text-xl text-primary">{item.score}%</div>
                         <div className="col-span-2 text-right font-black text-[9px] md:text-xs text-muted-foreground">{Math.floor(item.duration / 60)}:{ (item.duration % 60).toString().padStart(2, '0') }</div>
                      </div>
                    ))}
                 </div>
              </Card>
            </div>
          </div>
        )}

        {view === 'quiz' && (
          <div className="space-y-4">
            <p role="note">{copy.guru}</p>
            <QuizView
              t={t} lang={lang} config={exam.config}
              initialQuestions={exam.questions}
              onFinish={handleFinishQuiz}
              onAskGuru={() => toast({ description: copy.guru })}
              askGuruDisabledReason={copy.guru}
              numericShortAnswers
            />
          </div>
        )}

        {view === 'result' && lastResults && (
           <div className="space-y-12 animate-in zoom-in-95 duration-500">
              <Card className="card-duo p-8 md:p-12 bg-primary text-white border-white/20 text-center space-y-4">
                 <div className="w-20 h-20 md:w-28 md:h-28 bg-white/20 rounded-full mx-auto flex items-center justify-center animate-bounce-subtle">
                    <Coins className="w-10 h-10 md:w-16 md:h-16" />
                 </div>
                 <h2 className="text-2xl md:text-4xl font-headline font-black uppercase tracking-tight">{t.youEarned}</h2>
                 <p className="text-4xl md:text-7xl font-black">{earnedCoins} SHARK COINS</p>
              </Card>
              <ResultView
                t={t} lang={lang} results={lastResults}
                onViewDashboard={() => router.push('/arena')}
                onRetakeSame={startAttempt}
                onRetakeNew={startAttempt}
                isArena={true}
              />
              <div className="flex justify-center">
                 <Button onClick={() => setView('details')} variant="outline" className="btn-duo h-14 md:h-20 px-10 md:px-16 rounded-2xl md:rounded-[2rem] font-black uppercase tracking-widest text-xs md:text-xl bg-card">
                   <ArrowLeft className="w-6 h-6 mr-3" /> {t.backToArena}
                 </Button>
              </div>
           </div>
        )}
      </main>
      {view === 'result' && lastResults && <AiChatbot t={t} lang={lang} results={lastResults} trigger={null} />}
    </div>
  );
}

function SubscriptionError({ error, label, lang, onRetry }: { error: AppError; label: string; lang: 'en' | 'vi'; onRetry: () => void }) {
  return <div role="alert" className="p-4 space-y-3">
    <p>{label} {error.code === 'ARENA-NOT-FOUND' ? uiMessage(lang, 'arena.exam_not_found') : translatedError(error.code, lang)}</p>
    <p>{error.code}</p>
    <Button onClick={onRetry}>{errorMessages[lang].retry}</Button>
  </div>;
}

function DetailItem({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="p-4 md:p-6 rounded-2xl md:rounded-3xl border-2 border-border bg-muted/20 space-y-2 group hover:border-primary/30 transition-all">
       <div className="flex items-center gap-2">
          {icon}
          <span className="text-[8px] md:text-[10px] font-black uppercase text-muted-foreground tracking-widest">{label}</span>
       </div>
       <p className="text-sm md:text-lg font-black uppercase truncate group-hover:text-primary transition-colors">{value}</p>
    </div>
  );
}

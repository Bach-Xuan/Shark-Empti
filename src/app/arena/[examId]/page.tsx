"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc,
  limit
} from 'firebase/firestore';
import { useUser, useFirestore } from '@/firebase';
import { translations, TranslationSet } from '@/lib/translations';
import { Language, ArenaExam, ArenaAttempt } from '@/lib/types';
import Navigation from '@/components/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Trophy, 
  ArrowLeft, 
  Loader2, 
  Target, 
  Clock, 
  Sparkles, 
  Coins,
  Medal,
  Users,
  PlayCircle,
  Layers
} from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import QuizView from '@/components/quiz-view';
import ResultView from '@/components/result-view';
import { isTrustedArenaExam } from '@/lib/arena-scoring';

export default function ArenaDetailPage() {
  const { user } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const params = useParams();
  const examId = params.examId as string;
  const { toast } = useToast();
  
  const [lang, setLang] = useState<Language>('en');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [exam, setExam] = useState<ArenaExam | null>(null);
  const [leaderboard, setLeaderboard] = useState<ArenaAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'details' | 'quiz' | 'result'>('details');
  const [lastResults, setLastResults] = useState<any>(null);
  const [earnedCoins, setEarnedCoins] = useState(0);

  useEffect(() => {
    const savedLang = localStorage.getItem('shark_lang') as Language;
    const savedTheme = localStorage.getItem('shark_theme') as 'light' | 'dark';
    if (savedLang) setLang(savedLang);
    let initialTheme: 'light' | 'dark' = savedTheme || (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setTheme(initialTheme);
    document.documentElement.classList.toggle('dark', initialTheme === 'dark');
  }, []);

  useEffect(() => {
    if (!examId || !db) return;

    const examRef = doc(db, 'arenaExams', examId);
    const unsubExam = onSnapshot(examRef, (snapshot) => {
      if (snapshot.exists()) {
        setExam({ id: snapshot.id, ...snapshot.data() } as ArenaExam);
      } else {
        toast({ variant: "destructive", title: "Exam not found" });
        router.push('/arena');
      }
      setLoading(false);
    });

    const leaderboardRef = collection(db, 'arenaExams', examId, 'attempts');
    const q = query(leaderboardRef, orderBy('score', 'desc'), limit(10));
    const unsubLeaderboard = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ArenaAttempt[];
      data.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.duration - b.duration;
      });
      setLeaderboard(data);
    }, (error) => {
      console.error("Firestore Leaderboard Error:", error);
    });

    return () => { unsubExam(); unsubLeaderboard(); };
  }, [db, examId, router, toast]);

  const t: TranslationSet = translations[lang];

  const handleFinishQuiz = async (results: any) => {
    if (!user || !db || !exam) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/arena/${encodeURIComponent(examId)}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: results.quizResults.map((result: { userAnswer: string }) => result.userAnswer),
          duration: results.totalTime,
        }),
      });
      const submission = await response.json() as { score?: number; coinsAwarded?: number; isFirstAttempt?: boolean; error?: string };
      if (!response.ok || typeof submission.coinsAwarded !== 'number') throw new Error(submission.error || 'Arena submission failed');

      setEarnedCoins(submission.coinsAwarded);
      if (submission.isFirstAttempt) toast({ title: t.firstAttemptBonus.toUpperCase() });

      setLastResults(results);
      setView('result');
    } catch (e) {
      toast({ variant: "destructive", title: "Failed to save attempt" });
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>;
  if (!exam) return null;
  const isLegacyExam = !isTrustedArenaExam(exam.questions || []);

  return (
    <div className="min-h-screen flex flex-col bg-background transition-colors duration-500">
      <Navigation 
        view="arena" setView={() => {}} lang={lang} 
        changeLang={(l) => { setLang(l); localStorage.setItem('shark_lang', l); }} 
        theme={theme} onThemeChange={(isDark) => {
          const nt = isDark ? 'dark' : 'light';
          setTheme(nt);
          localStorage.setItem('shark_theme', nt);
          document.documentElement.classList.toggle('dark', isDark);
        }} t={t} 
      />

      <main className="flex-1 main-container pt-24 md:pt-36 space-y-10 pb-20">
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
                      {exam.config.subject.toUpperCase()}
                    </Badge>
                    <h1 className="text-3xl md:text-6xl font-headline font-black text-foreground uppercase tracking-tight leading-tight">
                      {exam.title}
                    </h1>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 md:gap-6">
                    <DetailItem icon={<Target className="text-blue-500" />} label={t.difficulty} value={exam.config.difficulty} />
                    <DetailItem icon={<Layers className="text-purple-500" />} label={t.questionType} value={exam.config.type} />
                    <DetailItem icon={<Sparkles className="text-orange-500" />} label={t.numQuestions} value={exam.config.numQuestions} />
                    <DetailItem icon={<Clock className="text-green-500" />} label={t.timer} value={exam.config.timeLimit ? `${exam.config.timeLimit} ${t.minShort}` : t.none} />
                  </div>

                  <div className="pt-10 flex flex-col md:flex-row items-center gap-6">
                    <Button 
                      onClick={() => setView('quiz')}
                      disabled={isLegacyExam}
                      className="w-full md:w-auto h-16 md:h-24 px-12 md:px-20 rounded-[1.5rem] md:rounded-[3rem] btn-duo bg-primary text-white font-headline font-black text-xl md:text-3xl uppercase tracking-widest border-4 border-white/20 gap-4"
                    >
                      <PlayCircle className="w-8 h-8 md:w-12 md:h-12" /> {isLegacyExam ? (lang === 'vi' ? 'ĐỀ CŨ KHÔNG THỂ THI' : 'LEGACY EXAM UNAVAILABLE') : t.takeExam}
                    </Button>
                    {isLegacyExam && <p className="text-xs font-bold text-destructive max-w-md">{lang === 'vi' ? 'Đề này có câu trả lời tự luận cũ nên không thể chấm và trao thưởng một cách an toàn.' : 'This exam contains legacy free-text answers and cannot be graded securely.'}</p>}
                    <div className="flex items-center gap-4 text-muted-foreground bg-muted/30 px-6 py-3 rounded-2xl border-2 border-border">
                       <Users className="w-6 h-6" />
                       <span className="font-black text-lg">{exam.totalAttempts} {lang === 'vi' ? 'Học viên đã thi' : 'Learners challenged'}</span>
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
                       <p className="text-xs font-bold leading-relaxed">{lang === 'vi' ? 'Nhận số lượng Shark Coin tương ứng với điểm số đạt được (0-100).' : 'Earn Shark Coins equal to your final score (0-100).'}</p>
                    </Card>
                    <Card className="p-6 rounded-2xl border-2 bg-card flex items-center gap-4">
                       <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-black">+50</div>
                       <p className="text-xs font-bold leading-relaxed">{lang === 'vi' ? 'Người tiên phong hoàn thành bài thi sớm nhất nhận thêm 50 Shark Coin.' : 'Be the first one to finish the exam and get a +50 Shark Coin bonus.'}</p>
                    </Card>
                 </div>
              </Card>
            </div>

            <div className="space-y-8">
              <div className="flex items-center gap-3 md:gap-4 px-2">
                <Medal className="w-6 h-6 md:w-10 md:h-10 text-primary" />
                <h2 className="text-xl md:text-4xl font-headline font-black text-foreground uppercase tracking-tight">{t.leaderboard}</h2>
              </div>
              
              <Card className="card-duo overflow-hidden border-border bg-card">
                 <div className="p-6 border-b-4 border-border/30 bg-muted/20">
                    <div className="grid grid-cols-12 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                       <div className="col-span-2">{t.rank}</div>
                       <div className="col-span-6">{t.player}</div>
                       <div className="col-span-2 text-right">{t.score}</div>
                       <div className="col-span-2 text-right">{t.time}</div>
                    </div>
                 </div>
                 <div className="divide-y-2 divide-border/20">
                    {leaderboard.length === 0 ? (
                      <div className="p-12 text-center text-muted-foreground italic font-black uppercase text-xs opacity-50">{lang === 'vi' ? 'CHƯA CÓ KẾT QUẢ' : 'NO RESULTS YET'}</div>
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
          <QuizView 
            t={t} lang={lang} config={exam.config} 
            initialQuestions={exam.questions} 
            onFinish={handleFinishQuiz} 
            onAskGuru={(msg) => console.log(msg)} 
            numericShortAnswers
          />
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
                onRetakeSame={() => setView('quiz')}
                onRetakeNew={() => setView('quiz')}
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
    </div>
  );
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

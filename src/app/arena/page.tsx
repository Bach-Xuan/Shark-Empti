'use client';
import Link from 'next/link';
import { useLanguageState,useThemeState } from '@/components/app-preferences';
import { PageControls } from '@/components/page-controls';
import { usePagedCollection } from '@/hooks/use-paged-collection';
import { formatStoredDate } from '@/lib/date-format';
import { readArenaExam, arenaConfigSchema } from '@/lib/public-firestore-schema';
import { uiMessage } from '@/lib/i18n';
import { quizLabel } from '@/lib/quiz-labels';
import { useMemo as usePageMemo } from 'react';

import { generateQuestions } from '@/ai/client-flows';
import Navigation from '@/components/navigation';
import SetupView from '@/components/setup-view';
import { Avatar,AvatarFallback,AvatarImage } from '@/components/ui/avatar';
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
Dialog,
DialogContent,
DialogHeader,
DialogTitle,
} from "@/components/ui/dialog";
import { Tabs,TabsContent,TabsList,TabsTrigger } from "@/components/ui/tabs";
import { useDoc,useFirestore,useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { showErrorToast } from '@/lib/error-toast';
import { arenaResponseError } from '@/lib/arena-detail';
import { translations,TranslationSet } from '@/lib/translations';
import { ArenaExam,QuizConfig } from '@/lib/types';
import {
collection,
orderBy,
query
} from 'firebase/firestore';
import {
CalendarDays,
Coins,
Gift,
Layers,
Loader2,
Play,
Plus,
Search,
Sparkles,
Trophy
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export default function ArenaPage() {
  const { user } = useUser();
  const db = useFirestore();
  const { data: profile } = useDoc(user ? `users/${user.uid}` : null);
  const router = useRouter();
  const { toast } = useToast();

  const [lang, setLang] = useLanguageState();
  const [theme, setTheme] = useThemeState();


  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const creating = useRef(false);
  const pendingExam = useRef<{ key: string; body: string } | null>(null);
  const creationVersion = useRef(0);
  const saveRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    creating.current = false;
    pendingExam.current = null;
    setIsCreating(false);
    creationVersion.current++;
    const version = creationVersion;
    const request = saveRequest;
    return () => { version.current++; request.current?.abort(); };
  }, [user?.uid]);
  const changeCreateDialog = (open: boolean) => {
    if (!open) {
      creationVersion.current++;
      saveRequest.current?.abort();
      creating.current = false;
      setIsCreating(false);
    }
    setIsCreateDialogOpen(open);
  };


  const source = usePageMemo(() => db ? query(collection(db, 'arenaExams'), orderBy('createdAt', 'desc')) : null, [db]);
  const page = usePagedCollection<ArenaExam>(source, readArenaExam);
  const { items: exams, loading } = page;

  const t: TranslationSet = translations[lang];

  const handleCreateExam = async (config: QuizConfig) => {
    if (!user || !db || creating.current) return;
    creating.current = true;
    const version = creationVersion.current;
    const current = () => version === creationVersion.current;
    setIsCreating(true);
    try {
      const validated = arenaConfigSchema.parse(config);
      const key = JSON.stringify([user.uid, lang, validated]);
      if (pendingExam.current?.key !== key) {
      // 1. Generate questions ONCE at creation time
      const result = await generateQuestions({
        subject: config.subject === 'none' ? undefined : config.subject,
        grade: config.grade === 'none' ? undefined : config.grade,
        topic: config.topic,
        excludeNotes: config.excludeNotes,
        type: config.type,
        difficulty: config.difficulty,
        numQuestions: Number(validated.numQuestions),
        language: lang as 'en' | 'vi',
        arenaMode: true,
      });
      if (!current()) return;

      if (!result.ok) {
        showErrorToast(result.error, lang);
        return;
      }

      if (!result.data.questions || result.data.questions.length === 0) {
        throw new Error("No questions generated");
      }

      // 2. Save everything including questions to Firestore
      const examData = {
        title: config.topic,
        config: validated,
        questions: result.data.questions,
        requestId: crypto.randomUUID(),
      };
      pendingExam.current = { key, body: JSON.stringify(examData) };
      }
      let token: string;
      try { token = await user.getIdToken(); }
      catch { throw { code: 'AUTH-REQUIRED' }; }
      if (!current()) return;
      const controller = new AbortController();
      saveRequest.current = controller;
      const response = await fetch('/api/arena', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: pendingExam.current.body,
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!current()) return;
      if (!response.ok) { showErrorToast(arenaResponseError(payload, response.status), lang); return; }
      if (!payload || typeof payload !== 'object' || !('id' in payload) || typeof payload.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(payload.id)) {
        throw { code: 'APP-DATA-INVALID' };
      }
      pendingExam.current = null;
      setIsCreateDialogOpen(false);
      toast({ title: uiMessage(lang, "arena.arena_exam_created") });
      router.push(`/arena/${payload.id}`);
    } catch (e) {
      if (current()) showErrorToast(arenaResponseError(e instanceof Error && e.name === 'ZodError' ? { code: 'APP-INVALID-INPUT' } : e, 0), lang);
    } finally {
      if (current()) { creating.current = false; setIsCreating(false); saveRequest.current = null; }
    }
  };

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
      <PageControls lang={lang} {...page} />
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b-4 border-border/30 pb-10">
          <div className="space-y-2">
            <h1 className="text-4xl md:text-8xl font-headline font-black text-primary uppercase tracking-tighter flex items-center gap-4 md:gap-8">
              <Trophy className="w-10 h-10 md:w-20 md:h-20" /> {t.arena}
            </h1>
            <p className="text-[10px] md:text-sm font-black text-muted-foreground uppercase tracking-[0.2em] opacity-60">
              {uiMessage(lang, "arena.challenge_the_community_earn_shark_coins")}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <Card className="card-duo px-4 md:px-8 py-2 md:py-4 flex items-center gap-3 md:gap-4 bg-primary text-white border-white/20">
              <Coins className="w-5 h-5 md:w-8 md:h-8 animate-bounce-subtle" />
              <div className="flex flex-col">
                <span className="text-[8px] md:text-xs font-black uppercase tracking-widest opacity-80">{t.sharkCoin}</span>
                <span className="text-lg md:text-3xl font-black">{profile?.sharkCoins || 0}</span>
              </div>
            </Card>
            <Button
              onClick={() => setIsCreateDialogOpen(true)}
              className="btn-duo h-12 md:h-20 px-6 md:px-10 rounded-2xl md:rounded-3xl bg-card text-foreground border-border font-black text-xs md:text-xl uppercase tracking-widest gap-3"
            >
              <Plus className="w-5 h-5 md:w-8 md:h-8 text-primary" /> {t.createArenaExam}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="exams" className="w-full">
          <TabsList className="h-14 md:h-20 p-2 bg-muted/30 border-4 border-border rounded-full w-full max-w-md mx-auto mb-12">
            <TabsTrigger value="exams" className="flex-1 rounded-full h-full font-black uppercase text-[10px] md:text-sm tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all gap-2">
              <Layers className="w-4 h-4 md:w-5 md:h-5" /> {t.arenaExams}
            </TabsTrigger>
            <TabsTrigger value="rewards" className="flex-1 rounded-full h-full font-black uppercase text-[10px] md:text-sm tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all gap-2">
              <Gift className="w-4 h-4 md:w-5 md:h-5" /> {t.rewards}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="exams" className="animate-in slide-in-from-bottom-4 duration-500">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[1, 2, 3, 4].map(i => <Card key={i} className="card-duo h-48 md:h-64 bg-muted/20 animate-pulse border-dashed" />)}
              </div>
            ) : exams.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center space-y-6 opacity-50">
                <Search className="w-20 h-20 text-muted-foreground" />
                <p className="font-black uppercase tracking-widest text-lg max-w-md">{t.noArenaExams}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-10">
                {exams.map((exam) => (
                  <Card
                    key={exam.id}
                    className="card-duo p-6 md:p-10 hover:-translate-y-2 transition-all bg-card border-border/50 group"

                  >
                    <div className="space-y-6">
                      <div className="flex items-start justify-between gap-4">
                        <Badge className="bg-primary/10 text-primary border-primary/20 font-black uppercase text-[8px] md:text-[10px] tracking-widest px-3 py-1">
                          {quizLabel('subject', exam.config.subject, t).toUpperCase()}
                        </Badge>
                        <span className="text-[8px] md:text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" /> {formatStoredDate(exam.createdAt, lang, { day: 'numeric', month: 'numeric', year: 'numeric' })}
                        </span>
                      </div>

                      <h2 className="text-xl md:text-3xl font-headline font-black text-foreground uppercase tracking-tight group-hover:text-primary transition-colors line-clamp-2">
                        <Link href={`/arena/${exam.id}`} className="focus-visible:outline-2 focus-visible:outline-primary">{exam.title}</Link>
                      </h2>

                      <div className="grid grid-cols-2 gap-3">
                         <div className="p-3 rounded-xl bg-muted/30 border-2 border-border flex flex-col">
                            <span className="text-[7px] font-black text-muted-foreground uppercase">{t.difficulty}</span>
                            <span className="text-[10px] font-black">{quizLabel('difficulty', exam.config.difficulty, t)}</span>
                         </div>
                         <div className="p-3 rounded-xl bg-muted/30 border-2 border-border flex flex-col">
                            <span className="text-[7px] font-black text-muted-foreground uppercase">{t.numQuestions}</span>
                            <span className="text-[10px] font-black">{exam.config.numQuestions}</span>
                         </div>
                      </div>

                      <div className="flex items-center justify-between pt-6 border-t-2 border-border/30">
                        <div className="flex items-center gap-2">
                          <Avatar className="w-8 h-8 rounded-lg border-2 border-border">
                            <AvatarImage src={exam.authorPhoto} />
                            <AvatarFallback>{exam.authorName[0]}</AvatarFallback>
                          </Avatar>
                          <span className="text-[9px] font-black text-primary uppercase tracking-widest truncate max-w-[100px]">{exam.authorName}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                           <Play className="w-4 h-4 fill-current" />
                           <span className="text-sm font-black">{exam.totalAttempts || 0}</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="rewards" className="animate-in slide-in-from-bottom-4 duration-500">
             <Card className="card-duo p-12 md:p-24 bg-card border-dashed border-primary/20 text-center space-y-8">
                <div className="w-24 h-24 md:w-40 md:h-40 bg-primary/10 rounded-[3rem] flex items-center justify-center mx-auto border-4 border-primary/20">
                   <Gift className="w-12 h-12 md:w-24 md:h-24 text-primary animate-pulse" />
                </div>
                <div className="space-y-4">
                   <h2 className="text-2xl md:text-5xl font-headline font-black text-primary uppercase tracking-tighter">{t.rewardExchange}</h2>
                   <p className="text-muted-foreground font-black text-[10px] md:text-xl uppercase tracking-[0.2em]">{t.notImplemented}</p>
                </div>
             </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={isCreateDialogOpen} onOpenChange={changeCreateDialog}>
        <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto rounded-[2.5rem] border-4 border-border shadow-2xl p-0 bg-card custom-scrollbar">
           <DialogHeader className="sr-only">
             <DialogTitle>{t.createArenaExam}</DialogTitle>
           </DialogHeader>
           {isCreating ? (
             <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-8 p-12 text-center">
                <div className="relative">
                  <Loader2 className="w-20 h-20 md:w-32 md:h-32 animate-spin text-primary opacity-20" />
                  <Sparkles className="absolute inset-0 m-auto w-10 h-10 md:w-16 md:h-16 text-primary animate-pulse" />
                </div>
                <div className="space-y-4">
                  <h2 className="text-2xl md:text-4xl font-headline font-black text-primary uppercase tracking-tight">{t.analyzing}</h2>
                  <p className="text-muted-foreground font-black uppercase text-[10px] md:text-sm tracking-widest">{uiMessage(lang, "arena.shark_guru_is_preparing_a_permanent_exam")}</p>
                </div>
             </div>
           ) : (
             <SetupView t={t} lang={lang} onStart={handleCreateExam} />
           )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

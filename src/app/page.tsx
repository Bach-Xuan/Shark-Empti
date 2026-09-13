'use client';
import { PageControls } from '@/components/page-controls';
import { useLearningSession } from '@/hooks/use-learning-session';
import { useHistory } from '@/hooks/use-history';

import { useHydrated,useLanguageState,useThemeState } from '@/components/app-preferences';
import { UiText } from "@/components/ui-text";

import ActivityCalendar from '@/components/activity-calendar';
import AiChatbot from '@/components/ai-chatbot';
import { ErrorBoundary } from '@/components/error-boundary';
import Navigation from '@/components/navigation';
import QuickNotes from '@/components/quick-notes';
import QuizView from '@/components/quiz-view';
import ResultView from '@/components/result-view';
import SetupView from '@/components/setup-view';
import { Tooltip,TooltipContent,TooltipProvider,TooltipTrigger } from '@/components/ui/tooltip';
import { useFirestore,useUser } from '@/firebase';
import { useUserNotes } from '@/firebase/firestore/use-user-notes';
import { type QuizQuestion } from '@/lib/learning-session';
import { calculateDashboardStats } from '@/lib/stats-utils';
import { translations,TranslationSet } from '@/lib/translations';
import { AppView,Language,QuizConfig } from '@/lib/types';
import { BarChart3,BrainCircuit,LayoutDashboard,Loader2,Star,StickyNote } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter,useSearchParams } from 'next/navigation';
import React,{ Suspense,useCallback,useEffect,useMemo,useState } from 'react';
const DashboardView = dynamic(() => import('@/components/dashboard-view'));
const PlaygroundView = dynamic(() => import('@/components/playground-view'));

const SidebarNavItem = ({ icon: Icon, label, onClick }: { icon: React.ElementType, label: string, onClick: () => void }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          aria-label={label}
          onClick={onClick}
          className="h-8 w-7 md:h-11 md:w-10 rounded-l-none rounded-r-full border-2 border-l-0 border-border/40 bg-white/90 dark:bg-white/10 shadow-[1px_1px_0_0_var(--duo-shadow)] hover:translate-x-1 hover:bg-white dark:hover:bg-white/20 hover:shadow-[3px_3px_0_0_var(--duo-shadow)] transition-all active:translate-x-0.5 active:shadow-none group flex items-center justify-center backdrop-blur-md"
        >
          <Icon className="w-3.5 h-3.5 md:w-5 md:h-5 text-foreground group-hover:scale-110 transition-transform" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="font-black text-[8px] md:text-[9px] uppercase tracking-widest border-2 rounded-lg md:rounded-xl bg-card text-foreground">
        {label}
      </TooltipContent>
    </Tooltip>
  );

function HomeContent() {
  const { user, loading: authLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const mounted = useHydrated();
  const [lang, setLang] = useLanguageState();
  const [theme, setTheme] = useThemeState();
  const [section, setSection] = useState<AppView>('setup');
  const { session, reset, start, ready: questionsReady, finish: finishQuiz } = useLearningSession(user, db, lang);
  const view: AppView = section === 'setup' && session.status !== 'setup' ? (session.status === 'result' ? 'result' : 'quiz') : section;
  const setView = useCallback((next: AppView) => {
    reset();
    setSection(next);
  }, [reset]);
  const { config: quizConfig, results: lastResults, questions: activeQuestions } = session;
  const historyPage = useHistory();
  const history = historyPage.items;
  const [chatbotTrigger, setChatbotTrigger] = useState<{ message: string, timestamp: number } | null>(null);

  // Playground Direct Context
  const [playgroundConfig, setPlaygroundConfig] = useState<{
    tab: 'flashcards' | 'practice';
    concept?: string;
  } | null>(null);

  // Centralized Data Hooks
  const { notes: personalNotes, updateNotes: onNotesChange } = useUserNotes();

  // Sync Language and Theme

  // Fetch History from Firestore


  useEffect(() => {
    const viewParam = searchParams.get('view') as AppView;
    if (viewParam && ['setup', 'dashboard', 'playground'].includes(viewParam)) {
      setView(viewParam);
    }
  }, [searchParams, setView]);

  useEffect(() => {
    if (mounted && !authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, mounted, router]);

  const t: TranslationSet = translations[lang];

  const onThemeChange = useCallback((isDark: boolean) => {
    setTheme(isDark ? 'dark' : 'light');
  }, [setTheme]);

  const changeLang = useCallback((newLang: Language) => {
    setLang(newLang);
  }, [setLang]);

  const startQuiz = useCallback((config: QuizConfig, initialQuestions: QuizQuestion[] | null = null) => {
    setSection('setup');
    start(config, initialQuestions);
  }, [start]);

  const handleAskGuru = useCallback((message: string) => {
    setChatbotTrigger({ message, timestamp: Date.now() });
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = window.innerWidth < 1024 ? 100 : 120;
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset - offset;
      window.scrollTo({ top: elementPosition, behavior: 'smooth' });
    }
  };

  const handleFixWeakness = useCallback((concept: string, type: 'practice' | 'flashcards') => {
    setPlaygroundConfig({ tab: type, concept });
    setView('playground');
  }, [setView]);


  const stats = useMemo(() => calculateDashboardStats(history, t, lang), [history, t, lang]);

  if (!mounted || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col font-body relative select-none overflow-x-hidden">
      <Navigation
        view={view}
        setView={setView}
        lang={lang}
        changeLang={changeLang}
        theme={theme}
        onThemeChange={(isDark) => onThemeChange(isDark)}
        t={t}
      />

      <div className="fixed left-0 top-32 md:top-40 z-[90] flex flex-col gap-2 md:gap-3 animate-in slide-in-from-left-4 duration-1000">
        <ActivityCalendar t={t} lang={lang} isSticky />
        {view !== 'dashboard' && (
          <QuickNotes
            t={t}
            lang={lang}
            isSticky
            notes={personalNotes}
            onNotesChange={onNotesChange}
          />
        )}

        {view === 'dashboard' && history.length > 0 && (
          <div className="flex flex-col gap-1.5 md:gap-2 mt-8 md:mt-12 animate-in slide-in-from-left-4 duration-500 delay-300">
            <TooltipProvider delayDuration={0}>
              <SidebarNavItem icon={LayoutDashboard} label={t.dashboard} onClick={() => scrollToSection('overview-header')} />
              <SidebarNavItem icon={BarChart3} label={t.learningSkillsChart} onClick={() => scrollToSection('charts-section')} />
              <SidebarNavItem icon={Star} label={t.analyticsHistory} onClick={() => scrollToSection('insights-section')} />
              <SidebarNavItem icon={BrainCircuit} label={t.recommendations} onClick={() => scrollToSection('recommendations-section')} />
              <SidebarNavItem icon={StickyNote} label={t.personalNotes} onClick={() => scrollToSection('notes-section')} />
            </TooltipProvider>
          </div>
        )}
      </div>

      <main className="flex-1 main-container pt-24 md:pt-36">
        {view === 'setup' && <SetupView t={t} lang={lang} onStart={startQuiz} />}
        {view === 'quiz' && quizConfig && (
          <QuizView
            t={t} lang={lang} config={quizConfig}
            initialQuestions={activeQuestions}
            onFinish={finishQuiz} onReady={questionsReady} onAskGuru={handleAskGuru}
          />
        )}
        {view === 'result' && lastResults && (
          <ResultView
            t={t} lang={lang} results={lastResults}
            onViewDashboard={() => setView('dashboard')}
            onRetakeSame={(questions) => startQuiz(quizConfig!, questions)}
            onRetakeNew={() => startQuiz(quizConfig!, null)}
          />
        )}
        {view === 'dashboard' && <PageControls lang={lang} {...historyPage} />}
        {view === 'dashboard' && (
          <ErrorBoundary><DashboardView
            t={t} lang={lang} history={history} stats={stats}
            personalNotes={personalNotes} onNotesChange={onNotesChange}
            onFixWeakness={handleFixWeakness}
          /></ErrorBoundary>
        )}
        {view === 'playground' && (
          <PlaygroundView
            t={t} lang={lang}
            weakPoints={stats?.processedGroupedInsights || []}
            totalAttempts={stats?.totalAttempts || 0}
            totalErrors={stats?.totalErrors || 0}
            initialConfig={playgroundConfig}
            onAskGuru={handleAskGuru}
          />
        )}
      </main>

      <footer className="w-full p-8 md:p-12 text-center mt-auto border-t-[4px] md:border-t-[5px] border-border/30">
        <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
          <UiText id="copyright" />
        </p>
      </footer>

      <AiChatbot t={t} lang={lang} results={lastResults} trigger={chatbotTrigger} />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>}>
      <HomeContent />
    </Suspense>
  );
}

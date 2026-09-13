
"use client";
import type { DashboardStats } from '@/lib/stats-utils';

import { Tabs,TabsContent,TabsList,TabsTrigger } from '@/components/ui/tabs';
import { TranslationSet } from '@/lib/translations';
import { Language } from '@/lib/types';
import {
Gamepad2,
Layers,
Zap
} from 'lucide-react';
import { useState } from 'react';
import FeatureHelp from './feature-help';

import FlashcardGame from './playground/flashcard-game';
import PracticeMode from './playground/practice-mode';

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

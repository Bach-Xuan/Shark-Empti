"use client";
import type { DashboardStats } from '@/lib/stats-utils';
import type { TranslationSet } from '@/lib/translations';

import { LatexText } from '@/components/latex-text';
import { Button } from '@/components/ui/button';
import { Card,CardHeader,CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
AlertCircle,
BrainCircuit,
Check,
CheckCircle2,
CheckSquare,
Copy,
Gamepad2,
Info,
Map,
Maximize2,
Sparkles,
Square,
Zap
} from 'lucide-react';
import React from 'react';


export function DashboardMetricCard({ title, value, icon, highlight, onExpand }: { title: string, value: string | number, icon: React.ReactNode, highlight?: boolean, onExpand?: () => void }) {
  return (
    <Card className={cn(
      "card-duo p-4 md:p-8 flex items-center gap-3 md:gap-6 group overflow-hidden relative transition-all duration-300 shadow-none",
      highlight ? "bg-primary text-white border-primary z-10" : "bg-card"
    )}>
      {onExpand && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onExpand}
          aria-label={title}
          className={cn(
            "absolute top-2 md:top-4 right-2 md:right-4 h-7 w-7 md:h-10 md:w-10 rounded-lg md:rounded-2xl transition-all hover:bg-muted/20 border-2 border-transparent hover:border-border",
            highlight && "hover:bg-white/20 hover:border-white/30 text-white"
          )}
        >
          <Maximize2 className="w-3.5 h-3.5 md:w-5 md:h-5 transition-transform group-hover:scale-110" />
        </Button>
      )}
      <div className={cn(
        "w-10 h-10 md:w-18 md:h-18 rounded-xl md:rounded-3xl flex items-center justify-center shrink-0 border-2 md:border-[3px] transition-all group-hover:-translate-y-1 duration-500",
        highlight ? 'bg-white/20 border-white/30' : 'bg-muted border-border'
      )}>
        {icon}
      </div>
      <div className="flex flex-col gap-0.5 md:gap-1 min-w-0 flex-1 text-left">
        <p className={cn(
          "text-[8px] md:text-[10px] font-black uppercase tracking-[0.05em] opacity-60 leading-tight whitespace-normal break-words",
          highlight ? 'text-white' : 'text-muted-foreground'
        )}>
          {title}
        </p>
        <p className="text-sm sm:text-base md:text-2xl font-headline font-black uppercase leading-tight tracking-tight whitespace-normal break-words">
          {value}
        </p>
      </div>
      {highlight && (
        <Sparkles className="absolute bottom-2 md:bottom-4 right-2 md:right-4 w-5 h-5 md:w-10 md:h-10 text-white/10 group-hover:text-white/30 transition-colors animate-pulse" />
      )}
    </Card>
  );
}

export function DashboardInsightList({ title, icon, data, type, t, onCopy, isCopied, onAction, onExpandRoadmap, roadmapStatus, toggleCheck }: {
  title: string, icon: React.ReactNode, data: DashboardStats['processedGroupedInsights'], type: 'insights' | 'feedback', t: TranslationSet, onCopy: () => void, isCopied: boolean, onAction?: (concept: string, type: 'practice' | 'flashcards') => void, onExpandRoadmap?: () => void, roadmapStatus?: Record<string, Record<string, boolean>>, toggleCheck?: (topicId: string, recommendationId: string) => void
}) {
  return (
    <Card className={cn(
      "card-duo p-5 md:p-12 flex flex-col h-[400px] md:h-[750px] group transition-all duration-300 shadow-none",
      type === 'insights' ? 'border-orange-500/20 bg-orange-500/5' : 'border-primary/20 bg-primary/5'
    )}>
      <CardHeader className="px-0 pt-0 shrink-0 flex flex-row items-center justify-between mb-4 md:mb-10">
        <CardTitle className={cn(
          "font-headline font-black flex items-center gap-2.5 md:gap-5 uppercase tracking-tighter text-sm md:text-3xl whitespace-normal break-words text-left",
          type === 'insights' ? 'text-orange-700 dark:text-orange-400' : 'text-primary'
        )}>
          <div className={cn(
            "w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-2xl flex items-center justify-center border-2 transition-transform group-hover:-translate-y-1 shrink-0",
            type === 'insights' ? 'bg-orange-500/20 border-orange-500/30' : 'bg-primary/20 border-primary/30'
          )}>
            {icon}
          </div>
          {title}
        </CardTitle>
        <div className="flex items-center gap-2 shrink-0">
          {type === 'feedback' && data.length > 0 && onExpandRoadmap && (
            <Button
              variant="outline"
              size="sm"
              className="btn-duo h-8 md:h-12 rounded-lg md:rounded-2xl border-2 px-3 md:px-5 font-black uppercase text-[8px] md:text-xs tracking-widest gap-2 bg-card shadow-none"
              onClick={onExpandRoadmap}
            >
              <Map className="w-3.5 h-3.5 md:w-5 md:h-5" /> {t.expandView}
            </Button>
          )}
          {data.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 md:h-12 md:w-12 rounded-lg md:rounded-xl opacity-40 hover:opacity-100 hover:bg-current/10 transition-all active:scale-95 shrink-0"
              onClick={onCopy}
              aria-label={`${t.copy}: ${title}`}
            >
              {isCopied ? <Check className="w-4 h-4 md:w-6 md:h-6" /> : <Copy className="w-4 h-4 md:w-6 md:h-6" />}
            </Button>
          )}
        </div>
      </CardHeader>
      <ScrollArea className="flex-1 pr-1 md:pr-6 custom-scrollbar">
        {data.length > 0 ? (
          <div className="space-y-6 md:space-y-16 pb-4 md:pb-10">
            {data.map((group, idx) => {
              const topicChecks = (roadmapStatus && roadmapStatus[group.topicId]) || {};
              const isTopicDone = type === 'feedback' && group.recommendations.length > 0 && group.recommendations.every(rec => !!topicChecks[rec.id]);

              return (
                <div key={group.topicId} className="space-y-4 md:space-y-10 animate-in fade-in slide-in-from-left-4 duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
                  <div className={cn("flex items-center justify-between gap-2 md:gap-4 pb-2 md:pb-4 border-b-2 md:border-b-[4px]", type === 'insights' ? 'border-orange-500/10' : 'border-primary/10')}>
                    <h3 className={cn(
                      "font-headline font-black text-[10px] md:text-2xl uppercase tracking-tight whitespace-normal break-words flex-1 transition-all text-left",
                      isTopicDone ? "line-through text-muted-foreground/60" : "text-foreground"
                    )}>
                      <LatexText text={group.topic} />
                    </h3>
                    {onAction && (
                      <div className="flex gap-1 md:gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onAction(group.topic, 'flashcards')}
                          className="h-7 w-7 md:h-10 md:w-10 p-0 rounded-lg md:rounded-xl border-2 hover:bg-primary/5 bg-card btn-duo shadow-none flex items-center justify-center"
                          aria-label={t.reviewWithFlashcards} title={t.reviewWithFlashcards}
                        >
                          <Gamepad2 className="w-4 h-4 md:w-5 md:h-5" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => onAction(group.topic, 'practice')}
                          className="h-7 w-7 md:h-10 md:w-10 p-0 rounded-lg md:rounded-xl bg-primary text-white border-2 border-white/20 btn-duo shadow-none flex items-center justify-center"
                          aria-label={t.fixMyWeakness} title={t.fixMyWeakness}
                        >
                          <Zap className="w-4 h-4 md:w-5 md:h-5" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-3 md:space-y-10 pl-1 md:pl-4">
                    {type === 'insights' ? (
                      <>
                        {group.strengths.length > 0 && (
                          <div className="space-y-2 md:space-y-4">
                            <h4 className="text-[7px] md:text-[10px] font-black uppercase text-green-600 tracking-widest flex items-center gap-1 md:gap-2 text-left">
                              <CheckCircle2 className="w-2.5 h-2.5 md:w-4 md:h-4 stroke-[3px]" /> {t.strengths}
                            </h4>
                            {group.strengths.map((s: string, i: number) => (
                              <div key={i} className="text-[9px] md:text-lg font-bold flex gap-2 md:gap-4 text-green-800 dark:text-green-300 items-start hover:translate-x-1 transition-transform whitespace-normal break-words leading-relaxed text-left">
                                <div className="w-1 md:w-2.5 h-1 md:h-2.5 rounded-full bg-current opacity-40 shrink-0 mt-1 md:mt-2" />
                                <LatexText text={s} />
                              </div>
                            ))}
                          </div>
                        )}
                        {group.weaknesses.length > 0 && (
                          <div className="space-y-2 md:space-y-4">
                            <h4 className="text-[7px] md:text-[10px] font-black uppercase text-orange-600 tracking-widest flex items-center gap-1 md:gap-2 text-left">
                              <AlertCircle className="w-2.5 h-2.5 md:w-4 md:h-4 stroke-[3px]" /> {t.weaknesses}
                            </h4>
                            {group.weaknesses.map((w: string, i: number) => (
                              <div key={i} className="text-[9px] md:text-lg font-bold flex gap-2 md:gap-4 text-red-800 dark:text-red-300 items-start hover:translate-x-1 transition-transform whitespace-normal break-words leading-relaxed text-left">
                                <div className="w-1 md:w-2.5 h-1 md:h-2.5 rounded-full bg-current opacity-40 shrink-0 mt-1 md:mt-2" />
                                <LatexText text={w} />
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      group.recommendations.map(r => {
                        const isDone = !!topicChecks[r.id];
                        return (
                          <div
                            key={r.id}
                            role="checkbox"
                            tabIndex={0}
                            aria-checked={isDone}
                            aria-label={r.text}
                            onKeyDown={event => {
                              if (event.key === ' ') { event.preventDefault(); toggleCheck?.(group.topicId, r.id); }
                            }}
                            className={cn(
                              "p-3 md:p-10 bg-card rounded-xl md:rounded-[2.5rem] border-2 md:border-[4px] flex gap-3 md:gap-8 animate-in zoom-in-95 duration-300 hover:shadow-lg transition-all group/item hover:-translate-y-1 relative cursor-pointer",
                              isDone ? "bg-muted/10 border-border" : "border-primary/10"
                            )}
                            onClick={() => toggleCheck?.(group.topicId, r.id)}
                          >
                            {roadmapStatus && (
                              <div className="absolute top-2 md:top-4 right-2 md:right-4 opacity-40 group-hover/item:opacity-100 transition-opacity">
                                {isDone ? (
                                  <CheckSquare className="w-4 h-4 md:w-6 md:h-6 text-green-600 fill-current stroke-[3px]" />
                                ) : (
                                  <Square className="w-4 h-4 md:w-6 md:h-6 text-muted-foreground stroke-[3px]" />
                                )}
                              </div>
                            )}
                            <div className={cn(
                              "w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 border-2 transition-transform",
                              isDone ? "opacity-40 grayscale" : "border-primary/20"
                            )}>
                              <BrainCircuit className="w-4 h-4 md:w-6 md:h-6 text-primary" />
                            </div>
                            <div className={cn(
                              "text-[9px] md:text-xl font-bold leading-relaxed whitespace-normal break-words transition-all text-left",
                              isDone ? "line-through text-muted-foreground italic opacity-60" : "text-foreground"
                            )}>
                              <LatexText text={r.text} />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-40 p-4 space-y-2">
            <Info className="w-8 h-8 md:w-12 md:h-12" />
            <p className="font-black text-[8px] md:text-xs uppercase tracking-widest leading-relaxed">
              {t.completeQuizHint}
            </p>
          </div>
        )}
      </ScrollArea>
    </Card>
  );
}

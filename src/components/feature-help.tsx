
"use client";

import React, { useState, useEffect } from 'react';
import { 
  HelpCircle, 
  Sparkles, 
  ArrowRight,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface FeatureHelpProps {
  title: string;
  items: readonly string[];
  helpTitle: string;
  storageKey: string;
}

export default function FeatureHelp({ title, items, helpTitle, storageKey }: FeatureHelpProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const hasSeenHelp = localStorage.getItem(storageKey);
    if (!hasSeenHelp) {
      setIsOpen(true);
      localStorage.setItem(storageKey, 'true');
    }
  }, [storageKey]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 md:h-8 md:w-8 rounded-full hover:bg-primary/10 transition-all border-2 border-transparent active:scale-90"
              >
                <HelpCircle className="w-4 h-4 md:w-5 md:h-5 text-primary opacity-60 hover:opacity-100" />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent className="font-black text-[9px] uppercase tracking-widest bg-card border-2">
            {helpTitle}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DialogContent className="max-w-xl w-[95vw] rounded-[2.5rem] border-[4px] border-border shadow-2xl p-6 md:p-10 bg-card overflow-hidden animate-in zoom-in-95 duration-300">
        <DialogHeader className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-primary/10 flex items-center justify-center border-2 border-primary/20">
              <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-primary" />
            </div>
            <DialogTitle className="text-2xl md:text-3xl font-headline font-black text-primary uppercase tracking-tight text-left">
              {helpTitle}
            </DialogTitle>
          </div>
          <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-muted-foreground text-left">
            {title}
          </p>
        </DialogHeader>

        <div className="space-y-4 md:space-y-6">
          {items.map((item, idx) => (
            <div 
              key={idx} 
              className="flex gap-4 p-4 rounded-2xl border-2 border-border/50 bg-muted/5 hover:bg-muted/10 transition-colors group animate-in slide-in-from-left-4 duration-500"
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-primary text-white flex items-center justify-center font-black text-[10px] md:text-xs shrink-0 shadow-duo group-hover:scale-110 transition-transform">
                {idx + 1}
              </div>
              <p className="text-[11px] md:text-sm font-bold text-foreground leading-relaxed flex-1">
                {item}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-end">
          <Button 
            onClick={() => setIsOpen(false)}
            className="btn-duo h-12 md:h-14 px-8 md:px-12 rounded-xl md:rounded-2xl bg-primary text-white font-black uppercase text-xs md:text-sm tracking-widest border-2 md:border-[3px] border-white/20"
          >
            <ArrowRight className="mr-2 w-4 h-4 md:w-5 md:h-5" /> GOT IT
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

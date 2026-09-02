
"use client";

import React, { useState, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  Sparkles,
  Info
} from 'lucide-react';
import { 
  groupActivityByMonth, 
  getDaysInMonth
} from '@/lib/activity-utils';
import { useUserActivity } from '@/firebase/firestore/use-user-activity';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '@/components/ui/tooltip';
import { TranslationSet } from '@/lib/translations';
import { cn } from '@/lib/utils';

interface ActivityCalendarProps {
  t: TranslationSet;
  lang: string;
  isSticky?: boolean;
}

export default function ActivityCalendar({ t, lang, isSticky }: ActivityCalendarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { activity, trackToday } = useUserActivity();

  // Track today whenever the calendar is interaction-ready
  React.useEffect(() => {
    trackToday();
  }, [trackToday]);

  const activeMonths = useMemo(() => groupActivityByMonth(activity), [activity]);

  const getDayKey = (date: Date) => {
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
  };

  const monthNamesEn = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthNamesVi = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];
  const monthNames = lang === 'vi' ? monthNamesVi : monthNamesEn;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className={cn(
            "rounded-xl hover:bg-muted transition-all btn-duo bg-card group border-2",
            isSticky 
              ? "h-12 w-10 md:h-16 md:w-14 rounded-l-none rounded-r-[1.5rem] md:rounded-r-[2rem] border-l-0 shadow-[4px_4px_0_0_var(--duo-shadow)] hover:translate-x-1" 
              : "h-9 w-9 md:h-11 md:w-11 rounded-xl md:rounded-2xl border-transparent hover:border-border"
          )}
        >
          <CalendarIcon className={cn(
            "text-primary group-hover:scale-110 transition-transform",
            isSticky ? "w-5 h-5 md:w-8 md:h-8" : "w-4 h-4 md:w-5 md:h-5"
          )} />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl w-[95vw] rounded-[2.5rem] border-[4px] border-border shadow-2xl p-6 md:p-10 animate-in fade-in zoom-in-95 duration-300">
        <DialogHeader className="mb-6">
          <DialogTitle className="text-2xl md:text-3xl font-headline font-black text-primary uppercase tracking-tight flex items-center gap-3">
            <CalendarIcon className="w-8 h-8" /> 
            {lang === 'vi' ? 'LỊCH HOẠT ĐỘNG' : 'ACTIVITY CALENDAR'}
          </DialogTitle>
          <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-muted-foreground mt-1">
            {lang === 'vi' ? 'THEO DÕI SỰ CHĂM CHỈ CỦA BẠN' : 'TRACK YOUR LEARNING CONSISTENCY'}
          </p>
        </DialogHeader>

        <div className="space-y-10 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
          {activeMonths.length === 0 ? (
            <div className="text-center py-12 opacity-50">
              <Info className="w-12 h-12 mx-auto mb-4" />
              <p className="font-black uppercase tracking-widest text-sm">
                {lang === 'vi' ? 'CHƯA CÓ DỮ LIỆU HOẠT ĐỘNG' : 'NO ACTIVITY DATA YET'}
              </p>
            </div>
          ) : (
            activeMonths.map((mInfo) => {
              const days = getDaysInMonth(mInfo.year, mInfo.month);
              const firstDayOfWeek = days[0].getDay();
              
              return (
                <div key={`${mInfo.year}-${mInfo.month}`} className="space-y-4">
                  <h3 className="text-sm md:text-base font-black uppercase tracking-widest text-foreground flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    {monthNames[mInfo.month]} {mInfo.year}
                  </h3>
                  
                  <div className="grid grid-cols-7 gap-1.5 md:gap-2">
                    {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                      <div key={`empty-${i}`} className="aspect-square w-full" />
                    ))}
                    
                    <TooltipProvider delayDuration={0}>
                      {days.map((date) => {
                        const key = getDayKey(date);
                        const isActive = !!activity[key];
                        return (
                          <Tooltip key={key}>
                            <TooltipTrigger asChild>
                              <div 
                                className={cn(
                                  "aspect-square w-full rounded-md md:rounded-lg border-[2px] transition-all duration-300",
                                  isActive 
                                    ? "bg-primary border-primary/20 shadow-sm animate-in zoom-in-50" 
                                    : "bg-muted/40 border-border/30"
                                )}
                              />
                            </TooltipTrigger>
                            <TooltipContent className="rounded-xl border-2 font-black text-[10px] uppercase tracking-widest p-2">
                              {date.toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                              {isActive && <span className="text-primary block mt-1">✓ {t.visited.toUpperCase()}</span>}
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </TooltipProvider>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-8 pt-6 border-t-2 border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              <div className="w-3 h-3 rounded-sm bg-muted/40 border border-border/30" />
              <div className="w-3 h-3 rounded-sm bg-primary border border-primary/20" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {t.activityLegend.toUpperCase()}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

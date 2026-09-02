
"use client";

import React, { useState, useEffect } from 'react';
import { StickyNote, Save, Copy, Check, Sigma, Binary, Type, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { TranslationSet } from '@/lib/translations';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { LatexText } from '@/components/latex-text';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const LATEX_SNIPPETS = [
  {
    id: 'math',
    label: 'Toán học',
    icon: Binary,
    items: [
      { code: '\\frac{a}{b}', label: 'Phân số' },
      { code: '\\sqrt{x}', label: 'Căn bậc 2' },
      { code: '\\sqrt[n]{x}', label: 'Căn n' },
      { code: 'x^{2}', label: 'Mũ 2' },
      { code: 'x^{n}', label: 'Mũ n' },
      { code: 'x_{n}', label: 'Chỉ số' },
      { code: '\\sum_{i=1}^{n}', label: 'Tổng' },
      { code: '\\int_{a}^{b}', label: 'Tích phân' },
      { code: '\\lim_{x \\to \\infty}', label: 'Giới hạn' },
      { code: '\\log_{a}x', label: 'Log a' },
      { code: '\\ln x', label: 'Log nepe' },
      { code: '\\sin x', label: 'Sin' },
      { code: '\\cos x', label: 'Cos' },
      { code: '\\tan x', label: 'Tan' },
    ]
  },
  {
    id: 'symbols',
    label: 'Ký hiệu',
    icon: Type,
    items: [
      { code: '\\pi', label: 'Pi' },
      { code: '\\alpha', label: 'Alpha' },
      { code: '\\beta', label: 'Beta' },
      { code: '\\gamma', label: 'Gamma' },
      { code: '\\Delta', label: 'Delta' },
      { code: '\\theta', label: 'Theta' },
      { code: '\\lambda', label: 'Lambda' },
      { code: '\\omega', label: 'Omega' },
      { code: '\\infty', label: 'Vô cực' },
      { code: '\\neq', label: 'Khác' },
      { code: '\\approx', label: 'Xấp xỉ' },
      { code: '\\leq', label: 'Nhỏ/bằng' },
      { code: '\\geq', label: 'Lớn/bằng' },
      { code: '\\rightarrow', label: 'Suy ra' },
      { code: '\\forall', label: 'Với mọi' },
      { code: '\\exists', label: 'Tồn tại' },
    ]
  },
  {
    id: 'chem',
    label: 'Hóa học',
    icon: FlaskConical,
    items: [
      { code: 'H_{2}O', label: 'Nước' },
      { code: 'CO_{2}', label: 'CO2' },
      { code: 'O_{2}', label: 'Oxy' },
      { code: 'H_{2}SO_{4}', label: 'H2SO4' },
      { code: 'C_{6}H_{12}O_{6}', label: 'Glucose' },
      { code: '\\rightarrow', label: 'Mũi tên' },
      { code: '\\rightleftharpoons', label: 'Thuận nghịch' },
      { code: '\\uparrow', label: 'Bay hơi' },
      { code: '\\downarrow', label: 'Kết tủa' },
      { code: 'SO_{4}^{2-}', label: 'Sunfat' },
      { code: 'OH^{-}', label: 'Hydroxit' },
      { code: 'H^{+}', label: 'Proton' },
    ]
  }
];

interface QuickNotesProps {
  t: TranslationSet;
  lang: string;
  isSticky?: boolean;
  notes: string;
  onNotesChange: (notes: string) => void;
}

export default function QuickNotes({ t, lang, isSticky, notes: externalNotes, onNotesChange }: QuickNotesProps) {
  const { toast } = useToast();
  const [localNotes, setLocalNotes] = useState(externalNotes);
  const [isOpen, setIsOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLocalNotes(externalNotes);
    }
  }, [isOpen, externalNotes]);

  const handleSave = () => {
    onNotesChange(localNotes);
    toast({
      title: lang === 'vi' ? 'ĐÃ LƯU!' : 'SAVED!',
      description: lang === 'vi' ? 'Ghi chú của bạn đã được cập nhật.' : 'Your notes have been updated.',
    });
    setIsOpen(false);
  };

  const handleCopy = () => {
    if (!localNotes) return;
    navigator.clipboard.writeText(localNotes).then(() => {
      setIsCopied(true);
      toast({ title: t.copied });
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const insertLatex = (type: 'inline' | 'block') => {
    const wrapper = type === 'inline' ? '$' : '$$';
    setLocalNotes(prev => prev + wrapper + wrapper);
  };

  const insertSnippet = (snippet: string) => {
    setLocalNotes(prev => prev + `$${snippet}$`);
  };

  const LatexQuickToolbar = ({ onSelect }: { onSelect: (s: string) => void }) => (
    <Card className="border-[3px] rounded-2xl md:rounded-[2rem] p-3 md:p-5 bg-muted/5 shadow-inner">
      <Tabs defaultValue="math" className="w-full">
        <TabsList className="bg-transparent h-auto p-0 flex flex-wrap gap-2 mb-4 justify-start">
          {LATEX_SNIPPETS.map(group => (
            <TabsTrigger 
              key={group.id} 
              value={group.id} 
              className="rounded-xl px-3 md:px-6 py-2 md:py-3 border-2 border-border data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:border-primary/20 text-[8px] md:text-xs font-black uppercase tracking-widest transition-all"
            >
              <group.icon className="w-3.5 h-3.5 md:w-5 md:h-5 mr-1.5 md:mr-2" />
              {group.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {LATEX_SNIPPETS.map(group => (
          <TabsContent key={group.id} value={group.id} className="mt-0 outline-none">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {group.items.map((item, idx) => (
                <Button 
                  key={idx} 
                  variant="outline" 
                  size="sm" 
                  className="h-10 md:h-12 justify-start px-2 md:px-3 rounded-xl md:rounded-2xl border-2 hover:border-primary hover:bg-primary/5 bg-card transition-all btn-duo shadow-none"
                  onClick={() => onSelect(item.code)}
                >
                  <span className="font-code text-[8px] md:text-sm text-primary truncate flex-1">{item.code}</span>
                  <span className="text-[6px] md:text-[8px] font-black uppercase opacity-40 truncate ml-1 shrink-0">{item.label}</span>
                </Button>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </Card>
  );

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
          <StickyNote className={cn(
            "text-primary group-hover:scale-110 transition-transform",
            isSticky ? "w-5 h-5 md:w-8 md:h-8" : "w-4 h-4 md:w-5 md:h-5"
          )} />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl w-[95vw] rounded-[2.5rem] border-[4px] border-border shadow-2xl p-6 md:p-10 animate-in fade-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto custom-scrollbar">
        <DialogHeader className="mb-6">
          <DialogTitle className="text-2xl md:text-3xl font-headline font-black text-primary uppercase tracking-tight flex items-center gap-3">
            <StickyNote className="w-8 h-8" /> 
            {t.personalNotes.toUpperCase()}
          </DialogTitle>
          <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-muted-foreground mt-1">
            {lang === 'vi' ? 'LƯU LẠI NHỮNG Ý TƯỞNG CỦA BẠN (HỖ TRỢ LATEX)' : 'SAVE YOUR THOUGHTS AND REMINDERS (LATEX SUPPORTED)'}
          </p>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2 justify-end mb-[-1rem]">
              <Button variant="ghost" size="sm" onClick={() => insertLatex('inline')} className="h-7 md:h-8 px-2 md:px-3 text-[9px] md:text-[10px] font-black bg-muted/50 rounded-lg md:rounded-xl hover:bg-primary/10 transition-all">$ Inline</Button>
              <Button variant="ghost" size="sm" onClick={() => insertLatex('block')} className="h-7 md:h-8 px-2 md:px-3 text-[9px] md:text-[10px] font-black bg-muted/50 rounded-lg md:rounded-xl hover:bg-primary/10 transition-all">$$ Block</Button>
            </div>
            
            <LatexQuickToolbar onSelect={insertSnippet} />
          </div>

          <Textarea 
            className="min-h-[200px] md:min-h-[300px] bg-muted/20 border-[3px] border-border rounded-3xl font-bold p-6 md:p-8 text-sm md:text-lg focus:ring-[6px] focus:ring-primary/10 focus:border-primary transition-all shadow-inner"
            placeholder={t.notesPlaceholder}
            value={localNotes}
            onChange={(e) => setLocalNotes(e.target.value)}
          />

          {localNotes.includes('$') && (
            <div className="p-6 md:p-8 bg-muted/10 rounded-3xl border-2 border-dashed border-border/50 animate-in fade-in duration-300">
              <span className="text-[8px] md:text-[9px] font-black uppercase text-primary/50 block mb-2 md:mb-4">{t.latexPreview}</span>
              <div className="text-sm md:text-lg font-bold leading-relaxed"><LatexText text={localNotes} /></div>
            </div>
          )}

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-4">
            <p className="text-[8px] md:text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest flex items-center gap-1.5 md:gap-2">
              <Sigma className="w-2.5 h-2.5 md:w-3 md:h-3" /> {t.latexHelp}
            </p>
            <div className="flex gap-4 justify-end">
              {localNotes && (
                <Button 
                  variant="outline" 
                  onClick={handleCopy}
                  className="rounded-xl font-black uppercase tracking-widest text-xs btn-duo border-2 h-12 px-6 flex items-center gap-2 bg-card"
                >
                  {isCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  {t.copy}
                </Button>
              )}
              <Button 
                onClick={handleSave}
                className="rounded-xl font-black uppercase tracking-widest text-xs btn-duo bg-primary text-white border-2 border-white/20 h-12 px-8 flex items-center gap-2"
              >
                <Save className="w-4 h-4" /> {t.save}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

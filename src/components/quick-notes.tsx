
"use client";
import { uiMessage } from '@/lib/i18n';
import { copyTextToClipboard } from '@/lib/clipboard';

import { LatexText } from '@/components/latex-text';
import { UiText } from "@/components/ui-text";
import { Button } from '@/components/ui/button';
import {
Dialog,
DialogContent,
DialogHeader,
DialogTitle,
DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { TranslationSet } from '@/lib/translations';
import { cn } from '@/lib/utils';
import { Check,Copy,Save,Sigma,StickyNote } from 'lucide-react';
import { useEffect,useRef,useState } from 'react';

import { LatexQuickToolbar } from '@/components/latex-toolbar';

interface QuickNotesProps {
  t: TranslationSet;
  lang: string;
  isSticky?: boolean;
  notes: string;
  onNotesChange: (notes: string) => Promise<boolean>;
}

export default function QuickNotes({ t, lang, isSticky, notes: externalNotes, onNotesChange }: QuickNotesProps) {
  const { toast } = useToast();
  const [localNotes, setLocalNotes] = useState(externalNotes);
  const [isOpen, setIsOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const savePending = useRef(false);

  useEffect(() => {
    if (isOpen && !isDirty) {
      setLocalNotes(externalNotes);
    }
  }, [isOpen, externalNotes, isDirty]);

  const handleSave = async () => {
    if (savePending.current) return;
    savePending.current = true;
    setIsSaving(true);
    const saved = await onNotesChange(localNotes).catch(() => false).finally(() => { savePending.current = false; setIsSaving(false); });
    if (!saved) return;
    setIsDirty(false);
    toast({
      title: uiMessage(lang, "quicknotes.saved"),
      description: uiMessage(lang, "quicknotes.your_notes_have_been_updated"),
    });
    setIsOpen(false);
  };

  const handleCopy = async () => {
    if (!localNotes) return;
    if (await copyTextToClipboard(localNotes)) {
      setIsCopied(true);
      toast({ title: t.copied });
      setTimeout(() => setIsCopied(false), 2000);
    } else toast({ variant: 'destructive', title: uiMessage(lang, "quicknotes.could_not_copy_please_try_again") });
  };

  const insertLatex = (type: 'inline' | 'block') => {
    if (savePending.current) return;
    setIsDirty(true);
    const wrapper = type === 'inline' ? '$' : '$$';
    setLocalNotes(prev => prev + wrapper + wrapper);
  };

  const insertSnippet = (snippet: string) => {
    if (savePending.current) return;
    setIsDirty(true);
    setLocalNotes(prev => prev + `$${snippet}$`);
  };


  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          aria-label={t.personalNotes}
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
            {uiMessage(lang, "quicknotes.save_your_thoughts_and_reminders_latex_supported")}
          </p>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2 justify-end mb-[-1rem]">
              <Button variant="ghost" size="sm" onClick={() => insertLatex('inline')} className="h-7 md:h-8 px-2 md:px-3 text-[9px] md:text-[10px] font-black bg-muted/50 rounded-lg md:rounded-xl hover:bg-primary/10 transition-all"><UiText id="inlineMath" /></Button>
              <Button variant="ghost" size="sm" onClick={() => insertLatex('block')} className="h-7 md:h-8 px-2 md:px-3 text-[9px] md:text-[10px] font-black bg-muted/50 rounded-lg md:rounded-xl hover:bg-primary/10 transition-all"><UiText id="blockMath" /></Button>
            </div>

            <LatexQuickToolbar onSelect={insertSnippet} />
          </div>

          <Textarea
            disabled={isSaving}
            className="min-h-[200px] md:min-h-[300px] bg-muted/20 border-[3px] border-border rounded-3xl font-bold p-6 md:p-8 text-sm md:text-lg focus:ring-[6px] focus:ring-primary/10 focus:border-primary transition-all shadow-inner"
            placeholder={t.notesPlaceholder}
            value={localNotes}
            onChange={(e) => { setIsDirty(true); setLocalNotes(e.target.value); }}
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
                disabled={isSaving}
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

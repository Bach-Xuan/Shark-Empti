
"use client";

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  BookOpen, 
  GraduationCap, 
  Target, 
  XCircle, 
  Layers, 
  Settings2, 
  Clock, 
  Play, 
  Loader2,
  Sparkles
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { validateAcademicTopic } from '@/ai/flows/academic-validation-flow';
import { QuizConfig, BaseViewProps } from '@/lib/types';
import { cn } from '@/lib/utils';
import FeatureHelp from './feature-help';
import { showErrorToast, showUnexpectedErrorToast } from '@/lib/error-toast';

interface SetupViewProps extends BaseViewProps {
  onStart: (config: QuizConfig) => void;
}

export default function SetupView({ t, lang, onStart }: SetupViewProps) {
  const { toast } = useToast();
  const [isValidating, setIsValidating] = useState(false);
  const [config, setConfig] = useState<QuizConfig>({
    subject: 'none',
    grade: 'none',
    topic: '',
    excludeNotes: '',
    type: 'Mixed',
    difficulty: 'Mixed',
    numQuestions: '10',
    timeLimit: ''
  });

  const subjects = [
    { id: 'literature', label: t.literature },
    { id: 'math', label: t.math },
    { id: 'physics', label: t.physics },
    { id: 'chemistry', label: t.chemistry },
    { id: 'biology', label: t.biology },
    { id: 'english', label: t.english },
    { id: 'other', label: t.other }
  ];

  const types = [
    { id: 'Multiple Choice', label: t.multipleChoice },
    { id: 'True/False', label: t.trueFalse },
    { id: 'Short Answer', label: t.shortAnswer },
    { id: 'Mixed', label: t.mixedQuestions }
  ];

  const difficulties = [
    { id: 'Recognition', label: t.recognition },
    { id: 'Comprehension', label: t.comprehension },
    { id: 'Application', label: t.application },
    { id: 'Advanced Application', label: t.advancedApplication },
    { id: 'Master', label: t.master },
    { id: 'Mixed', label: t.allLevels }
  ];

  const handleNumQuestionsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    if (val === '') {
      setConfig({ ...config, numQuestions: '' });
      return;
    }
    let num = parseInt(val);
    if (num > 50) num = 50;
    if (num < 1 && val !== '') num = 1;
    setConfig({ ...config, numQuestions: num.toString() });
  };

  const handleNumQuestionsBlur = () => {
    const num = parseInt(config.numQuestions);
    if (isNaN(num) || num < 1) {
      setConfig({ ...config, numQuestions: '1' });
    }
  };

  const handleTimeLimitMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    if (val === '') {
      setConfig({ ...config, timeLimit: '' });
      return;
    }
    let num = parseInt(val);
    if (num >= 1000) num = 999;
    if (num < 1 && val !== '') num = 1;
    setConfig({ ...config, timeLimit: num.toString() });
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(config.numQuestions);

    if (!config.topic || !config.type || !config.difficulty || isNaN(num) || num < 1 || num > 50) {
      toast({
        variant: "destructive",
        title: t.requiredFields.toUpperCase(),
        description: num > 50 ? (lang === 'vi' ? 'SỐ CÂU HỎI TỐI ĐA LÀ 50.' : 'MAX NUMBER OF QUESTIONS IS 50.') : "",
      });
      return;
    }

    setIsValidating(true);
    try {
      const result = await validateAcademicTopic({ 
        topic: config.topic,
        subject: config.subject === 'none' ? undefined : subjects.find(s => s.id === config.subject)?.label,
        grade: config.grade === 'none' ? undefined : config.grade,
        language: lang as 'en' | 'vi'
      });
      if (!result.ok) {
        showErrorToast(result.error, lang as 'en' | 'vi');
        return;
      }
      
      if (!result.data.isValid) {
        toast({
          variant: "destructive",
          title: t.invalidTopic.toUpperCase(),
          description: result.data.reason || t.notAcademic.toUpperCase(),
        });
        setIsValidating(false);
        return;
      }
    } catch (err) {
      console.error("Validation error:", err);
      showUnexpectedErrorToast('AI-REQUEST-FAILED', 'The topic could not be validated.', {}, lang as 'en' | 'vi');
      return;
    } finally {
      setIsValidating(false);
    }

    onStart(config);
  }, [config, lang, onStart, t, subjects, toast]);

  const RequiredLabel = ({ children, icon }: { children: React.ReactNode, icon?: React.ReactNode }) => (
    <div className="text-[10px] md:text-xs font-black uppercase text-muted-foreground flex items-center gap-2 select-none tracking-[0.2em] mb-3 group-hover:text-primary transition-colors">
      {icon} {children} <span className="text-destructive font-bold ml-1 animate-pulse">*</span>
    </div>
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-12 duration-1000 max-w-5xl mx-auto pb-24 px-2 md:px-0">
      <Card className="card-duo group overflow-hidden border-primary/20 shadow-none hover:shadow-[0_20px_0_0_var(--duo-shadow)]">
        <div className="bg-primary/5 p-10 md:p-20 border-b-[4px] border-border text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none" />
          <div className="relative z-10">
            <CardTitle className="font-headline text-3xl md:text-7xl font-black text-primary mb-4 md:mb-8 uppercase tracking-tighter leading-none animate-in zoom-in-95 duration-700 flex items-center justify-center gap-4">
              {t.setupTitle}
              <FeatureHelp 
                helpTitle={t.helpTitle}
                title={t.setupTitle}
                items={t.setupHelp}
                storageKey="shark_help_setup_seen"
              />
            </CardTitle>
            <CardDescription className="text-muted-foreground text-[10px] md:text-xl font-black uppercase tracking-[0.2em] leading-relaxed max-w-4xl mx-auto opacity-80 group-hover:opacity-100 transition-opacity">
              {t.setupDesc}
            </CardDescription>
          </div>
        </div>
        
        <CardContent className="p-8 md:p-20">
          <form onSubmit={handleSubmit} className="space-y-12 md:space-y-20">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16">
              <div className="space-y-4 group">
                <Label className="text-[10px] md:text-xs font-black uppercase text-muted-foreground flex items-center gap-3 select-none tracking-[0.2em] group-hover:text-primary transition-colors">
                  <BookOpen className="w-5 h-5 text-primary transition-transform group-hover:-translate-y-1" /> {t.subjectOptional}
                </Label>
                <Select value={config.subject} onValueChange={(v) => setConfig({ ...config, subject: v })}>
                  <SelectTrigger className="h-16 md:h-20 rounded-[1.5rem] md:rounded-3xl bg-muted/20 border-4 border-border font-black text-sm md:text-xl focus:ring-4 focus:ring-primary/10 hover:bg-primary/5 hover:border-primary/50 transition-all shadow-duo active:translate-y-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-3xl border-4 shadow-2xl p-2 animate-in slide-in-from-top-2">
                    <SelectItem value="none" className="font-black py-4 uppercase text-xs tracking-widest">{t.none}</SelectItem>
                    {subjects.map(s => <SelectItem key={s.id} value={s.id} className="font-black py-4 uppercase text-xs tracking-widest hover:bg-primary/10">{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4 group">
                <Label className="text-[10px] md:text-xs font-black uppercase text-muted-foreground flex items-center gap-3 select-none tracking-[0.2em] group-hover:text-primary transition-colors">
                  <GraduationCap className="w-5 h-5 text-primary transition-transform group-hover:-translate-y-1" /> {t.gradeOptional}
                </Label>
                <Select value={config.grade} onValueChange={(v) => setConfig({ ...config, grade: v })}>
                  <SelectTrigger className="h-16 md:h-20 rounded-[1.5rem] md:rounded-3xl bg-muted/20 border-4 border-border font-black text-sm md:text-xl hover:bg-primary/5 hover:border-primary/50 transition-all shadow-duo active:translate-y-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-3xl border-4 shadow-2xl p-2 animate-in slide-in-from-top-2">
                    <SelectItem value="none" className="font-black py-4 uppercase text-xs tracking-widest">{t.none}</SelectItem>
                    {[6,7,8,9,10,11,12].map(g => <SelectItem key={g} value={g.toString()} className="font-black py-4 uppercase text-xs tracking-widest hover:bg-primary/10">{t.gradeLabel} {g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4 md:col-span-2 group">
                <RequiredLabel icon={<Target className="w-5 h-5 text-primary transition-transform group-hover:-translate-y-1" />}>{t.topic}</RequiredLabel>
                <div className="relative">
                  <Input 
                    placeholder={lang === 'vi' ? 'ví dụ: Giải tích, Phản ứng oxi hóa-khử...' : 'e.g. Calculus, Redox reactions...'} 
                    className="h-18 md:h-24 rounded-[2rem] border-4 border-border font-black text-xl md:text-3xl focus-visible:ring-8 focus-visible:ring-primary/10 focus:border-primary bg-background transition-all hover:border-primary/50 shadow-duo px-10 placeholder:text-muted-foreground/30"
                    value={config.topic}
                    onChange={(e) => setConfig({ ...config, topic: e.target.value })}
                    disabled={isValidating}
                  />
                  {isValidating && (
                    <div className="absolute right-8 top-1/2 -translate-y-1/2">
                      <Loader2 className="w-8 h-8 md:w-12 md:h-12 animate-spin text-primary" />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4 md:col-span-2 group">
                <Label className="text-[10px] md:text-xs font-black uppercase text-muted-foreground flex items-center gap-3 select-none tracking-[0.2em] group-hover:text-primary transition-colors">
                  <XCircle className="w-5 h-5 text-primary transition-transform group-hover:-translate-y-1" /> {t.excludeOptional}
                </Label>
                <Textarea 
                  placeholder={t.excludePlaceholder} 
                  className="min-h-[120px] rounded-[2rem] border-4 border-border font-bold text-base md:text-xl focus-visible:ring-8 focus-visible:ring-primary/10 focus:border-primary bg-background transition-all hover:border-primary/50 shadow-duo p-8 placeholder:text-muted-foreground/30"
                  value={config.excludeNotes}
                  onChange={(e) => setConfig({ ...config, excludeNotes: e.target.value })}
                  disabled={isValidating}
                />
              </div>

              <div className="space-y-6 md:col-span-2">
                <RequiredLabel icon={<Layers className="w-5 h-5 text-primary" />}>{t.questionType}</RequiredLabel>
                <RadioGroup 
                  value={config.type} 
                  onValueChange={(v) => setConfig({ ...config, type: v })}
                  className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8"
                  disabled={isValidating}
                >
                  {types.map(type => (
                    <div key={type.id} className="relative group">
                      <RadioGroupItem value={type.id} id={type.id} className="peer sr-only" />
                      <Label 
                        htmlFor={type.id}
                        className="flex items-center justify-center p-4 h-full min-h-[80px] md:min-h-[100px] rounded-[1.5rem] md:rounded-3xl border-4 border-border cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 peer-data-[state=checked]:text-primary peer-data-[state=checked]:translate-y-[-4px] peer-data-[state=checked]:shadow-[0_8px_0_0_var(--duo-shadow)] font-black text-center text-[10px] md:text-sm select-none tracking-normal md:tracking-[0.1em] uppercase hover:bg-primary/5 shadow-duo active:translate-y-1 active:shadow-none whitespace-normal leading-tight"
                      >
                        {type.label}
                      </Label>
                      {config.type === type.id && (
                        <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-primary animate-pulse" />
                      )}
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-6 md:col-span-2">
                <RequiredLabel icon={<Settings2 className="w-5 h-5 text-primary" />}>{t.difficulty}</RequiredLabel>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-8">
                  {difficulties.map(diff => (
                    <Button
                      key={diff.id}
                      type="button"
                      disabled={isValidating}
                      variant={config.difficulty === diff.id ? "default" : "outline"}
                      className={cn(
                        "h-16 md:h-20 rounded-[1.5rem] md:rounded-3xl border-4 font-black text-[10px] md:text-sm select-none tracking-normal md:tracking-[0.05em] uppercase transition-all btn-duo px-4 whitespace-normal leading-tight",
                        config.difficulty === diff.id 
                          ? 'border-primary bg-primary text-white translate-y-[-4px]' 
                          : 'border-border hover:bg-primary/5 hover:border-primary/50 shadow-duo'
                      )}
                      onClick={() => setConfig({ ...config, difficulty: diff.id })}
                    >
                      {diff.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 md:col-span-2">
                <div className="space-y-4 group">
                  <RequiredLabel icon={<Settings2 className="w-5 h-5 text-primary transition-transform group-hover:-translate-y-1" />}>{t.numQuestions}</RequiredLabel>
                  <div className="flex items-center gap-6">
                    <Input 
                      type="text"
                      inputMode="numeric"
                      className="h-16 md:h-20 rounded-[1.5rem] md:rounded-3xl border-4 border-border font-black text-2xl md:text-4xl focus-visible:ring-8 focus-visible:ring-primary/10 transition-all shadow-duo max-w-[120px] md:max-w-[180px] text-center bg-background"
                      value={config.numQuestions}
                      onChange={handleNumQuestionsChange}
                      onBlur={handleNumQuestionsBlur}
                      disabled={isValidating}
                    />
                    <span className="text-muted-foreground font-black uppercase text-xs md:text-sm tracking-[0.2em]">{t.total}</span>
                  </div>
                </div>

                <div className="space-y-4 group">
                  <Label className="text-[10px] md:text-xs font-black uppercase text-muted-foreground flex items-center gap-3 select-none tracking-[0.2em] group-hover:text-primary transition-colors">
                    <Clock className="w-5 h-5 text-primary transition-transform group-hover:-translate-y-1" /> {t.timeLimitOptional}
                  </Label>
                  <div className="flex items-center gap-6">
                    <Input 
                      type="text"
                      inputMode="numeric"
                      placeholder={lang === 'vi' ? 'Phút' : 'Mins'}
                      className="h-16 md:h-20 rounded-[1.5rem] md:rounded-3xl border-4 border-border font-black text-2xl md:text-4xl focus-visible:ring-8 focus-visible:ring-primary/10 transition-all shadow-duo max-w-[120px] md:max-w-[180px] text-center bg-background"
                      value={config.timeLimit}
                      onChange={handleTimeLimitMinutesChange}
                      disabled={isValidating}
                    />
                  </div>
                </div>
              </div>
            </div>

            <Button 
              type="submit" 
              size="lg" 
              disabled={isValidating}
              className="w-full h-24 md:h-36 rounded-[2.5rem] md:rounded-[4rem] text-3xl md:text-6xl font-headline font-black btn-duo bg-primary hover:bg-primary/95 mt-16 md:mt-24 uppercase tracking-tighter border-[6px] border-white/20 transition-all group overflow-hidden active:translate-y-[8px]"
            >
              <div className="relative z-10 flex items-center justify-center">
                {isValidating ? (
                  <div className="flex items-center gap-4 md:gap-8 animate-in fade-in zoom-in-95 duration-300">
                    <Loader2 className="w-10 h-10 md:w-16 md:h-16 animate-spin" />
                    <span className="whitespace-normal break-words max-w-[80%] leading-tight">{t.analyzing}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-4 md:gap-8">
                    <Play className="w-10 h-10 md:w-16 md:h-16 fill-current transition-transform group-hover:scale-110" />
                    <span className="whitespace-normal break-words leading-tight">{t.startLearning}</span>
                  </div>
                )}
              </div>
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

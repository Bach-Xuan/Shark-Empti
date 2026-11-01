
"use client";
import { uiMessage } from '@/lib/i18n';
import { LEARNING_LIMITS } from '@/lib/data-limits';
import { subjectOptions } from '@/lib/subjects';

import { validateAcademicTopic } from '@/ai/client-flows';
import { Button } from '@/components/ui/button';
import { Card,CardContent,CardDescription,CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup,RadioGroupItem } from "@/components/ui/radio-group";
import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue,
} from "@/components/ui/select";
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { getAiError } from '@/lib/ai-error-message';
import { showErrorToast } from '@/lib/error-toast';
import { BaseViewProps,QuizConfig } from '@/lib/types';
import { cn } from '@/lib/utils';
import { numericQuizConfigSchema, QUIZ_LIMITS } from '@/lib/quiz-config';
import { useAiRequestScope } from '@/hooks/use-ai-request-scope';
import {
BookOpen,
Clock,
GraduationCap,
Layers,
Loader2,
Play,
Settings2,
Sparkles,
Target,
XCircle
} from 'lucide-react';
import React,{ useCallback,useLayoutEffect,useRef,useState } from 'react';
import FeatureHelp from './feature-help';

const RequiredLabel = ({ children, icon, htmlFor }: { children: React.ReactNode, icon?: React.ReactNode, htmlFor?: string }) => (
    <Label htmlFor={htmlFor} className="text-[10px] md:text-xs font-black uppercase text-muted-foreground flex items-center gap-2 select-none tracking-[0.2em] mb-3 group-hover:text-primary transition-colors">
      {icon} {children} <span aria-hidden="true" className="text-destructive font-bold ml-1">*</span>
    </Label>
  );

interface SetupViewProps extends BaseViewProps {
  onStart: (config: QuizConfig) => void;
}

export default function SetupView({ t, lang, onStart }: SetupViewProps) {
  const aiRequest = useAiRequestScope();
  const { toast } = useToast();
  const [isValidating, setIsValidating] = useState(false);
  const validationVersion = useRef(0);
  const pending = useRef(false);
  const revokeValidation = useCallback(() => {
    aiRequest.cancel();
    validationVersion.current++;
    pending.current = false;
  }, [aiRequest]);
  const [config, updateConfig] = useState<QuizConfig>({
    subject: 'none',
    grade: 'none',
    topic: '',
    excludeNotes: '',
    type: 'Mixed',
    difficulty: 'Mixed',
    numQuestions: '10',
    timeLimit: ''
  });

  const setConfig = useCallback((next: QuizConfig) => {
    aiRequest.cancel();
    validationVersion.current++;
    pending.current = false;
    setIsValidating(false);
    updateConfig(next);
  }, [aiRequest]);

  // Locale/navigation ownership changes revoke every outstanding response.
  useLayoutEffect(() => {
    validationVersion.current++;
    pending.current = false;
    setIsValidating(false);
    return revokeValidation;
  }, [lang, onStart, revokeValidation]);

  const subjects = subjectOptions(t);

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
    setConfig({ ...config, numQuestions: e.target.value });
  };

  const handleNumQuestionsBlur = () => {
    const num = parseInt(config.numQuestions);
    if (isNaN(num) || num < 1) {
      setConfig({ ...config, numQuestions: '1' });
    }
  };

  const handleTimeLimitMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfig({ ...config, timeLimit: e.target.value });
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending.current) return;
    if (!numericQuizConfigSchema.safeParse(config).success) {
      toast({ variant: 'destructive', title: t.requiredFields, description: lang === 'vi'
        ? `Số câu hỏi phải là số nguyên 1–${QUIZ_LIMITS.questions}; thời gian là 1–${QUIZ_LIMITS.minutes} phút hoặc để trống.`
        : `Questions must be an integer from 1–${QUIZ_LIMITS.questions}; time must be 1–${QUIZ_LIMITS.minutes} minutes or empty.` });
      return;
    }
    const num = parseInt(config.numQuestions);

    if (!config.topic || !config.type || !config.difficulty || isNaN(num) || num < 1 || num > 50) {
      toast({
        variant: "destructive",
        title: t.requiredFields.toUpperCase(),
        description: num > 50 ? (uiMessage(lang, "setupview.max_number_of_questions_is_50")) : "",
      });
      return;
    }

    const version = ++validationVersion.current;
    const snapshot = { ...config };
    pending.current = true;
    setIsValidating(true);
    try {
      const result = await validateAcademicTopic({
        topic: config.topic,
        subject: config.subject === 'none' ? undefined : subjects.find(s => s.id === config.subject)?.label,
        grade: config.grade === 'none' ? undefined : config.grade,
        language: lang as 'en' | 'vi'
      }, { signal: aiRequest.start() });
      if (version !== validationVersion.current) return;
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
      if (version !== validationVersion.current) return;
      showErrorToast(getAiError(err), lang as 'en' | 'vi');
      return;
    } finally {
      if (version === validationVersion.current) {
        pending.current = false;
        setIsValidating(false);
      }
    }

    if (version === validationVersion.current) onStart(snapshot);
  }, [config, lang, onStart, t, subjects, toast, aiRequest]);


  return (
    <div className="animate-in fade-in slide-in-from-bottom-12 duration-1000 max-w-5xl mx-auto pb-24 px-2 md:px-0">
      <Card className="card-duo group overflow-hidden border-primary/20 shadow-none hover:shadow-[0_20px_0_0_var(--duo-shadow)]">
        <div className="bg-primary/5 p-10 md:p-20 border-b-[4px] border-border text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none" />
          <div className="relative z-10">
            <CardTitle role="heading" aria-level={1} className="font-headline text-3xl md:text-7xl font-black text-primary mb-4 md:mb-8 uppercase tracking-tighter leading-none animate-in zoom-in-95 duration-700 flex items-center justify-center gap-4">
              {t.setupTitle}
              <FeatureHelp
                helpTitle={t.helpTitle}
                title={t.setupTitle}
                items={t.setupHelp}
                storageKey="shark_help_setup_seen"
              />
            </CardTitle>
            <CardDescription className="text-muted-foreground text-[10px] md:text-xl font-black uppercase tracking-[0.2em] leading-relaxed max-w-4xl mx-auto">
              {t.setupDesc}
            </CardDescription>
          </div>
        </div>

        <CardContent className="p-8 md:p-20">
          <form onSubmit={handleSubmit} className="space-y-12 md:space-y-20">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16">
              <div className="space-y-4 group">
                <Label htmlFor="setup-subject" className="text-[10px] md:text-xs font-black uppercase text-muted-foreground flex items-center gap-3 select-none tracking-[0.2em] group-hover:text-primary transition-colors">
                  <BookOpen className="w-5 h-5 text-primary transition-transform group-hover:-translate-y-1" /> {t.subjectOptional}
                </Label>
                <Select value={config.subject} onValueChange={(v) => setConfig({ ...config, subject: v })}>
                  <SelectTrigger id="setup-subject" className="h-16 md:h-20 rounded-[1.5rem] md:rounded-3xl bg-muted/20 border-4 border-border font-black text-sm md:text-xl focus:ring-4 focus:ring-primary/10 hover:bg-primary/5 hover:border-primary/50 transition-all shadow-duo active:translate-y-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-3xl border-4 shadow-2xl p-2 animate-in slide-in-from-top-2">
                    <SelectItem value="none" className="font-black py-4 uppercase text-xs tracking-widest">{t.none}</SelectItem>
                    {subjects.map(s => <SelectItem key={s.id} value={s.id} className="font-black py-4 uppercase text-xs tracking-widest hover:bg-primary/10">{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4 group">
                <Label htmlFor="setup-grade" className="text-[10px] md:text-xs font-black uppercase text-muted-foreground flex items-center gap-3 select-none tracking-[0.2em] group-hover:text-primary transition-colors">
                  <GraduationCap className="w-5 h-5 text-primary transition-transform group-hover:-translate-y-1" /> {t.gradeOptional}
                </Label>
                <Select value={config.grade} onValueChange={(v) => setConfig({ ...config, grade: v })}>
                  <SelectTrigger id="setup-grade" className="h-16 md:h-20 rounded-[1.5rem] md:rounded-3xl bg-muted/20 border-4 border-border font-black text-sm md:text-xl hover:bg-primary/5 hover:border-primary/50 transition-all shadow-duo active:translate-y-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-3xl border-4 shadow-2xl p-2 animate-in slide-in-from-top-2">
                    <SelectItem value="none" className="font-black py-4 uppercase text-xs tracking-widest">{t.none}</SelectItem>
                    {[6,7,8,9,10,11,12].map(g => <SelectItem key={g} value={g.toString()} className="font-black py-4 uppercase text-xs tracking-widest hover:bg-primary/10">{t.gradeLabel} {g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4 md:col-span-2 group">
                <RequiredLabel htmlFor="setup-topic" icon={<Target className="w-5 h-5 text-primary transition-transform group-hover:-translate-y-1" />}>{t.topic}</RequiredLabel>
                <div className="relative">
                  <Input
                    id="setup-topic" maxLength={LEARNING_LIMITS.label}
                    aria-required="true"
                    placeholder={uiMessage(lang, "setupview.e_g_calculus_redox_reactions")}
                    className="h-18 md:h-24 rounded-[2rem] border-4 border-border font-black text-xl md:text-3xl focus-visible:ring-8 focus-visible:ring-primary/10 focus:border-primary bg-background transition-all hover:border-primary/50 shadow-duo px-10 placeholder:text-muted-foreground"
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
                <Label htmlFor="setup-exclude" className="text-[10px] md:text-xs font-black uppercase text-muted-foreground flex items-center gap-3 select-none tracking-[0.2em] group-hover:text-primary transition-colors">
                  <XCircle className="w-5 h-5 text-primary transition-transform group-hover:-translate-y-1" /> {t.excludeOptional}
                </Label>
                <Textarea
                  id="setup-exclude" maxLength={LEARNING_LIMITS.text}
                  placeholder={t.excludePlaceholder}
                  className="min-h-[120px] rounded-[2rem] border-4 border-border font-bold text-base md:text-xl focus-visible:ring-8 focus-visible:ring-primary/10 focus:border-primary bg-background transition-all hover:border-primary/50 shadow-duo p-8 placeholder:text-muted-foreground"
                  value={config.excludeNotes}
                  onChange={(e) => setConfig({ ...config, excludeNotes: e.target.value })}
                  disabled={isValidating}
                />
              </div>

              <div className="space-y-6 md:col-span-2">
                <RequiredLabel icon={<Layers className="w-5 h-5 text-primary" />}>{t.questionType}</RequiredLabel>
                <RadioGroup
                  aria-label={t.questionType}
                  aria-required="true"
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
                        className="flex items-center justify-center p-4 h-full min-h-[80px] md:min-h-[100px] rounded-[1.5rem] md:rounded-3xl border-4 border-border cursor-pointer transition-all peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-primary peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 peer-data-[state=checked]:text-primary peer-data-[state=checked]:translate-y-[-4px] peer-data-[state=checked]:shadow-[0_8px_0_0_var(--duo-shadow)] font-black text-center text-[10px] md:text-sm select-none tracking-normal md:tracking-[0.1em] uppercase hover:bg-primary/5 shadow-duo active:translate-y-1 active:shadow-none whitespace-normal leading-tight"
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
                <div role="group" aria-label={t.difficulty} className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-8">
                  {difficulties.map(diff => (
                    <Button
                      key={diff.id}
                      type="button"
                      disabled={isValidating}
                      aria-pressed={config.difficulty === diff.id}
                      variant={config.difficulty === diff.id ? "default" : "outline"}
                      className={cn(
                        "h-16 md:h-20 rounded-[1.5rem] md:rounded-3xl border-4 font-black text-[10px] md:text-sm select-none tracking-normal md:tracking-[0.05em] uppercase transition-all btn-duo px-4 whitespace-normal leading-tight",
                        config.difficulty === diff.id
                          ? 'border-primary bg-primary text-primary-foreground translate-y-[-4px]'
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
                      aria-label={t.numQuestions}
                      aria-required="true"
                      aria-invalid={!numericQuizConfigSchema.shape.numQuestions.safeParse(config.numQuestions).success}
                      onChange={handleNumQuestionsChange}
                      onBlur={handleNumQuestionsBlur}
                      disabled={isValidating}
                    />
                    <span className="text-muted-foreground font-black uppercase text-xs md:text-sm tracking-[0.2em]">{t.total}</span>
                  </div>
                </div>

                <div className="space-y-4 group">
                  <Label htmlFor="setup-minutes" className="text-[10px] md:text-xs font-black uppercase text-muted-foreground flex items-center gap-3 select-none tracking-[0.2em] group-hover:text-primary transition-colors">
                    <Clock className="w-5 h-5 text-primary transition-transform group-hover:-translate-y-1" /> {t.timeLimitOptional}
                  </Label>
                  <div className="flex items-center gap-6">
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder={uiMessage(lang, "setupview.mins")}
                      className="h-16 md:h-20 rounded-[1.5rem] md:rounded-3xl border-4 border-border font-black text-2xl md:text-4xl focus-visible:ring-8 focus-visible:ring-primary/10 transition-all shadow-duo max-w-[120px] md:max-w-[180px] text-center bg-background"
                      value={config.timeLimit}
                      id="setup-minutes"
                      aria-invalid={!numericQuizConfigSchema.shape.timeLimit.safeParse(config.timeLimit).success}
                      aria-describedby="setup-minutes-help"
                      onChange={handleTimeLimitMinutesChange}
                      disabled={isValidating}
                    />
                    <span id="setup-minutes-help" className="text-xs text-muted-foreground">{lang === 'vi' ? `1–${QUIZ_LIMITS.minutes} phút hoặc để trống` : `1–${QUIZ_LIMITS.minutes} minutes or empty`}</span>
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

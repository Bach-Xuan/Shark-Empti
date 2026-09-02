
"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Minus, Send, Loader2, Sparkles, User } from 'lucide-react';
import { aiCoachingChatbotForQuizReview } from '@/ai/flows/ai-coaching-chatbot-flow';
import { LatexText } from '@/components/latex-text';
import { TranslationSet } from '@/lib/translations';
import { cn } from '@/lib/utils';
import { getAiErrorMessage } from '@/lib/ai-error-message';
import { showErrorToast, showUnexpectedErrorToast } from '@/lib/error-toast';

interface ChatMessage {
  role: 'user' | 'model';
  message: string;
}

interface AiChatbotProps {
  t: TranslationSet;
  lang: string;
  results: any;
  trigger: { message: string, timestamp: number } | null;
}

export default function AiChatbot({ t, lang, results, trigger }: AiChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  /**
   * Welcome message management
   */
  useEffect(() => {
    setMessages([{ role: 'model', message: t.botIntro }]);
  }, [lang, t.botIntro]);

  /**
   * External Triggers (from Quiz View)
   */
  useEffect(() => {
    if (trigger?.message) {
      setIsOpen(true);
      handleExternalMessage(trigger.message);
    }
  }, [trigger]);

  /**
   * Onboarding: Auto-open on first visit
   */
  useEffect(() => {
    const hasSeenChat = localStorage.getItem('shark_chat_seen');
    if (!hasSeenChat) {
      setIsOpen(true);
      localStorage.setItem('shark_chat_seen', 'true');
    }
  }, []);

  /**
   * Auto-scroll logic
   */
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const fetchAiResponse = useCallback(async (userMsg: string, currentHistory: ChatMessage[]) => {
    setIsTyping(true);
    try {
      const analysis = results?.analysis;
      
      const summary = {
        totalQuestions: results?.quizResults?.length || 0,
        correctAnswers: results?.quizResults?.filter((r: any) => r.isCorrect).length || 0,
        incorrectAnswers: results?.quizResults?.filter((r: any) => !r.isCorrect).length || 0,
        cognitiveMetrics: analysis?.cognitiveMetrics || {
          conceptMastery: 50,
          applicationSkill: 50,
          problemDecomposition: 50,
          logicalReasoning: 50,
          errorAwareness: 50,
          instructionFollowing: 50
        },
        errorAnalysis: analysis?.errorCategories || {}
      };

      const questions = results?.quizResults?.map((r: any) => ({
        questionText: r.question,
        userAnswer: r.userAnswer,
        correctAnswer: r.correct,
        isCorrect: r.isCorrect,
        explanation: r.explanation,
        errorCategory: r.errorCategory
      })) || [];

      const response = await aiCoachingChatbotForQuizReview({
        userMessage: userMsg,
        preferredLanguage: lang as 'en' | 'vi',
        isVietnamese: lang === 'vi',
        quizSummary: summary,
        quizQuestions: questions,
        chatHistory: currentHistory
      });

      if (!response.ok) {
        showErrorToast(response.error, lang as 'en' | 'vi');
        setMessages(prev => [...prev, { role: 'model', message: response.error.message }]);
        return;
      }

      const cleanResponse = response.data.aiResponse.replace(/\\n/g, '\n');
      setMessages(prev => [...prev, { role: 'model', message: cleanResponse }]);
    } catch (e) {
      console.error("Chatbot error:", e);
      showUnexpectedErrorToast('AI-REQUEST-FAILED', 'The chatbot could not respond.', {}, lang as 'en' | 'vi');
      setMessages(prev => [...prev, {
        role: 'model',
        message: getAiErrorMessage(e, lang as 'en' | 'vi')
      }]);
    } finally {
      setIsTyping(false);
    }
  }, [results, lang, t.botError]);

  const handleExternalMessage = useCallback(async (msg: string) => {
    if (isTyping) return;
    const updatedMessages: ChatMessage[] = [...messages, { role: 'user', message: msg }];
    setMessages(updatedMessages);
    await fetchAiResponse(msg, updatedMessages);
  }, [isTyping, messages, fetchAiResponse]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isTyping) return;

    const userMsg = input.trim();
    const updatedMessages: ChatMessage[] = [...messages, { role: 'user', message: userMsg }];
    setMessages(updatedMessages);
    setInput("");
    await fetchAiResponse(userMsg, updatedMessages);
  }, [input, isTyping, messages, fetchAiResponse]);

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-[100] flex flex-col items-end gap-4 pointer-events-none select-none max-w-[calc(100vw-32px)]">
      {isOpen && (
        <Card className="card-duo w-full sm:w-[350px] md:w-[420px] h-[500px] md:h-[600px] flex flex-col overflow-hidden animate-in slide-in-from-bottom-12 fade-in duration-500 pointer-events-auto border-[3px] shadow-2xl">
          {/* Enhanced Header */}
          <div className="bg-primary p-4 md:p-5 flex items-center justify-between text-white shadow-xl relative overflow-hidden group shrink-0">
            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center gap-3 md:gap-4 relative z-10">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-white/20 rounded-xl md:rounded-2xl flex items-center justify-center border-2 border-white/30 backdrop-blur-md shadow-inner">
                <Sparkles className="w-4 h-4 md:w-5 md:h-5 fill-current text-white" />
              </div>
              <div className="flex flex-col">
                <span className="font-headline font-black text-base md:text-lg tracking-tight uppercase leading-none">{t.sharkCoach}</span>
                <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mt-1">{t.aiAssistant}</span>
              </div>
            </div>
            <Button 
              type="button"
              variant="ghost" 
              size="icon" 
              onClick={handleClose} 
              className="relative z-20 text-white hover:bg-white/20 h-9 w-9 md:h-10 md:w-10 rounded-xl transition-all active:scale-90 border-2 border-transparent hover:border-white/30"
            >
              <Minus className="w-5 h-5 md:w-6 md:h-6" />
            </Button>
          </div>

          {/* Chat Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4 md:space-y-6 bg-background/50 backdrop-blur-sm custom-scrollbar">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex items-end gap-2", m.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2",
                  m.role === 'user' ? 'bg-primary border-primary/20' : 'bg-muted border-border'
                )}>
                  {m.role === 'user' ? <User className="w-3 h-3 text-white" /> : <Sparkles className="w-3 h-3 text-primary" />}
                </div>
                <div className={cn(
                  "max-w-[85%] p-3 md:p-4 rounded-xl md:rounded-2xl text-xs md:text-sm font-bold leading-relaxed shadow-duo border-[2px] md:border-[3px] transition-all",
                  m.role === 'user' 
                    ? 'bg-primary text-white border-primary/20 rounded-br-none' 
                    : 'bg-card text-foreground border-border rounded-bl-none'
                )}>
                  <LatexText text={m.message} />
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start items-end gap-2">
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center border-2 border-border">
                  <Sparkles className="w-3 h-3 text-primary" />
                </div>
                <div className="bg-card p-3 rounded-xl rounded-bl-none border-[2px] border-border shadow-duo flex gap-1.5 items-center">
                  <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-duration:0.8s]" />
                  <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-duration:0.8s] [animation-delay:0.2s]" />
                  <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-duration:0.8s] [animation-delay:0.4s]" />
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-4 md:p-5 bg-card border-t-[3px] border-border flex gap-2 md:gap-3 items-center shrink-0">
            <div className="flex-1 relative">
              <input 
                className="w-full bg-muted/30 rounded-xl md:rounded-2xl px-4 md:px-5 py-2.5 md:py-3.5 text-xs md:text-sm font-bold focus:outline-none focus:ring-[3px] focus:ring-primary/30 border-[2px] md:border-[3px] border-border focus:border-primary transition-all placeholder:text-muted-foreground/50"
                placeholder={t.chatPlaceholder}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                disabled={isTyping}
              />
            </div>
            <Button 
              size="icon" 
              onClick={handleSend} 
              disabled={!input.trim() || isTyping} 
              className="h-11 w-11 md:h-14 md:w-14 rounded-xl md:rounded-2xl btn-duo shadow-duo bg-primary hover:bg-primary/90 text-white border-[2px] md:border-[3px] border-primary/20 shrink-0 transition-transform active:scale-90"
            >
              {isTyping ? <Loader2 className="w-5 h-5 md:w-6 md:h-6 animate-spin" /> : <Send className="w-5 h-5 md:w-6 md:h-6" />}
            </Button>
          </div>
        </Card>
      )}

      {/* Floating Trigger Button */}
      {!isOpen && (
        <Button 
          size="lg" 
          onClick={() => setIsOpen(true)} 
          className="h-16 w-16 md:h-20 md:w-20 rounded-2xl md:rounded-[2rem] shadow-[0_10px_30px_-5px_rgba(255,107,0,0.4)] btn-duo pointer-events-auto transition-all hover:scale-110 active:scale-95 bg-primary text-white border-[3px] md:border-[4px] border-white/20 group relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity animate-pulse" />
          <Sparkles className="w-8 h-8 md:w-10 md:h-10 fill-current relative z-10 drop-shadow-lg" />
        </Button>
      )}
    </div>
  );
}

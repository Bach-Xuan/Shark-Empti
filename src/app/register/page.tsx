'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth, useFirestore, useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { logo as LogoComponent } from '@/components/logo';
import { Loader2, Languages, Sun, Moon, Sparkles, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from '@/hooks/use-toast';
import { translations, TranslationSet } from '@/lib/translations';
import { Language } from '@/lib/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';

export default function RegisterPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, loading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [lang, setLang] = useState<Language>('en');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Auto-hide/reveal logic
  const [isVisible, setIsVisible] = React.useState(true);
  const lastScrollY = React.useRef(0);

  React.useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Always show at the very top
      if (currentScrollY < 20) {
        setIsVisible(true);
      } 
      // Hide when scrolling down and passed 120px threshold
      else if (currentScrollY > lastScrollY.current && currentScrollY > 120) {
        setIsVisible(false);
      } 
      // Show when scrolling up
      else if (currentScrollY < lastScrollY.current) {
        setIsVisible(true);
      }
      
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const savedLang = localStorage.getItem('shark_lang') as Language;
    const savedTheme = localStorage.getItem('shark_theme') as 'light' | 'dark';
    
    if (savedLang) setLang(savedLang);
    
    let initialTheme: 'light' | 'dark' = 'light';
    if (savedTheme) {
      initialTheme = savedTheme;
    } else {
      initialTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    setTheme(initialTheme);
    document.documentElement.classList.toggle('dark', initialTheme === 'dark');
  }, []);

  useEffect(() => {
    if (!loading && user) {
      router.push('/');
    }
  }, [user, loading, router]);

  const t: TranslationSet = translations[lang];

  const changeLang = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem('shark_lang', newLang);
    // Dispatch custom event for global components like FocusTrackerWidget
    window.dispatchEvent(new CustomEvent('shark-lang-changed', { detail: newLang }));
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('shark_theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  const handleGoogleSignUp = useCallback(async () => {
    if (isSigningIn) return;

    setIsSigningIn(true);
    const provider = new GoogleAuthProvider();

    try {
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        const userDocRef = doc(firestore, 'users', result.user.uid);
        const userData = {
          displayName: result.user.displayName || 'New Learner',
          email: result.user.email,
          photoURL: result.user.photoURL,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        };
        
        setDoc(userDocRef, userData, { merge: true })
          .catch(async () => {
            const permissionError = new FirestorePermissionError({
              path: userDocRef.path,
              operation: 'write',
              requestResourceData: userData,
            });
            errorEmitter.emit('permission-error', permissionError);
          });

        router.push('/');
      }
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-closure-by-user') {
        toast({
          variant: "destructive",
          title: "Sign-up Failed",
          description: error.message || "An unexpected error occurred. Please try again.",
        });
      }
      setIsSigningIn(false);
    }
  }, [auth, firestore, isSigningIn, router, toast]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background transition-colors duration-500">
      <header className={cn(
        "fixed top-0 left-0 right-0 z-[100] w-full glass-morphism p-4 md:p-6 shrink-0 border-b-[3px] md:border-b-[5px] border-border/30 transition-all duration-500 transform bg-background/80 backdrop-blur-xl",
        isVisible ? "translate-y-0" : "-translate-y-full"
      )}>
        <div className="flex items-center justify-between w-full max-w-7xl mx-auto">
          <div className="flex items-center gap-2 md:gap-3 cursor-pointer group" onClick={() => router.push('/')}>
            <LogoComponent className="w-8 h-8 md:w-10 md:h-10 transition-all group-hover:scale-110" />
            <div className="flex flex-col">
              <div className="flex items-baseline gap-1 md:gap-2">
                <span className="font-headline font-black text-lg md:text-2xl leading-none text-primary tracking-tight uppercase">SHARK EMPTI</span>
                <span className="text-[8px] md:text-[10px] font-black text-muted-foreground/50 tracking-widest uppercase ml-1">v1.15.0</span>
              </div>
              <span className="text-[7px] md:text-[9px] font-black text-muted-foreground uppercase tracking-[0.15em] leading-tight whitespace-normal break-words">
                {t.appTagline}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="rounded-2xl hover:bg-muted h-10 px-3 md:h-12 md:px-5 border-[3px] border-transparent hover:border-border transition-all flex items-center gap-2 btn-duo bg-card">
                  <Languages className="w-5 h-5 text-primary" />
                  <span className="text-xs font-black uppercase tracking-widest hidden md:inline">
                    {lang === 'en' ? 'English' : 'Tiếng Việt'}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-[2rem] p-2 border-[4px] shadow-2xl min-w-[140px]">
                <DropdownMenuItem onClick={() => changeLang('en')} className="flex items-center justify-between py-3 px-4 rounded-2xl font-black uppercase text-xs cursor-pointer">
                  English
                  {lang === 'en' && <Check className="w-4 h-4 ml-2 text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => changeLang('vi')} className="flex items-center justify-between py-3 px-4 rounded-2xl font-black uppercase text-xs cursor-pointer">
                  Tiếng Việt
                  {lang === 'vi' && <Check className="w-4 h-4 ml-2 text-primary" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-2xl hover:bg-muted h-10 w-10 md:h-12 md:w-12 border-[3px] border-transparent hover:border-border transition-all btn-duo bg-card">
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5 text-primary" />}
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-4 pt-24 md:pt-32 md:pb-24">
        <Card className="card-duo w-full max-md p-8 md:p-12 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 bg-card hover:-translate-y-1">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-20 h-20 md:w-24 md:h-24 bg-primary/10 rounded-[2.5rem] flex items-center justify-center shadow-[0_6px_0_0_var(--duo-shadow)] border-[4px] border-primary/20 animate-bounce-subtle">
              <LogoComponent className="w-12 h-12 md:w-16 md:h-16" />
            </div>
            <h1 className="text-3xl md:text-4xl font-headline font-black text-primary uppercase tracking-tight">
              {lang === 'en' ? 'Join Us' : 'Tham Gia'}
            </h1>
            <p className="text-muted-foreground font-black text-[10px] md:text-xs uppercase tracking-[0.2em]">
              {lang === 'en' ? 'Create your academy profile' : 'Tạo hồ sơ học tập của bạn'}
            </p>
          </div>

          <Button
            onClick={handleGoogleSignUp}
            disabled={isSigningIn}
            className="w-full h-16 rounded-[2rem] btn-duo bg-primary text-white border-[4px] border-primary/20 font-black text-lg uppercase tracking-wider flex items-center justify-center gap-4 transition-all"
          >
            {isSigningIn ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                <svg className="w-7 h-7 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                {lang === 'en' ? 'Register with Google' : 'Đăng ký với Google'}
              </>
            )}
          </Button>

          <div className="text-center">
            <Button variant="link" onClick={() => router.push('/login')} className="text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors">
              {lang === 'en' ? "Already have an account? Log in" : "Đã có tài khoản? Đăng nhập"}
            </Button>
          </div>
        </Card>
      </div>

      <footer className="p-8 text-center border-t-[5px] border-border/30 bg-card/30">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
          @ 2026 Shark Empti. All rights reserved.
        </p>
      </footer>
    </div>
  );
}

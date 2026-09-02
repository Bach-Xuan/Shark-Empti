'use client';

import React from 'react';
import { logo as LogoComponent } from './logo';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { 
  Moon, 
  Sun, 
  LayoutDashboard, 
  Home as HomeIcon, 
  Languages,
  Check,
  User as UserIcon,
  MessageSquare,
  Gamepad2,
  Trophy
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Language, AppView } from '@/lib/types';
import { TranslationSet } from '@/lib/translations';
import { cn } from '@/lib/utils';
import { useUser } from '@/firebase';

interface NavigationProps {
  view: AppView;
  setView: (view: AppView) => void;
  lang: Language;
  changeLang: (lang: Language) => void;
  theme: 'light' | 'dark';
  onThemeChange: (checked: boolean) => void;
  t: TranslationSet;
}

export default function Navigation({ view, setView, lang, changeLang, theme, onThemeChange, t }: NavigationProps) {
  const { user, loading } = useUser();
  const router = useRouter();

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
      // Hide when scrolling down and passed a threshold
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

  const NavButton = ({ target, icon: Icon, label }: { target: AppView, icon: any, label: string }) => (
    <button 
      onClick={() => {
        if (target === 'forum') {
          router.push('/forum');
        } else if (target === 'arena') {
          router.push('/arena');
        } else {
          setView(target);
          if (window.location.pathname !== '/') {
            router.push(`/?view=${target}`);
          }
        }
      }} 
      className={cn(
        "flex items-center gap-1.5 md:gap-3 transition-all py-1.5 md:py-2 px-3 md:px-4 uppercase tracking-wider group relative active:translate-y-0.5 shrink-0",
        view === target ? "text-primary scale-105" : "text-muted-foreground hover:text-primary hover:-translate-y-1"
      )}
    >
      <Icon className={cn(
        "w-4 h-4 md:w-6 md:h-6 transition-transform group-hover:scale-110",
        view === target && "animate-bounce-subtle"
      )} /> 
      <span className="hidden xs:inline text-[9px] md:text-sm font-black">{label}</span>
    </button>
  );

  const handleProfileClick = () => {
    if (user) {
      router.push('/profile');
    } else {
      router.push('/login');
    }
  };

  const toggleTheme = () => {
    onThemeChange(theme === 'light');
  };

  const handleLangChange = (l: Language) => {
    changeLang(l);
    // Dispatch custom event for global components like FocusTrackerWidget
    window.dispatchEvent(new CustomEvent('shark-lang-changed', { detail: l }));
  };

  return (
    <nav className={cn(
      "fixed top-0 left-0 right-0 z-[100] w-full glass-morphism px-3 md:px-6 py-2.5 md:py-4 flex items-center justify-between select-none transition-all duration-500 border-b-[3px] md:border-b-[5px] border-border/30 overflow-hidden transform bg-background/80 backdrop-blur-xl",
      isVisible ? "translate-y-0" : "-translate-y-full"
    )}>
      <div className="flex items-center gap-1.5 md:gap-4 cursor-pointer shrink-0 group active:scale-95 transition-all" onClick={() => { setView('setup'); router.push('/'); }}>
        <div className="relative">
          <LogoComponent className="w-6 h-6 md:w-11 md:h-11 transition-all group-hover:scale-110 duration-500" />
          <div className="absolute inset-0 bg-primary/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <div className="flex flex-col">
          <div className="flex items-baseline gap-1 md:gap-2">
            <span className="font-headline font-black text-xs md:text-2xl leading-none text-primary tracking-tight uppercase group-hover:tracking-normal transition-all duration-500">SHARK EMPTI</span>
            <span className="hidden sm:inline text-[7px] md:text-[10px] font-black text-muted-foreground/50 tracking-widest uppercase ml-0.5 opacity-60">v1.15.1</span>
          </div>
          <span className="hidden md:block text-[9px] font-black text-muted-foreground uppercase tracking-[0.15em] leading-tight whitespace-normal break-words max-w-[120px] md:max-w-none">
            {t.appTagline}
          </span>
        </div>
      </div>

      <div className="flex items-center flex-1 justify-center px-2 md:px-6 overflow-hidden">
        <div className="flex items-center gap-0.5 md:gap-4 h-10 md:h-14 my-auto bg-muted/20 px-1.5 md:px-4 rounded-full border-2 md:border-[3px] border-border/20 overflow-x-auto no-scrollbar scroll-smooth">
          <NavButton target="setup" icon={HomeIcon} label={t.home} />
          <NavButton target="dashboard" icon={LayoutDashboard} label={t.dashboard} />
          <NavButton target="playground" icon={Gamepad2} label={t.playground} />
          <NavButton target="arena" icon={Trophy} label={t.arena} />
          <NavButton target="forum" icon={MessageSquare} label={t.forum} />
        </div>
      </div>

      <div className="flex items-center gap-1.5 md:gap-5 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className="rounded-xl md:rounded-2xl flex items-center gap-1 md:gap-2 px-2 md:px-5 hover:bg-muted h-9 md:h-12 border-2 md:border-[3px] border-transparent hover:border-border transition-all btn-duo bg-card group"
            >
              <Languages className="w-4 h-4 md:w-5 md:h-5 text-primary transition-transform group-hover:scale-110" />
              <span className="text-[8px] md:text-xs font-black uppercase tracking-wider hidden lg:inline">
                {lang === 'en' ? 'English' : 'Tiếng Việt'}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-xl md:rounded-[1.5rem] p-1.5 md:p-2 border-[3px] md:border-[4px] shadow-2xl min-w-[140px] md:min-w-[160px] animate-in slide-in-from-top-2 duration-300">
            <DropdownMenuItem onClick={() => handleLangChange('en')} className="flex items-center justify-between py-2 md:py-3 px-3 md:px-4 rounded-lg md:rounded-xl font-black uppercase text-[10px] md:text-xs cursor-pointer hover:bg-primary/10 transition-colors">
              English
              {lang === 'en' && <Check className="w-4 h-4 ml-2 text-primary" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleLangChange('vi')} className="flex items-center justify-between py-2 md:py-3 px-3 md:px-4 rounded-lg md:rounded-xl font-black uppercase text-[10px] md:text-xs cursor-pointer hover:bg-primary/10 transition-colors">
              Tiếng Việt
              {lang === 'vi' && <Check className="w-3 h-3 md:w-4 md:h-4 ml-2 text-primary" />}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button 
          variant="ghost" 
          size="icon" 
          onClick={toggleTheme} 
          className="rounded-xl md:rounded-2xl hover:bg-muted h-9 md:h-12 w-9 md:w-12 border-2 md:border-[3px] border-transparent hover:border-border transition-all btn-duo bg-card group"
        >
          {theme === 'light' ? 
            <Moon className="w-4 h-4 md:w-5 md:h-5 transition-transform group-hover:-translate-y-1" /> : 
            <Sun className="w-4 h-4 md:w-5 md:h-5 text-primary transition-transform group-hover:scale-125 group-hover:rotate-45" />
          }
        </Button>

        <button 
          onClick={handleProfileClick}
          className="relative group transition-all active:translate-y-1 hover:-translate-y-1 shrink-0"
        >
          {loading ? (
            <div className="w-9 h-9 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-muted animate-pulse border-2 md:border-[3px] border-border" />
          ) : user ? (
            <div className="relative">
              <Avatar className="w-9 h-9 md:w-12 md:h-12 rounded-xl md:rounded-2xl border-2 md:border-[4px] border-primary/20 shadow-duo group-hover:border-primary transition-all duration-300">
                <AvatarImage src={user.photoURL || ''} />
                <AvatarFallback className="bg-primary/10 text-primary font-black text-[9px] md:sm">
                  {user.email?.[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
          ) : (
            <div className="w-9 h-9 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-muted flex items-center justify-center border-2 md:border-[4px] border-border group-hover:text-primary transition-colors shadow-duo">
              <UserIcon className="w-4 h-4 md:w-6 md:h-6 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          )}
        </button>
      </div>
    </nav>
  );
}

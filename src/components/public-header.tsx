'use client';
import Link from 'next/link';
import { Moon, Sun } from 'lucide-react';
import { useAppPreferences } from './app-preferences';
import { publicCopy, publicMessages } from '@/lib/i18n/public';
import { Logo } from './logo';

/** Public navigation shares the brand without initializing Firebase or camera code. */
export function PublicHeader() {
  const { lang, theme, setLang, setTheme } = useAppPreferences();
  const copy = publicMessages[lang];
  return <header className="glass-morphism sticky top-0 z-40 bg-background/95">
    <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-8">
      <Link href="/" className="service-link gap-2 font-headline font-bold uppercase tracking-tight text-primary">
        <Logo className="h-7 w-7" /><span>{publicCopy.brand}</span>
      </Link>
      <div className="flex items-center gap-3">
        <select aria-label={copy.language} value={lang} onChange={event => setLang(event.target.value === 'vi' ? 'vi' : 'en')} className="h-11 rounded-2xl border-2 border-border bg-card px-3 text-sm font-bold shadow-duo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          <option value="en">English</option><option value="vi">Tiếng Việt</option>
        </select>
        <button type="button" aria-label={copy.theme} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="btn-duo grid h-11 w-11 place-items-center rounded-2xl bg-card">
          {theme === 'dark' ? <Sun className="h-5 w-5" aria-hidden="true" /> : <Moon className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>
    </div>
  </header>;
}

'use client';
import Link from 'next/link';
import { publicMessages } from '@/lib/i18n/public';
import { useAppPreferences } from './app-preferences';

const pages = ['about', 'privacy', 'cookies', 'terms', 'community', 'contact'] as const;
export function ServiceLinks() {
  const { lang } = useAppPreferences();
  const copy = publicMessages[lang];
  return <nav aria-label={copy.nav.label} className="flex flex-wrap justify-center gap-1">
    {pages.map(page => <Link key={page} className="service-link" href={'/' + page}>{copy.nav[page]}</Link>)}
  </nav>;
}
export function SiteFooter() {
  const { lang } = useAppPreferences();
  return <footer className="no-print mt-auto border-t-[3px] border-border/60 bg-card/60 px-4 py-8 text-center">
    <ServiceLinks />
    <p className="mt-4 font-headline text-xs font-bold tracking-wide text-muted-foreground">{publicMessages[lang].footer}</p>
    <p className="mt-2 text-xs text-muted-foreground">{'© Shark Empti'}</p>
  </footer>;
}

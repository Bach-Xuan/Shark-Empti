'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAppPreferences } from './app-preferences';
import { publicCopy, publicMessages } from '@/lib/i18n/public';
import { Logo } from './logo';

type SkeletonView = 'setup' | 'quiz' | 'dashboard' | 'playground' | 'profile' | 'forum' | 'arena' | 'detail' | 'auth' | 'information';
function viewFor(pathname: string | null): SkeletonView {
  if (pathname === '/login' || pathname === '/register') return 'auth';
  if (/^\/(forum|arena)\/[^/]+/.test(pathname ?? '')) return 'detail';
  if (pathname === '/profile' || pathname === '/forum' || pathname === '/arena') return pathname.slice(1) as SkeletonView;
  return pathname === '/' ? 'setup' : 'information';
}

/** Decorative geometry follows each destination; no intro copy flashes during Auth. */
export function RouteSkeleton({ view, onRetry }: { view?: SkeletonView; onRetry?: () => void }) {
  const pathname = usePathname();
  const { lang } = useAppPreferences();
  const copy = publicMessages[lang];
  const destination = view ?? viewFor(pathname);
  const [stalled, setStalled] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setStalled(false);
    const timer = setTimeout(() => setStalled(true), 30_000);
    return () => clearTimeout(timer);
  }, [destination, attempt]);
  const cards = destination === 'dashboard' ? 3 : destination === 'auth' ? 1 : 2;
  return <div className="mx-auto min-h-[70vh] w-full max-w-6xl space-y-8 px-4 py-6 md:px-8" aria-busy={!stalled}>
    <div role={stalled ? 'alert' : 'status'} className="flex flex-wrap items-center gap-3 text-primary">
      <Logo className="h-6 w-6" /><span className="font-headline text-sm font-bold uppercase tracking-wide">{publicCopy.brand}</span>
      <span className="text-sm font-medium text-muted-foreground">{stalled ? copy.stalled : copy.loading}</span>
      {stalled && <button className="service-link border-2 border-primary" onClick={() => { setAttempt(value => value + 1); if (onRetry) onRetry(); else window.location.reload(); }}>{copy.retry}</button>}
    </div>
    {!stalled && <div aria-hidden="true" className={destination === 'auth' ? 'mx-auto max-w-lg space-y-6' : 'space-y-6'}>
      <div className="loading-block h-12 w-2/3 max-w-lg" />
      <div className="loading-block h-5 w-1/2 max-w-sm" />
      <div className={destination === 'dashboard' ? 'grid gap-5 sm:grid-cols-3' : destination === 'forum' || destination === 'detail' ? 'space-y-5' : 'grid gap-5 md:grid-cols-2'}>
        {Array.from({ length: cards }, (_, index) => <div key={index} className="service-surface space-y-5">
          <div className="loading-block h-6 w-1/2" />
          <div className={destination === 'dashboard' ? 'loading-block h-36' : 'loading-block h-14'} />
          {destination !== 'dashboard' && <><div className="loading-block h-5 w-3/4" /><div className="loading-block h-14" /></>}
        </div>)}
      </div>
      {(destination === 'setup' || destination === 'quiz' || destination === 'playground') && <div className="service-surface grid gap-5 sm:grid-cols-2"><div className="loading-block h-20" /><div className="loading-block h-20" /><div className="loading-block h-14 sm:col-span-2" /></div>}
    </div>}
  </div>;
}

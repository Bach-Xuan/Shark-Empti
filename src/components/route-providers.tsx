'use client';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { ErrorBoundary } from './error-boundary';
import { RouteSkeleton } from './route-skeleton';

const Firebase = dynamic(() => import('@/firebase/client-provider').then(module => module.FirebaseClientProvider), { loading: () => <RouteSkeleton /> });
const Toaster = dynamic(() => import('./ui/toaster').then(module => module.Toaster));
const FocusTrackerWidget = dynamic(() => import('./focus-tracker-widget'));

/** Public information and ordinary 404s do not initialize Auth, Firestore or camera UI. */
export function RouteProviders({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const application = ['/', '/login', '/register', '/profile', '/forum', '/arena', '/moderation'].includes(pathname) || /^\/(?:forum|arena)\/[^/]+\/?$/.test(pathname);
  if (!application) return children;
  return <Firebase>
    {children}<Toaster />
    {!['/login', '/register'].includes(pathname) && <ErrorBoundary><FocusTrackerWidget /></ErrorBoundary>}
  </Firebase>;
}

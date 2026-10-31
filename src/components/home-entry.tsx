'use client';
import dynamic from 'next/dynamic';
import { useUser } from '@/firebase';
import { PublicIntro } from './public-intro';
import { RouteSkeleton } from './route-skeleton';
const LearningApp = dynamic(() => import('./learning-app'), { loading: () => <RouteSkeleton view="setup" /> });
export function HomeEntry() {
  const { user, loading } = useUser();
  return loading ? <RouteSkeleton view="setup" /> : user ? <LearningApp /> : <PublicIntro />;
}

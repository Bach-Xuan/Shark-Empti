'use client';
import dynamic from 'next/dynamic';
import { useUser } from '@/firebase';
import { PublicIntro } from '@/components/public-intro';

const LearningApp = dynamic(() => import('@/components/learning-app'), { loading: () => <PublicIntro /> });

/** The public entry does not download Quiz/Result/Playground code before Auth. */
export default function Home() {
  const { user, loading } = useUser();
  return user && !loading ? <LearningApp /> : <PublicIntro />;
}

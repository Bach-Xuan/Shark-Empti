'use client';
import { ErrorFallback } from '@/components/error-boundary';
export default function RouteError({ retry }: { retry: () => void }) {
  return <ErrorFallback reset={retry} />;
}

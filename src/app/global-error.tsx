'use client';
import { ErrorFallback } from '@/components/error-boundary';
export default function GlobalError({ retry }: { retry: () => void }) {
  return <html lang="en"><body><ErrorFallback reset={retry} /></body></html>;
}

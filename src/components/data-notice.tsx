'use client';
import Link from 'next/link';
import { errorMessages, translatedError } from '@/lib/i18n/errors';
import { Button } from './ui/button';

export function DataNotice({ lang, error, invalid = false, onRetry, back = '/' }: {
  lang: string; error?: { code?: string } | null; invalid?: boolean; onRetry?: () => void; back?: string;
}) {
  const language = lang === 'vi' ? 'vi' : 'en';
  const text = error ? translatedError(error.code ?? 'APP-REQUEST-FAILED', language)
    : invalid ? errorMessages[language].data
    : language === 'vi' ? 'Nội dung không tồn tại hoặc không còn khả dụng.' : 'This content does not exist or is no longer available.';
  return <section className="mx-auto max-w-xl space-y-4 rounded-2xl border p-6 text-center">
    <h1 className="text-xl font-bold">{language === 'vi' ? 'Không thể hiển thị nội dung' : 'Content unavailable'}</h1>
    <p role="alert">{text}</p>
    <div className="flex flex-wrap justify-center gap-3">
      {onRetry && <Button variant="outline" onClick={onRetry}>{errorMessages[language].retry}</Button>}
      <Button asChild><Link href={back}>{errorMessages[language].home}</Link></Button>
    </div>
  </section>;
}

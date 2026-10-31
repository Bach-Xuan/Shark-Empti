'use client';
import { uiMessage } from '@/lib/i18n';
import { Button } from './ui/button';
import { errorMessages, translatedError } from '@/lib/i18n/errors';
import { publicMessages } from '@/lib/i18n/public';

export function PageControls({ lang, loading, hasMore, loadMore, error, retry, invalidRecords = 0 }: {
  lang: string; loading: boolean; hasMore: boolean; loadMore: () => Promise<void>;
  error?: { code: string } | null; retry?: () => void; invalidRecords?: number;
}) {
  const language = lang === 'vi' ? 'vi' : 'en';
  return (
    <div className="my-4 text-center space-y-2">
      <p className="text-sm text-muted-foreground">{uiMessage(lang, 'pagination.scope')}</p>
      {loading && !hasMore && !error && <div aria-busy="true" className="space-y-4 py-4"><p role="status" className="font-headline text-sm font-bold text-primary">{publicMessages[language].loading}</p><div aria-hidden="true" className="grid gap-4 sm:grid-cols-2"><div className="loading-block h-40" /><div className="loading-block h-40" /></div></div>}
      {error && <div role="alert" className="space-y-2 rounded-xl border p-4">
        <p>{translatedError(error.code, language)}</p>
        {retry && <Button variant="outline" onClick={retry}>{errorMessages[language].retry}</Button>}
      </div>}
      {invalidRecords > 0 && <p role="status">{errorMessages[language].data} ({invalidRecords})</p>}
      {hasMore && (
        <Button disabled={loading} onClick={() => void loadMore()}>
          {uiMessage(lang, 'pagination.more')}
        </Button>
      )}
    </div>
  );
}

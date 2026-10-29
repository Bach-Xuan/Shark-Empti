'use client';
import { uiMessage } from '@/lib/i18n';
import { Button } from './ui/button';
import { errorMessages, translatedError } from '@/lib/i18n/errors';

export function PageControls({ lang, loading, hasMore, loadMore, error, retry, invalidRecords = 0 }: {
  lang: string; loading: boolean; hasMore: boolean; loadMore: () => Promise<void>;
  error?: { code: string } | null; retry?: () => void; invalidRecords?: number;
}) {
  const language = lang === 'vi' ? 'vi' : 'en';
  return (
    <div className="my-4 text-center space-y-2">
      <p className="text-sm text-muted-foreground">{uiMessage(lang, 'pagination.scope')}</p>
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

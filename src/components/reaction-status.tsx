'use client';
import type { Language } from '@/lib/types';

const messages = {
  en: { loading: 'Loading your reactions…', error: 'Your reactions could not be loaded.', retry: 'Retry reaction status' },
  vi: { loading: 'Đang tải trạng thái thích của bạn…', error: 'Không thể tải trạng thái thích của bạn.', retry: 'Tải lại trạng thái thích' },
};
const rankingMessages = {
  en: { loading: 'Loading your ranking status…', error: 'Your ranking status could not be loaded.', retry: 'Retry your ranking status' },
  vi: { loading: 'Đang tải trạng thái xếp hạng của bạn…', error: 'Không thể tải trạng thái xếp hạng của bạn.', retry: 'Tải lại trạng thái xếp hạng' },
};
export function ReactionStatus({ lang, loading, error, retry, kind = 'reactions' }: { lang: Language; loading: boolean; error: boolean; retry: () => void; kind?: 'reactions' | 'ranking' }) {
  const copy = (kind === 'ranking' ? rankingMessages : messages)[lang];
  if (error) return <div role="alert" className="my-3 flex flex-wrap items-center gap-3 text-sm"><p>{copy.error}</p><button type="button" className="underline underline-offset-4" onClick={retry}>{copy.retry}</button></div>;
  return loading ? <p role="status" className="my-3 text-sm text-muted-foreground">{copy.loading}</p> : null;
}

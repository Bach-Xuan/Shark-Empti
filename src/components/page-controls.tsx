'use client';
import { uiMessage } from '@/lib/i18n';
import { Button } from './ui/button';
export function PageControls({ lang, loading, hasMore, loadMore }: { lang: string; loading: boolean; hasMore: boolean; loadMore: () => Promise<void> }) {
 return <div className="my-4 text-center space-y-2"><p className="text-sm text-muted-foreground">{uiMessage(lang, 'pagination.scope')}</p>{hasMore && <Button disabled={loading} onClick={() => void loadMore()}>{uiMessage(lang, 'pagination.more')}</Button>}</div>;
}

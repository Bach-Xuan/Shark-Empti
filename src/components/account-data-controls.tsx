'use client';
import { useEffect, useRef, useState } from 'react';
import { useUser } from '@/firebase';
import { useMutation } from '@/hooks/use-mutation';
import { useRequestScope } from '@/hooks/use-request-scope';
import { communityRequest } from '@/lib/forum-client';
import { ACCOUNT_EXPORT_DATASETS } from '@/lib/account-data';
import { accountMessages } from '@/lib/i18n/account';
import { showErrorToast } from '@/lib/error-toast';
import { getAiError } from '@/lib/ai-error-message';
import type { Language } from '@/lib/types';
import { Button } from './ui/button';
import { z } from 'zod';

const Page = z.object({ dataset: z.enum(ACCOUNT_EXPORT_DATASETS), uid: z.string(), documents: z.array(z.object({ path: z.string(), data: z.unknown() })).max(10), identity: z.unknown().optional(), nextCursor: z.string().nullable() });
type Cursor = { dataset: number; after?: string; part: number };
export function AccountDataControls({ lang }: { lang: Language }) {
  const { user } = useUser();
  const copy = accountMessages[lang];
  const mutation = useMutation();
  const requestScope = useRequestScope();
  const [cursor, setCursor] = useState<Cursor>({ dataset: 0, part: 1 });
  const [status, setStatus] = useState<'part' | 'done' | 'saved' | null>(null);
  const alive = useRef(true);
  const requestIds = useRef<Partial<Record<'export' | 'deletion', string>>>({});
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const failure = (error: unknown) => showErrorToast(getAiError(error), lang);
  const download = async () => {
    if (!user) return;
    await mutation.run(async () => {
      const signal = requestScope.start();
      let next = { ...cursor }, bytes = 0;
      const pages: z.infer<typeof Page>[] = [];
      while (next.dataset < ACCOUNT_EXPORT_DATASETS.length && bytes < 6_000_000) {
        const dataset = ACCOUNT_EXPORT_DATASETS[next.dataset];
        const page = Page.parse(await communityRequest(user, '/api/account/export', { dataset, ...(next.after ? { cursor: next.after } : {}) }, 'POST', signal));
        if (!alive.current) return;
        if (page.uid !== user.uid || page.dataset !== dataset || page.nextCursor === next.after) throw { code: 'APP-DATA-INVALID' };
        pages.push(page); bytes += new TextEncoder().encode(JSON.stringify(page)).length;
        next = page.nextCursor ? { ...next, after: page.nextCursor } : { dataset: next.dataset + 1, part: next.part };
      }
      if (!alive.current) return;
      const complete = next.dataset === ACCOUNT_EXPORT_DATASETS.length;
      const file = new Blob([JSON.stringify({ format: 'shark-learning-data-v1', scope: 'known-private-learning', exportedAt: new Date().toISOString(), complete, continuation: complete ? null : next, pages }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(file);
      const link = document.createElement('a'); link.href = url; link.download = `shark-learning-data-part-${cursor.part}.json`;
      document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setCursor(complete ? { dataset: 0, part: 1 } : { ...next, part: cursor.part + 1 });
      setStatus(complete ? 'done' : 'part');
    }, failure);
  };
  const request = async (kind: 'export' | 'deletion') => {
    if (!user || (kind === 'deletion' && !window.confirm(copy.confirm))) return;
    requestIds.current[kind] ??= crypto.randomUUID();
    const result = await mutation.run(() => communityRequest(user, '/api/account/requests', { kind, requestId: requestIds.current[kind] }, 'POST', requestScope.start()), failure);
    if (result.ok) setStatus('saved');
  };
  return <section aria-labelledby="account-data-heading" className="space-y-4 rounded-2xl border p-5">
    <h2 id="account-data-heading" className="text-xl font-bold">{copy.title}</h2>
    <p className="text-sm">{copy.scope}</p><p className="text-sm text-muted-foreground">{copy.warning}</p>
    <div className="flex flex-wrap gap-3">
      <Button disabled={!user || mutation.pending} onClick={download}>{cursor.part > 1 ? copy.next : copy.download}</Button>
      <Button variant="outline" disabled={!user || mutation.pending} onClick={() => request('export')}>{copy.request}</Button>
      <Button variant="outline" disabled={!user || mutation.pending} onClick={() => request('deletion')}>{copy.deletion}</Button>
    </div>
    {status && <p role="status">{copy[status]}</p>}
  </section>;
}

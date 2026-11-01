'use client';
import Link from 'next/link';
import { RECEIPT_STORAGE_KEY, deletionReceiptSchema, type DeletionReceipt } from '@/lib/account-receipt';
import { useEffect, useRef, useState } from 'react';
import { GoogleAuthProvider, reauthenticateWithPopup } from 'firebase/auth';
import { z } from 'zod';
import { useUser } from '@/firebase';
import { communityRequest } from '@/lib/forum-client';
import { jobMessages } from '@/lib/i18n/jobs';
import type { JobView } from '@/lib/jobs/types';
import { nextAccountPollDelay, startAccountPolling } from '@/lib/account-polling';
import { accountJobViewSchema, readAccountStatus } from '@/lib/account-status-client';
import type { Language } from '@/lib/types';

const View = accountJobViewSchema;
export function AccountDataControls({ lang }: { lang: Language }) {
  const { user } = useUser();
  const copy = jobMessages[lang];
  const [jobs, setJobs] = useState<JobView[]>([]), [enabled, setEnabled] = useState<boolean | null>(null);
  const [receipt, setReceipt] = useState<DeletionReceipt | null>(null);
  const [error, setError] = useState(false), [busy, setBusy] = useState(false), [checked, setChecked] = useState(false), [revision, setRevision] = useState(0);
  const [pollError, setPollError] = useState<'retrying' | 'stopped' | null>(null), [receiptOnly, setReceiptOnly] = useState(false);
  const ids = useRef<Partial<Record<'export' | 'deletion', string>>>({});
  const alive = useRef(true);
  const downloadController = useRef<AbortController | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; downloadController.current?.abort(); }; }, []);
  useEffect(() => {
    if (!user) return;
    return startAccountPolling({
      read: signal => readAccountStatus(user, receipt, signal),
      onValue: result => { setJobs(result.jobs); setEnabled(result.enabled); setReceiptOnly(result.receiptOnly); setPollError(null); },
      onError: (_cause, willRetry) => setPollError(willRetry ? 'retrying' : 'stopped'),
      nextDelay: result => nextAccountPollDelay(result.jobs),
    });
  }, [user, revision, receipt]);
  const create = async (kind: 'export' | 'deletion') => {
    if (!user || busy || (kind === 'deletion' && !checked)) return;
    setBusy(true); setError(false);
    const requestId = ids.current[kind] ??= crypto.randomUUID();
    try {
      await reauthenticateWithPopup(user, new GoogleAuthProvider());
      const result = View.extend({ kind: z.literal(kind), receipt: kind === 'deletion' ? deletionReceiptSchema.shape.receipt : deletionReceiptSchema.shape.receipt.optional() })
        .parse(await communityRequest(user, '/api/account/jobs', { kind, requestId, ...(kind === 'deletion' ? { confirmDeletion: true } : {}) }));
      if (kind === 'deletion' && result.receipt) {
        const value = { id: result.id, receipt: result.receipt };
        if (alive.current) setReceipt(value);
        try { localStorage.setItem(RECEIPT_STORAGE_KEY, JSON.stringify(value)); } catch { /* A receipt file remains available when browser storage is blocked. */ }
      }
      if (alive.current) { setJobs(previous => [result, ...previous.filter(job => job.id !== result.id)]); setRevision(value => value + 1); }
      delete ids.current[kind];
    } catch { if (alive.current) setError(true); }
    finally { if (alive.current) setBusy(false); }
  };
  const download = async (id: string, part: number) => {
    if (!user || busy) return;
    setBusy(true);
    const controller = new AbortController(); downloadController.current = controller;
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const token = await Promise.race([user.getIdToken(), new Promise<never>((_, reject) => controller.signal.addEventListener('abort', () => reject(Error('Download deadline')), { once: true }))]);
      const response = await fetch('/api/account/jobs/' + id + '?part=' + part, { headers: { Authorization: 'Bearer ' + token }, signal: controller.signal });
      if (!response.ok) throw Error('Download failed');
      const url = URL.createObjectURL(await response.blob()), anchor = document.createElement('a');
      anchor.href = url; anchor.download = 'shark-account-' + part + '.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { if (alive.current) setError(true); }
    finally { clearTimeout(timer); if (alive.current) setBusy(false); }
  };
  return <section className="service-surface space-y-4" aria-busy={busy}>
    <h2 className="service-heading text-xl">{copy.title}</h2>
    <p className="text-sm leading-relaxed">{copy.description}</p>
    <p className="text-sm text-muted-foreground">{copy.reauth}</p>
    {enabled === null && !error && !pollError && <p className="text-sm" role="status">{copy.loading}</p>}
    {enabled === false && !receiptOnly && <p className="text-sm" role="status">{copy.unavailable}</p>}
    {receiptOnly && <p className="text-sm" role="status">{copy.receiptOnly}</p>}
    {pollError && <p role="alert">{pollError === 'retrying' ? copy.recovering : copy.recoveryStopped}</p>}
    {error && <p role="alert">{copy.error}</p>}
    <div className="flex flex-wrap gap-3">
      <button className="btn-duo min-h-11 rounded-2xl border-2 bg-card px-4 font-bold disabled:opacity-60" disabled={busy || !enabled} onClick={() => void create('export')}>{copy.export}</button>
      <button className="service-link" disabled={busy} onClick={() => setRevision(value => value + 1)}>{copy.retry}</button>
    </div>
    <div className="space-y-3 rounded-2xl border-2 border-destructive/60 p-4">
      <p className="text-sm leading-relaxed">{copy.warning}</p>
      <label className="flex items-start gap-3 text-sm"><input className="mt-1 h-5 w-5 shrink-0 accent-primary" type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)} /><span>{copy.confirm}</span></label>
      <button className="btn-duo min-h-11 rounded-2xl border-2 border-destructive px-4 font-bold text-destructive disabled:opacity-60" disabled={busy || !enabled || !checked} onClick={() => void create('deletion')}>{copy.deletion}</button>
    </div>
    <ul className="space-y-3" aria-live="polite">{jobs.map(job => <li className="rounded-2xl border-2 p-4 text-sm" key={job.id}>
      <p className="font-bold">{job.kind === 'export' ? copy.export : copy.deletion}: {copy.status[job.status]}</p>
      {job.errorCode === 'ACCOUNT-JOB-EXPIRED' && <p>{copy.processingExpired}</p>}
      {job.status === 'ready' && <div className="mt-3 flex flex-wrap gap-2">{Array.from({ length: job.parts }, (_, part) => <button key={part} className="service-link border-2" disabled={busy} onClick={() => void download(job.id, part)}>{part === job.parts - 1 ? copy.manifest : copy.part + ' ' + (part + 1)}</button>)}</div>}
    </li>)}</ul>
    <p className="text-sm">{copy.receiptInfo} <Link className="service-link" href="/account/status">{copy.receipt}</Link></p>
    {receipt && <button className="service-link border-2" onClick={() => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(receipt)], { type: 'application/json' })), anchor = document.createElement('a');
      anchor.href = url; anchor.download = 'shark-deletion-receipt.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }}>{copy.saveReceipt}</button>}
  </section>;
}

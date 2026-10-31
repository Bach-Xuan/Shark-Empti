'use client';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { jobStatuses, type JobStatus } from '@/lib/jobs/types';
import { jobMessages } from '@/lib/i18n/jobs';
import { useAppPreferences } from './app-preferences';
import { PublicHeader } from './public-header';
import { RECEIPT_STORAGE_KEY, deletionReceiptSchema, type DeletionReceipt } from '@/lib/account-receipt';

export function AccountReceipt() {
  const { lang } = useAppPreferences(), copy = jobMessages[lang];
  const [receipt, setReceipt] = useState<DeletionReceipt | null>(null);
  const [status, setStatus] = useState<JobStatus | 'error' | 'missing' | null>(null), [revision, setRevision] = useState(0);
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECEIPT_STORAGE_KEY);
      if (stored) setReceipt(deletionReceiptSchema.parse(JSON.parse(stored))); else setStatus('missing');
    } catch { setStatus('missing'); }
  }, []);
  useEffect(() => {
    if (!receipt) return;
    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(() => { if (active) setStatus('error'); controller.abort(); }, 15000);
    void (async () => {
      try {
        const response = await fetch('/api/account/jobs/' + receipt.id, { headers: { 'X-Deletion-Receipt': receipt.receipt }, signal: controller.signal });
        if (!response.ok) throw Error('Receipt unavailable');
        const result = z.object({ status: z.enum(jobStatuses) }).parse(await response.json());
        if (active) setStatus(result.status);
      } catch { if (active) setStatus('error'); }
      finally { clearTimeout(timer); }
    })();
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [revision, receipt]);
  return <><PublicHeader /><main className="mx-auto min-h-[60vh] max-w-3xl space-y-5 p-5">
    <h1 className="service-heading text-3xl">{copy.receipt}</h1><p>{copy.receiptInfo}</p>
    <p role={status === 'error' ? 'alert' : 'status'}>{status === 'error' ? copy.error : status === 'missing' ? copy.missingReceipt : status ? copy.status[status] : copy.loading}</p>
    <button className="service-link border-2" onClick={() => setRevision(value => value + 1)}>{copy.retry}</button>
    <label className="block space-y-2 font-semibold"><span>{copy.loadReceipt}</span><input type="file" accept=".json,application/json" className="block max-w-full rounded-xl border-2 p-3 text-sm" onChange={async event => {
      const file = event.target.files?.[0]; if (!file) return;
      try {
        if (file.size > 4096) throw Error('Invalid receipt');
        const value = deletionReceiptSchema.parse(JSON.parse(await file.text()));
        setStatus(null); setReceipt(value);
        try { localStorage.setItem(RECEIPT_STORAGE_KEY, JSON.stringify(value)); } catch { /* In-memory status works without storage access. */ }
      } catch { setStatus('error'); }
    }} /></label>
  </main></>;
}

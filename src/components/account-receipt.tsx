'use client';
import { useEffect, useRef, useState } from 'react';
import type { JobStatus } from '@/lib/jobs/types';
import { ACCOUNT_POLLING, nextAccountPollDelay, startAccountPolling } from '@/lib/account-polling';
import { readReceiptStatus } from '@/lib/account-status-client';
import { jobMessages } from '@/lib/i18n/jobs';
import { useAppPreferences } from './app-preferences';
import { PublicHeader } from './public-header';
import { RECEIPT_STORAGE_KEY, deletionReceiptSchema, type DeletionReceipt } from '@/lib/account-receipt';

export function AccountReceipt() {
  const { lang } = useAppPreferences(), copy = jobMessages[lang];
  const [receipt, setReceipt] = useState<DeletionReceipt | null>(null);
  const [status, setStatus] = useState<JobStatus | 'error' | 'missing' | 'unavailable' | null>(null), [revision, setRevision] = useState(0);
  const [retrying, setRetrying] = useState(false), [fileError, setFileError] = useState(false);
  const alive = useRef(false), fileEpoch = useRef(0), stopRead = useRef<(() => void) | null>(null);
  useEffect(() => { const uploads = fileEpoch; alive.current = true; return () => { alive.current = false; uploads.current++; }; }, []);
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECEIPT_STORAGE_KEY);
      if (stored) setReceipt(deletionReceiptSchema.parse(JSON.parse(stored))); else setStatus('missing');
    } catch { setStatus('missing'); }
  }, []);
  useEffect(() => {
    if (!receipt) return;
    const stop = startAccountPolling({
      read: signal => readReceiptStatus(receipt, signal),
      onValue: result => { setStatus(result.status); setRetrying(false); },
      onError: (error, willRetry) => {
        setRetrying(willRetry);
        setStatus(error && typeof error === 'object' && 'status' in error && error.status === 404 ? 'unavailable' : 'error');
      },
      nextDelay: result => nextAccountPollDelay([result]), deadlineMs: ACCOUNT_POLLING.receiptDeadlineMs,
    });
    stopRead.current = stop;
    return () => { stop(); if (stopRead.current === stop) stopRead.current = null; };
  }, [revision, receipt]);
  return <><PublicHeader /><main className="mx-auto min-h-[60vh] max-w-3xl space-y-5 p-5">
    <h1 className="service-heading text-3xl">{copy.receipt}</h1><p>{copy.receiptInfo}</p>
    <p role={status === 'error' || status === 'unavailable' ? 'alert' : 'status'}>{status === 'error' ? (retrying ? copy.recovering : copy.recoveryStopped) : status === 'unavailable' ? copy.receiptUnavailable : status === 'missing' ? copy.missingReceipt : status ? copy.status[status] : copy.loading}</p>
    {fileError && <p role="alert">{copy.invalidReceiptFile}</p>}
    <button className="service-link border-2" onClick={() => setRevision(value => value + 1)}>{copy.retry}</button>
    <label className="block space-y-2 font-semibold"><span>{copy.loadReceipt}</span><input type="file" accept=".json,application/json" className="block max-w-full rounded-xl border-2 p-3 text-sm" onChange={async event => {
      const file = event.target.files?.[0]; if (!file) return;
      const version = ++fileEpoch.current;
      setFileError(false);
      try {
        if (file.size > 4096) throw Error('Invalid receipt');
        const value = deletionReceiptSchema.parse(JSON.parse(await file.text()));
        if (!alive.current || version !== fileEpoch.current) return;
        stopRead.current?.();
        setStatus(null); setRetrying(false); setReceipt(value);
        try { localStorage.setItem(RECEIPT_STORAGE_KEY, JSON.stringify(value)); } catch { /* In-memory status works without storage access. */ }
      } catch { if (alive.current && version === fileEpoch.current) setFileError(true); }
    }} /></label>
  </main></>;
}

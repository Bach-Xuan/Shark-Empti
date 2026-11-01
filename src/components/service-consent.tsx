'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { z } from 'zod';
import Link from 'next/link';
import { SITE_INFO } from '@/lib/site-info';
import { publicMessages } from '@/lib/i18n/public';
import { useAppPreferences } from './app-preferences';
import { RouteSkeleton } from './route-skeleton';
import { communityRequest } from '@/lib/forum-client';
import { currentServicePolicy } from '@/lib/service-policy';
import { useRequestScope } from '@/hooks/use-request-scope';

const ConsentStatus = z.object({ accepted: z.boolean(), policyVersion: z.literal(SITE_INFO.policyVersion), minimumAge: z.literal(SITE_INFO.minimumAge) });

/** Self-declared eligibility; this does not verify a person's age or collect DOB. */
export function ServiceConsent({ user, children }: { user: Pick<User, 'uid' | 'getIdToken'>; children: ReactNode }) {
  const { lang } = useAppPreferences();
  const [state, setState] = useState<'loading' | 'required' | 'accepted' | 'error'>('loading');
  const [checked, setChecked] = useState(false), [busy, setBusy] = useState(false), [retry, setRetry] = useState(0);
  const requestScope = useRequestScope();
  const pending = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let alive = true;
    const signal = requestScope.start();
    const timer = setTimeout(() => { if (alive) { requestScope.cancel(); setState('error'); } }, 15_000);
    void communityRequest(user, '/api/account/consent', undefined, 'GET', signal).then(value => {
      if (alive && !signal.aborted) setState(ConsentStatus.parse(value).accepted ? 'accepted' : 'required');
    }).catch(() => { if (alive) setState('error'); }).finally(() => clearTimeout(timer));
    return () => { alive = false; clearTimeout(timer); };
  }, [user, retry, requestScope]);
  if (state === 'accepted') return children;
  if (state === 'loading') return <RouteSkeleton view="setup" />;
  const copy = publicMessages[lang];
  return <main className="mx-auto grid min-h-[65vh] max-w-2xl content-center gap-5 p-5">
    <section className="service-surface space-y-5">
      <h1 className="service-heading text-2xl">{lang === 'vi' ? 'Điều kiện sử dụng' : 'Before you continue'}</h1>
      {state === 'error' ? <p role="alert">{lang === 'vi' ? 'Chưa thể kiểm tra hoặc lưu xác nhận. Vui lòng thử lại.' : 'Your confirmation could not be checked or saved. Please retry.'}</p> : <>
        <p>{copy.ageRequired}</p>
        <p><Link className="service-link" href="/terms">{copy.nav.terms}</Link> · <Link className="service-link" href="/privacy">{copy.nav.privacy}</Link></p>
        <label className="flex cursor-pointer items-start gap-3"><input type="checkbox" className="mt-1 h-5 w-5 accent-primary" checked={checked} onChange={event => setChecked(event.target.checked)} />
          <span>{lang === 'vi' ? 'Tôi từ 16 tuổi và đồng ý với Điều khoản sử dụng; tôi đã đọc Quyền riêng tư.' : 'I am at least 16 and agree to the Terms of Use; I have read the Privacy Policy.'}</span></label>
      </>}
      <button type="button" disabled={busy || (state !== 'error' && !checked)} className="btn-duo min-h-12 rounded-2xl border-2 bg-primary px-5 font-bold text-primary-foreground disabled:opacity-60" onClick={async () => {
        if (state === 'error') { setState('loading'); setRetry(value => value + 1); return; }
        if (pending.current) return;
        pending.current = true;
        setBusy(true);
        const signal = requestScope.start();
        const timer = setTimeout(requestScope.cancel, 15_000);
        try {
          const result = ConsentStatus.parse(await communityRequest(user, '/api/account/consent', { ...currentServicePolicy, accept: true }, 'POST', signal));
          if (!result.accepted) throw Error('Confirmation unavailable');
          if (!signal.aborted) setState('accepted');
        } catch { if (mounted.current) setState('error'); } finally { clearTimeout(timer); pending.current = false; if (mounted.current) setBusy(false); }
      }}>{state === 'error' ? copy.retry : lang === 'vi' ? 'Xác nhận và tiếp tục' : 'Confirm and continue'}</button>
      <Link className="service-link" href="/account/data">{copy.dataControls}</Link>
      <Link className="service-link" href="/account/status">{copy.receipt}</Link>
    </section>
  </main>;
}

'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { doc, getDoc, setDoc, serverTimestamp, type Firestore } from 'firebase/firestore';
import Link from 'next/link';
import { SITE_INFO } from '@/lib/site-info';
import { publicMessages } from '@/lib/i18n/public';
import { useAppPreferences } from './app-preferences';
import { RouteSkeleton } from './route-skeleton';

/** Self-declared eligibility; this does not verify a person's age or collect DOB. */
export function ServiceConsent({ uid, firestore, children }: { uid: string; firestore: Firestore; children: ReactNode }) {
  const { lang } = useAppPreferences();
  const [state, setState] = useState<'loading' | 'required' | 'accepted' | 'error'>('loading');
  const [checked, setChecked] = useState(false), [busy, setBusy] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => { if (alive) setState('error'); }, 15_000);
    void getDoc(doc(firestore, 'users', uid, 'preferences', 'service')).then(snapshot => {
      if (alive) setState(snapshot.get('policyVersion') === SITE_INFO.policyVersion && snapshot.get('minimumAge') === 16 ? 'accepted' : 'required');
    }).catch(() => { if (alive) setState('error'); }).finally(() => clearTimeout(timer));
    return () => { alive = false; clearTimeout(timer); };
  }, [uid, firestore, retry]);
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
        setBusy(true);
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          await Promise.race([setDoc(doc(firestore, 'users', uid, 'preferences', 'service'), { policyVersion: SITE_INFO.policyVersion, minimumAge: 16, acceptedAt: serverTimestamp() }),
            new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error('Confirmation deadline')), 15000); })]);
          setState('accepted');
        } catch { setState('error'); } finally { clearTimeout(timer); setBusy(false); }
      }}>{state === 'error' ? copy.retry : lang === 'vi' ? 'Xác nhận và tiếp tục' : 'Confirm and continue'}</button>
    </section>
  </main>;
}

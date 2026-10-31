'use client';
import Link from 'next/link';
import { useAppPreferences } from '@/components/app-preferences';
import { publicCopy, publicMessages } from '@/lib/i18n/public';
import { PublicHeader } from '@/components/public-header';

export default function NotFound() {
  const { lang } = useAppPreferences();
  const copy = publicMessages[lang];
  return <><PublicHeader /><main className="mx-auto flex min-h-[60vh] max-w-xl flex-col justify-center gap-6 p-6 text-center">
    <p className="font-mono text-xl">{publicCopy.notFound}</p>
    <h1 className="service-heading text-3xl">{copy.notFoundTitle}</h1>
    <p className="service-prose">{copy.notFoundBody}</p>
    <Link href="/" tabIndex={0} className="rounded-xl border-2 p-3 font-bold underline">{lang === 'vi' ? 'Về trang chủ' : 'Go home'}</Link>
    <Link href="/about" tabIndex={0} className="underline">{lang === 'vi' ? 'Giới thiệu Shark Empti' : 'About Shark Empti'}</Link>
  </main></>;
}

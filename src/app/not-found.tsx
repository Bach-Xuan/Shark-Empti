'use client';
import Link from 'next/link';
import { useAppPreferences } from '@/components/app-preferences';
import { publicCopy } from '@/lib/i18n/public';

export default function NotFound() {
  const { lang } = useAppPreferences();
  return <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 p-6 text-center">
    <p className="font-mono text-xl">{publicCopy.notFound}</p>
    <h1 className="text-3xl font-bold">{lang === 'vi' ? 'Không tìm thấy trang' : 'Page not found'}</h1>
    <p>{lang === 'vi' ? 'Đường dẫn có thể đã đổi hoặc không còn tồn tại. Bạn có thể trở về trang chủ.' : 'This address may have changed or no longer exists. You can return to the public home page.'}</p>
    <Link href="/" className="rounded-xl border-2 p-3 font-bold underline">{lang === 'vi' ? 'Về trang chủ' : 'Go home'}</Link>
    <Link href="/about" className="underline">{lang === 'vi' ? 'Giới thiệu Shark Empti' : 'About Shark Empti'}</Link>
  </main>;
}

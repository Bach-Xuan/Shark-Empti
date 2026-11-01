'use client';
import Link from 'next/link';
import { AccountDataControls } from '@/components/account-data-controls';
import { PublicHeader } from '@/components/public-header';
import { useAppPreferences } from '@/components/app-preferences';
import { RouteSkeleton } from '@/components/route-skeleton';
import { useUser } from '@/firebase';

export default function AccountDataPage() {
  const { user, loading } = useUser();
  const { lang } = useAppPreferences();
  return <><PublicHeader /><main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10">
    <h1 className="service-heading text-3xl">{lang === 'vi' ? 'Dữ liệu tài khoản' : 'Account data'}</h1>
    <p>{lang === 'vi' ? 'Bạn có thể yêu cầu xuất hoặc xóa dữ liệu mà không cần chấp nhận lại chính sách học tập.' : 'You can request an export or deletion without accepting the learning policy again.'}</p>
    {loading ? <RouteSkeleton /> : user ? <AccountDataControls lang={lang} /> : <Link className="service-link" href="/login">{lang === 'vi' ? 'Đăng nhập' : 'Sign in'}</Link>}
  </main></>;
}

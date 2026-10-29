import Link from 'next/link';
import { publicCopy as copy } from '@/lib/i18n/public';

/** Meaningful public HTML while private, account-scoped UI initializes. */
export function PublicIntro() {
  return <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 p-6">
    <h1 className="text-4xl font-bold">{copy.brand}</h1>
    <p>{copy.intro.en}</p>
    <p lang="vi">{copy.intro.vi}</p>
    <p>{copy.intro.limits}</p>
    <nav aria-label={copy.nav.label} className="flex flex-wrap gap-4 underline">
      <Link href="/login">{copy.nav.signIn}</Link><Link href="/about">{copy.nav.about}</Link>
      <Link href="/privacy">{copy.nav.privacy}</Link><Link href="/terms">{copy.nav.terms}</Link>
    </nav>
  </main>;
}

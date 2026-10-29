import Link from 'next/link';
import { publicCopy as copy } from '@/lib/i18n/public';

export function ServiceLinks() {
  return <nav aria-label={copy.nav.label} className="flex flex-wrap justify-center gap-4 py-3 text-sm underline">
    <Link href="/about">{copy.nav.about}</Link><Link href="/privacy">{copy.nav.privacy}</Link>
    <Link href="/terms">{copy.nav.terms}</Link><Link href="/community">{copy.nav.community}</Link>
  </nav>;
}

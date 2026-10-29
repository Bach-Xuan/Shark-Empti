import type { Metadata } from 'next';
import Link from 'next/link';
import { siteOrigin } from '@/lib/site-metadata';
import { publicCopy as copy } from '@/lib/i18n/public';

export const metadata: Metadata = { title: 'About', alternates: { canonical: '/about' }, description: 'What Shark Empti does, its learning workflows and the limits of AI-assisted feedback.' };

export default function About() {
  const structured = { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Shark Empti', url: siteOrigin().origin, applicationCategory: 'EducationalApplication', operatingSystem: 'Web', inLanguage: ['en', 'vi'] };
  return <main className="mx-auto min-h-screen max-w-3xl space-y-6 p-6">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, '\\u003c') }} />
    <h1 className="text-3xl font-bold">{copy.about.title}</h1>
    <p>{copy.about.en}</p><p lang="vi">{copy.about.vi}</p>
    <p>{copy.about.limitsEn}</p><p lang="vi">{copy.about.limitsVi}</p>
    <nav aria-label={copy.nav.label} className="flex flex-wrap gap-4 underline"><Link href="/">{copy.nav.home}</Link><Link href="/privacy">{copy.nav.privacy}</Link><Link href="/terms">{copy.nav.terms}</Link><Link href="/community">{copy.nav.community}</Link></nav>
  </main>;
}

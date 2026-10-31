import type { Metadata } from 'next';
import { siteOrigin } from '@/lib/site-metadata';
import { ServiceInformation } from '@/components/service-information';
import { cookies } from 'next/headers';
import { PREFERENCE_COOKIE, parsePreferences } from '@/lib/preferences';
import { serviceMessages } from '@/lib/i18n/service';

export async function generateMetadata(): Promise<Metadata> {
  const lang = parsePreferences((await cookies()).get(PREFERENCE_COOKIE)?.value)?.lang ?? 'en';
  return { title: serviceMessages[lang].about.title, alternates: { canonical: '/about' }, description: serviceMessages[lang].about.intro };
}
export default function About() {
  const structured = { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Shark Empti', url: siteOrigin().origin, applicationCategory: 'EducationalApplication', operatingSystem: 'Web', inLanguage: ['en', 'vi'] };
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, '\\u003c') }} />
    <ServiceInformation section="about" />
  </>;
}

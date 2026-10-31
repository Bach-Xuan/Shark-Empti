'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft } from 'lucide-react';
import { publicMessages } from '@/lib/i18n/public';
import { serviceMessages, type ServicePage } from '@/lib/i18n/service';
import { useAppPreferences } from './app-preferences';
import { PublicHeader } from './public-header';
import { SITE_INFO } from '@/lib/site-info';

export function ServiceInformation({ section }: { section: ServicePage }) {
  const { lang } = useAppPreferences();
  const copy = publicMessages[lang];
  const content = serviceMessages[lang][section];
  // The server supplies the initial title; in-page locale changes need the same title.
  useEffect(() => { document.title = `${content.title} | ${SITE_INFO.name}`; }, [content.title]);
  return <>
    <PublicHeader />
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10 md:px-8 md:py-16">
      <header className="service-surface bg-primary/5">
        <p className="mb-4 text-xs font-bold uppercase tracking-wide text-muted-foreground">{copy.policyVersion}</p>
        <h1 className="service-heading max-w-4xl text-3xl leading-tight md:text-5xl">{content.title}</h1>
        <p className="service-prose mt-6 max-w-3xl">{content.intro}</p>
      </header>
      <div className="grid items-start gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <nav aria-label={copy.pageContents} className="service-surface space-y-1 p-4 lg:sticky lg:top-28">
          {content.sections.map((item, index) => <a key={item.title} href={'#section-' + index} className="service-link w-full">{item.title}</a>)}
        </nav>
        <div className="min-w-0 space-y-6">
          {content.sections.map((item, index) => <section id={'section-' + index} key={item.title} className="service-surface scroll-mt-28">
            <h2 className="service-heading mb-5 text-xl md:text-2xl">{item.title}</h2>
            <div className="service-prose">{item.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</div>
          </section>)}
          <aside className="service-surface space-y-3 border-primary/30 bg-primary/5">
            <h2 className="service-heading text-xl">{copy.contact}</h2>
            <p className="font-semibold">{SITE_INFO.operator}</p>
            <a href={'mailto:' + SITE_INFO.supportEmail} className="service-link -ml-3 break-all text-primary"><Mail className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />{SITE_INFO.supportEmail}</a>
            {section === 'community' && <p><Link className="service-link -ml-3" href="/moderation">{copy.moderation}</Link></p>}
          </aside>
        </div>
      </div>
      <Link className="service-link gap-2" href="/"><ArrowLeft className="h-4 w-4" aria-hidden="true" />{copy.back}</Link>
    </main>
  </>;
}

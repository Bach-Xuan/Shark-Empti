'use client';
import Link from 'next/link';
import { ArrowRight, BookOpen, Layers, Target } from 'lucide-react';
import { publicMessages } from '@/lib/i18n/public';
import { useAppPreferences } from './app-preferences';
import { PublicHeader } from './public-header';

export function PublicIntro() {
  const { lang } = useAppPreferences();
  const copy = publicMessages[lang];
  const features = lang === 'vi'
    ? [{ icon: BookOpen, title: 'Hiểu câu trả lời', text: 'Học qua câu hỏi và giải thích có bối cảnh.' }, { icon: Target, title: 'Luyện có trọng tâm', text: 'Quay lại khái niệm cần củng cố theo nhịp của bạn.' }, { icon: Layers, title: 'Thấy bước tiến', text: 'Kết nối lịch sử học, thẻ ghi nhớ và lộ trình.' }]
    : [{ icon: BookOpen, title: 'Understand your answers', text: 'Learn through questions and explanations with context.' }, { icon: Target, title: 'Practise with purpose', text: 'Revisit concepts that need work, at your own pace.' }, { icon: Layers, title: 'See your next step', text: 'Connect learning records, flashcards and a roadmap.' }];
  return <>
    <PublicHeader />
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-12 md:px-8 md:py-20">
      <section className="service-surface bg-primary/5 py-10 md:py-16">
        <p className="mb-5 text-xs font-bold uppercase tracking-[0.2em] text-primary">{copy.eyebrow}</p>
        <h1 className="service-heading max-w-3xl text-4xl leading-tight md:text-6xl">{copy.title}</h1>
        <p className="service-prose mt-6 max-w-2xl">{copy.intro}</p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link className="btn-duo inline-flex min-h-12 items-center gap-3 rounded-2xl border-primary bg-primary px-6 py-3 font-headline font-bold text-primary-foreground" href="/login">{copy.start}<ArrowRight className="h-5 w-5" aria-hidden="true" /></Link>
          <Link className="service-link border-2 border-border bg-card px-5" href="/about">{copy.explore}</Link>
        </div>
      </section>
      <div className="grid gap-5 md:grid-cols-3">{features.map(({ icon: Icon, title, text }) => <section className="service-surface" key={title}><Icon className="mb-5 h-7 w-7 text-primary" aria-hidden="true" /><h2 className="service-heading text-xl">{title}</h2><p className="mt-3 leading-7 text-muted-foreground">{text}</p></section>)}</div>
      <p role="note" className="max-w-3xl text-sm leading-6 text-muted-foreground">{copy.limits}</p>
    </main>
  </>;
}

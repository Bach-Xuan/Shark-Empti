'use client';
import React, { Component, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useOptionalAppPreferences } from './app-preferences';
import { errorMessages } from '@/lib/i18n/errors';
export function ErrorFallback({ reset }: { reset: () => void }) {
  const preferences = useOptionalAppPreferences();
  const [fallbackLanguage, setFallbackLanguage] = useState<'en' | 'vi'>('en');
  useEffect(() => {
    let saved = document.documentElement.lang;
    try { saved = localStorage.getItem('shark_lang') || saved; } catch { /* Providers and storage are optional here. */ }
    const language = saved === 'vi' ? 'vi' : 'en';
    setFallbackLanguage(language);
    if (!preferences) document.documentElement.lang = language;
  }, [preferences]);
  const lang = preferences?.lang ?? fallbackLanguage;
  const t = errorMessages[lang];
  return <section role="alert" className="p-8 text-center space-y-4">
    <p>{t.render}</p>
    <button className="rounded border px-4 py-2" onClick={reset}>{t.retry}</button>
    <Link className="block underline" href="/">{t.home}</Link>
  </section>;
}
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <ErrorFallback reset={() => this.setState({ failed: false })} /> : this.props.children;
  }
}

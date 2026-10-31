
import { AppPreferencesProvider } from '@/components/app-preferences';
import { RouteProviders } from '@/components/route-providers';
import { SiteFooter } from '@/components/service-links';
import { cookies } from 'next/headers';
import { DEFAULT_PREFERENCES, PREFERENCE_COOKIE, parsePreferences } from '@/lib/preferences';
import { siteOrigin, indexPublicPages } from '@/lib/site-metadata';
import type { Metadata } from 'next';
import './globals.css';


export async function generateMetadata(): Promise<Metadata> {
  const lang = parsePreferences((await cookies()).get(PREFERENCE_COOKIE)?.value)?.lang ?? 'en';
  const description = lang === 'vi' ? 'Trắc nghiệm, luyện tập, flashcard và hồ sơ học tập với hỗ trợ AI. Phản hồi AI hỗ trợ học tập, không phải đánh giá đã được kiểm định.' : 'AI-assisted quizzes, practice, flashcards and personal learning records. AI feedback is study support, not a verified assessment.';
  return {
  metadataBase: siteOrigin(),
  title: { default: 'Shark Empti', template: '%s | Shark Empti' },
  description,
  alternates: { canonical: '/' },
  robots: { index: indexPublicPages(), follow: true },
  openGraph: { type: 'website', siteName: 'Shark Empti', title: 'Shark Empti', description, locale: lang === 'vi' ? 'vi_VN' : 'en_US', url: '/' },
  twitter: { card: 'summary_large_image' },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialPreferences = parsePreferences((await cookies()).get(PREFERENCE_COOKIE)?.value);
  const preferences = initialPreferences ?? DEFAULT_PREFERENCES;
  return (
    <html lang={preferences.lang} className={preferences.theme === 'dark' ? 'dark' : undefined} suppressHydrationWarning>
      <body className="font-body antialiased bg-background text-foreground">
        <AppPreferencesProvider initialPreferences={initialPreferences}>
          <div className="flex min-h-screen flex-col"><RouteProviders><div className="flex-1">{children}</div></RouteProviders><SiteFooter /></div>
        </AppPreferencesProvider>
      </body>
    </html>
  );
}

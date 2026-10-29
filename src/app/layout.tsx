
import { AppPreferencesProvider } from '@/components/app-preferences';
import { RouteProviders } from '@/components/route-providers';
import { siteOrigin, indexPublicPages } from '@/lib/site-metadata';
import type { Metadata } from 'next';
import './globals.css';


export const metadata: Metadata = {
  metadataBase: siteOrigin(),
  title: { default: 'Shark Empti', template: '%s | Shark Empti' },
  description: 'AI-assisted quizzes, practice, flashcards and personal learning records. AI feedback is study support, not a verified assessment.',
  alternates: { canonical: '/' },
  robots: { index: indexPublicPages(), follow: true },
  openGraph: { type: 'website', siteName: 'Shark Empti', title: 'Shark Empti', description: 'Quizzes, practice and personal learning support.', url: '/' },
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className="font-body antialiased bg-background text-foreground">
        <AppPreferencesProvider><RouteProviders>{children}</RouteProviders></AppPreferencesProvider>
      </body>
    </html>
  );
}

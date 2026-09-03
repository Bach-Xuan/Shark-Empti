
import FocusTrackerWidget from '@/components/FocusTrackerWidget';
import { AiModelWarmup } from '@/components/ai-model-warmup';
import { AppPreferencesProvider } from '@/components/app-preferences';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase';
import type { Metadata } from 'next';
import { Inter,Space_Grotesk } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin', 'vietnamese'], variable: '--font-inter' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin', 'vietnamese'], variable: '--font-space-grotesk' });

export const metadata: Metadata = {
  title: 'Shark Empti',
  description: 'AI-powered cognitive learning and quiz tracker with a Duolingo-inspired interface.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className={`${inter.variable} ${spaceGrotesk.variable} font-body antialiased bg-background text-foreground`}>
        <AppPreferencesProvider><FirebaseClientProvider>
          {children}
          <AiModelWarmup />
          <Toaster />
          <ErrorBoundary><FocusTrackerWidget /></ErrorBoundary>
        </FirebaseClientProvider></AppPreferencesProvider>
      </body>
    </html>
  );
}

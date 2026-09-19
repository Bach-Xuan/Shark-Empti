
import { AppPreferencesProvider } from '@/components/app-preferences';
import { ErrorBoundary } from '@/components/error-boundary';
import FocusTrackerWidget from '@/components/focus-tracker-widget';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase';
import type { Metadata } from 'next';
import './globals.css';


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
      <body className="font-body antialiased bg-background text-foreground">
        <AppPreferencesProvider><FirebaseClientProvider>
          {children}
          <Toaster />
          <ErrorBoundary><FocusTrackerWidget /></ErrorBoundary>
        </FirebaseClientProvider></AppPreferencesProvider>
      </body>
    </html>
  );
}

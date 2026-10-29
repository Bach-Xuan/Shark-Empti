import 'server-only';
import type { Metadata } from 'next';

export function siteOrigin() {
  const url = new URL(process.env.SITE_URL || 'https://shark-empti.vercel.app');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('SITE_URL must be a credential-free HTTP(S) origin.');
  return url;
}

export const privateMetadata: Metadata = {
  robots: { index: false, follow: false }, alternates: { canonical: null },
};

export const indexPublicPages = () => process.env.NEXT_PUBLIC_USE_EMULATORS !== 'true' && process.env.VERCEL_ENV !== 'preview';

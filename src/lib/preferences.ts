import type { Language } from './types';

export type Theme = 'light' | 'dark';
export type StoredPreferences = { lang: Language; theme: Theme };
export const PREFERENCE_COOKIE = 'shark_preferences';
export const DEFAULT_PREFERENCES: StoredPreferences = { lang: 'en', theme: 'light' };

export function parsePreferences(value: string | undefined | null): StoredPreferences | null {
  if (!value) return null;
  const parts = value.split('.');
  const [version, lang, theme] = parts;
  return parts.length === 3 && version === 'v1' && (lang === 'en' || lang === 'vi') && (theme === 'light' || theme === 'dark')
    ? { lang, theme } : null;
}

export function preferenceCookie(value: StoredPreferences, secure: boolean): string {
  return `${PREFERENCE_COOKIE}=v1.${value.lang}.${value.theme}; Path=/; Max-Age=31536000; SameSite=Lax${secure ? '; Secure' : ''}`;
}

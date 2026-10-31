'use client';
import type { Language } from '@/lib/types';
import { DEFAULT_PREFERENCES, PREFERENCE_COOKIE, parsePreferences, preferenceCookie, type StoredPreferences, type Theme } from '@/lib/preferences';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';

type Preferences = StoredPreferences & { setLang: (lang: Language) => void; setTheme: (theme: Theme) => void };
const PreferencesContext = createContext<Preferences | null>(null);
const subscribeHydration = () => () => {};
export const useHydrated = () => useSyncExternalStore(subscribeHydration, () => true, () => false);

/** One essential cookie gives SSR and hydration the same locale and theme. */
export function AppPreferencesProvider({ children, initialPreferences = null }: { children: ReactNode; initialPreferences?: StoredPreferences | null }) {
  const [preferences, setPreferences] = useState(initialPreferences ?? DEFAULT_PREFERENCES);
  const current = useRef(preferences);
  const apply = useCallback((next: StoredPreferences) => {
    current.current = next;
    setPreferences(next);
    document.documentElement.lang = next.lang;
    document.documentElement.classList.toggle('dark', next.theme === 'dark');
    try { document.cookie = preferenceCookie(next, location.protocol === 'https:'); } catch { /* In-memory preferences still work. */ }
    try {
      localStorage.setItem('shark_lang', next.lang);
      localStorage.setItem('shark_theme', next.theme);
    } catch { /* Storage may be disabled. */ }
  }, []);
  const setLang = useCallback((lang: Language) => {
    if (lang === 'en' || lang === 'vi') apply({ ...current.current, lang });
  }, [apply]);
  const setTheme = useCallback((theme: Theme) => {
    if (theme === 'light' || theme === 'dark') apply({ ...current.current, theme });
  }, [apply]);

  useEffect(() => {
    const legacy = (): StoredPreferences => {
      try {
        const lang = localStorage.getItem('shark_lang');
        const theme = localStorage.getItem('shark_theme');
        return {
          lang: lang === 'vi' ? 'vi' : lang === 'en' ? 'en' : current.current.lang,
          theme: theme === 'dark' ? 'dark' : theme === 'light' ? 'light'
            : initialPreferences?.theme ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
        };
      } catch { return current.current; }
    };
    const cookie = document.cookie.split('; ').find(value => value.startsWith(PREFERENCE_COOKIE + '='))?.split('=')[1];
    apply(initialPreferences ?? parsePreferences(cookie) ?? legacy());
    const sync = (event: StorageEvent) => {
      if (event.key === null || ['shark_lang', 'shark_theme'].includes(event.key)) apply(legacy());
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [apply, initialPreferences]);

  const value = useMemo(() => ({ ...preferences, setLang, setTheme }), [preferences, setLang, setTheme]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}
export function useAppPreferences() {
  const preferences = useContext(PreferencesContext);
  if (!preferences) throw new Error('AppPreferencesProvider is required');
  return preferences;
}
export const useOptionalAppPreferences = () => useContext(PreferencesContext);
export function useLanguageState() { const { lang, setLang } = useAppPreferences(); return [lang, setLang] as const; }
export function useThemeState() { const { theme, setTheme } = useAppPreferences(); return [theme, setTheme] as const; }

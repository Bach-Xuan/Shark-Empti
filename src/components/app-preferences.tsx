'use client';
import type { Language } from '@/lib/types';
import { createContext,useCallback,useContext,useEffect,useMemo,useState,useSyncExternalStore,type ReactNode } from 'react';
type Theme = 'light' | 'dark';
type Preferences = { lang: Language; theme: Theme; setLang: (lang: Language) => void; setTheme: (theme: Theme) => void };
const PreferencesContext = createContext<Preferences | null>(null);
const subscribeHydration = () => () => {};
export const useHydrated = () => useSyncExternalStore(subscribeHydration, () => true, () => false);
export function AppPreferencesProvider({ children }: { children: ReactNode }) {
  const [lang, updateLang] = useState<Language>('en');
  const [theme, updateTheme] = useState<Theme>('light');
  const setLang = useCallback((value: Language) => {
    if (value !== 'en' && value !== 'vi') return;
    updateLang(value);
    document.documentElement.lang = value;
    try { localStorage.setItem('shark_lang', value); } catch { /* Storage is optional. */ }
  }, []);
  const setTheme = useCallback((value: Theme) => {
    if (value !== 'light' && value !== 'dark') return;
    updateTheme(value);
    document.documentElement.classList.toggle('dark', value === 'dark');
    try { localStorage.setItem('shark_theme', value); } catch { /* Keep in-memory preferences. */ }
  }, []);
  useEffect(() => {
    const sync = () => {
      try {
        const language = localStorage.getItem('shark_lang');
        const savedTheme = localStorage.getItem('shark_theme');
        setLang(language === 'vi' ? 'vi' : 'en');
        setTheme(savedTheme === 'dark' || (savedTheme === null && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light');
      } catch { /* Defaults work without localStorage. */ }
    };
    sync();
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [setLang, setTheme]);
  const value = useMemo(() => ({ lang, theme, setLang, setTheme }), [lang, theme, setLang, setTheme]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}
export function useAppPreferences() {
  const preferences = useContext(PreferencesContext);
  if (!preferences) throw new Error('AppPreferencesProvider is required');
  return preferences;
}
export const useOptionalAppPreferences = () => useContext(PreferencesContext);
export function useLanguageState() {
  const { lang, setLang } = useAppPreferences();
  return [lang, setLang] as const;
}
export function useThemeState() {
  const { theme, setTheme } = useAppPreferences();
  return [theme, setTheme] as const;
}

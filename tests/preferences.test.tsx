import { AppPreferencesProvider,useAppPreferences } from '@/components/app-preferences';
import { cleanup,fireEvent,render,screen } from '@testing-library/react';
import { afterEach,expect,it } from 'vitest';
afterEach(() => { cleanup(); localStorage.clear(); });
function Controls() {
  const { lang, setLang, theme, setTheme } = useAppPreferences();
  return <><span data-testid="language">{lang}</span><button onClick={() => setLang('vi')}>Vietnamese</button><button onClick={() => setTheme('dark')}>{theme}</button></>;
}
it('shares preference changes and persists document language and theme', () => {
  render(<AppPreferencesProvider><Controls /></AppPreferencesProvider>);
  fireEvent.click(screen.getByText('Vietnamese'));
  expect(document.documentElement.lang).toBe('vi');
  expect(localStorage.getItem('shark_lang')).toBe('vi');
  fireEvent.click(screen.getByText('light'));
  expect(document.documentElement.classList.contains('dark')).toBe(true);
});
it('ignores an invalid persisted language', () => {
  localStorage.setItem('shark_lang', 'invalid');
  render(<AppPreferencesProvider><Controls /></AppPreferencesProvider>);
  expect(screen.getByTestId('language').textContent).toBe('en');
});

'use client';
import { useOptionalAppPreferences } from './app-preferences';
import { common } from '@/lib/i18n/common';
export function UiText({ id }: { id: keyof typeof common.en }) {
  const preferences = useOptionalAppPreferences();
  return common[preferences?.lang ?? 'en'][id];
}

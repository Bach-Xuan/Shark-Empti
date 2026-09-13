'use client';
import { common } from '@/lib/i18n/common';
import { useOptionalAppPreferences } from './app-preferences';
export function UiText({ id }: { id: keyof typeof common.en }) {
  const preferences = useOptionalAppPreferences();
  return common[preferences?.lang ?? 'en'][id];
}

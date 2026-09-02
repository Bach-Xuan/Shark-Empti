'use client';

import { toast } from '@/hooks/use-toast';
import { AppError, ErrorValue } from '@/lib/app-error';

type SupportedLanguage = 'en' | 'vi';

function formatValues(values: Record<string, ErrorValue>): string {
  const entries = Object.entries(values).filter(([, value]) => value !== '');
  return entries.length ? entries.map(([key, value]) => `${key}: ${value}`).join(' | ') : '';
}

export function showErrorToast(error: AppError, language: SupportedLanguage = 'en') {
  const prefix = language === 'vi' ? 'Mã lỗi' : 'Error code';
  toast({
    variant: 'destructive',
    title: `${prefix}: ${error.code}`,
    description: [error.message, formatValues(error.values)].filter(Boolean).join(' — '),
  });
}

export function showUnexpectedErrorToast(
  code: string,
  message: string,
  values: Record<string, ErrorValue> = {},
  language: SupportedLanguage = 'en'
) {
  showErrorToast({ code, message, values }, language);
}

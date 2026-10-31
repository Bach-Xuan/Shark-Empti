import { readTimeMillis } from './time';
/** Normalized application instant; null means absent or invalid stored metadata. */
export type StoredDate = number | null;
export function formatStoredDate(value: unknown, language: string, options: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }): string {
  try {
    const millis = readTimeMillis(value);
    return millis === null ? '...' : new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', options).format(millis);
  } catch { return '...'; }
}

export function formatForumDate(item: { createdAt: unknown; updatedAt?: unknown }, language: string, editedLabel: string): string {
 const formatted = formatStoredDate(item.createdAt, language);
 return readTimeMillis(item.updatedAt) !== null ? formatted + ' (' + editedLabel + ')' : formatted;
}

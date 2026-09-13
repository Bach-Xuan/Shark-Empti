export type StoredDate = Date | string | number | { toDate: () => Date } | null;
export function formatStoredDate(value: unknown, language: string, options: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }): string {
  try {
    const date = value instanceof Date ? value : typeof value === 'string' || typeof value === 'number' ? new Date(value) : value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function' ? value.toDate() : null;
    return date instanceof Date && Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', options).format(date) : '...';
  } catch { return '...'; }
}

export function formatForumDate(item: { createdAt: unknown; updatedAt?: unknown }, language: string, editedLabel: string): string {
 const formatted = formatStoredDate(item.createdAt, language);
 return item.updatedAt ? formatted + ' (' + editedLabel + ')' : formatted;
}

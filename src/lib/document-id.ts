/** Shared route/SDK guard; keep invalid paths out of Firestore constructors. */
export function isDocumentId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value !== '.' && value !== '..' && !value.includes('/') && value.length <= 128;
}

/** Application dates are UTC epoch milliseconds; Firestore owns Timestamp storage.
 * Accept legacy ISO values only at read/serialization boundaries. Numeric
 * inputs already represent milliseconds; never guess units or parse locale dates.
 */
export function readTimeMillis(value: unknown): number | null {
  try {
    let millis: number;
    if (typeof value === 'number') millis = value;
    else if (value instanceof Date) millis = value.getTime();
    else if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) {
      millis = Date.parse(value);
      // Date.parse otherwise normalizes impossible calendar days silently.
      const day = value.slice(0, 10);
      if (new Date(day).toISOString().slice(0, 10) !== day) return null;
    } else if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
      const date = value.toDate();
      if (!(date instanceof Date)) return null;
      millis = date.getTime();
    } else return null;
    return Number.isFinite(millis) && millis >= -62_135_596_800_000 && millis <= 253_402_300_799_999 ? millis : null;
  } catch { return null; }
}

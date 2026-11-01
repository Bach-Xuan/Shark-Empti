/** Activity records use real calendar days in the documented 1000–2999 range. */
export function isActivityDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^[12]\d{3}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

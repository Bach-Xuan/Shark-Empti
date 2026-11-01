/** Stable JSON object order; array order and normal JSON serialization remain significant. */
export function canonicalJson(value: unknown): string {
  const serialized = JSON.stringify(value, (_key, item: unknown) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
    return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
  });
  if (serialized === undefined) throw new TypeError('A JSON value is required.');
  return serialized;
}

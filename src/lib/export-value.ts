import 'server-only';
import { DocumentReference, GeoPoint, Timestamp } from 'firebase-admin/firestore';

/** Tagged JSON preserves non-JSON Firestore values; this is an export, not a
 * production backup/restore format or an assertion of a point-in-time snapshot. */
export function exportValue(value: unknown): unknown {
  if (value instanceof Timestamp) return { $type: 'timestamp', seconds: value.seconds, nanoseconds: value.nanoseconds };
  if (value instanceof Date) return { $type: 'date', value: value.toISOString() };
  if (value instanceof GeoPoint) return { $type: 'geoPoint', latitude: value.latitude, longitude: value.longitude };
  if (value instanceof DocumentReference) return { $type: 'reference', path: value.path };
  if (value instanceof Uint8Array) return { $type: 'bytes', base64: Buffer.from(value).toString('base64') };
  if (typeof value === 'number' && !Number.isFinite(value)) return { $type: 'number', value: String(value) };
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(exportValue);
  if (value && typeof value === 'object') {
    const entries = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, exportValue(item)]));
    return Object.hasOwn(entries, '$type') ? { $type: 'map', value: entries } : entries;
  }
  throw new Error('Unsupported account export value.');
}

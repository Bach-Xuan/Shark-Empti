import 'server-only';
import { z } from 'zod';
import type { DocumentReference, Firestore } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from './firebase-admin';
import { ApiError } from './server-api';
import { readLimitedJson } from './server-json';

/** Name-only, bounded kindless query; includes descendants of missing parents.
 * Uses the documented REST query instead of private SDK query constructors. */
export async function readDescendantPage(db: Firestore, root: DocumentReference, limit = 100): Promise<string[]> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || root.firestore !== db) throw new Error('Invalid descendant query.');
  const auth = getAdminAuth(), project = auth.app.options.projectId;
  if (!project || db !== getAdminDb() || db.databaseId !== '(default)') throw new ApiError('APP-CONFIG-MISSING', 503, 'Descendant inventory is not configured.');
  const emulator = process.env.FIRESTORE_EMULATOR_HOST;
  if (emulator && (!project.startsWith('demo-') || !/^(127\.0\.0\.1|localhost):\d+$/.test(emulator)
    || !/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIREBASE_AUTH_EMULATOR_HOST ?? ''))) {
    throw new ApiError('APP-CONFIG-MISSING', 503, 'Descendant inventory is not configured.');
  }
  const token = emulator ? 'owner' : (await auth.app.options.credential?.getAccessToken())?.access_token;
  if (!token) throw new ApiError('APP-CONFIG-MISSING', 503, 'Descendant inventory is not configured.');
  const resource = `projects/${project}/databases/(default)/documents/`;
  const parent = resource + root.path;
  const origin = emulator ? 'http://' + emulator : 'https://firestore.googleapis.com';
  const url = origin + '/v1/' + parent.split('/').map(encodeURIComponent).join('/') + ':runQuery';
  const signal = AbortSignal.timeout(10_000);
  const response = await fetch(url, { method: 'POST', signal, redirect: 'error', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: { from: [{ allDescendants: true }], select: { fields: [{ fieldPath: '__name__' }] },
      orderBy: [{ field: { fieldPath: '__name__' }, direction: 'ASCENDING' }], limit } }),
  });
  if (!response.ok) throw new ApiError('APP-UNAVAILABLE', 503, 'Descendant inventory is unavailable.');
  const request = new Request('https://inventory.invalid/body', { method: 'POST', body: response.body, signal, duplex: 'half' } as RequestInit);
  let payload: unknown;
  try { payload = await readLimitedJson(request, 1_000_000); }
  catch { throw new ApiError('APP-UNAVAILABLE', 503, 'Descendant inventory is unavailable.'); }
  const page = z.array(z.object({ document: z.object({ name: z.string().max(6000) }).optional() })).max(limit + 1).safeParse(payload);
  if (!page.success) throw new ApiError('APP-DATA-INVALID', 502, 'Descendant inventory is invalid.');
  const names = page.data.flatMap(row => row.document ? [row.document.name] : []);
  if (names.length > limit || new Set(names).size !== names.length) throw new ApiError('APP-DATA-INVALID', 502, 'Descendant inventory is invalid.');
  return names.map(name => {
    if (!name.startsWith(parent + '/')) throw new ApiError('APP-DATA-INVALID', 502, 'Descendant inventory is invalid.');
    const path = name.slice(resource.length);
    const segments = path.split('/');
    if (segments.length % 2 !== 0 || segments.some(segment => !segment || segment === '.' || segment === '..' || Buffer.byteLength(segment) > 1500)) {
      throw new ApiError('APP-DATA-INVALID', 502, 'Descendant inventory is invalid.');
    }
    return path;
  });
}

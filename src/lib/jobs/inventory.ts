import 'server-only';
import { z } from 'zod';
import { getAdminAuth } from '../firebase-admin';
import { ApiError } from '../server-api';
import { readLimitedJson } from '../server-json';
import { emulatorJobs } from './config';

/** Ordinary queries omit missing parents. showMissing preserves orphan traversal. */
export async function inventoryPage(collection: string, after: string | undefined, limit: number) {
  const project = getAdminAuth().app.options.projectId;
  if (!project) throw new ApiError('ACCOUNT-JOBS-UNAVAILABLE', 503, 'Inventory is not configured.');
  const resource = 'projects/' + project + '/databases/(default)/documents/';
  const emulator = process.env.FIRESTORE_EMULATOR_HOST;
  if (emulator && !emulatorJobs()) throw new ApiError('ACCOUNT-JOBS-UNAVAILABLE', 503, 'Inventory is not configured.');
  const origin = emulator ? 'http://' + emulator : 'https://firestore.googleapis.com';
  const url = new URL('/v1/' + resource + collection.split('/').map(encodeURIComponent).join('/'), origin);
  url.searchParams.set('showMissing', 'true'); url.searchParams.set('pageSize', String(limit));
  url.searchParams.set('mask.fieldPaths', '__name__');
  if (after) url.searchParams.set('pageToken', after);
  const token = emulator ? 'owner' : (await getAdminAuth().app.options.credential?.getAccessToken())?.access_token;
  if (!token) throw new ApiError('ACCOUNT-JOBS-UNAVAILABLE', 503, 'Inventory is not configured.');
  const signal = AbortSignal.timeout(10_000);
  const response = await fetch(url, { headers: { Authorization: 'Bearer ' + token }, signal });
  if (!response.ok) throw new ApiError(response.status === 429 ? 'ACCOUNT-JOBS-QUOTA' : 'ACCOUNT-INVENTORY-UNAVAILABLE', 503, 'Account inventory is unavailable.');
  const request = new Request('https://inventory.invalid/body', { method: 'POST', body: response.body, signal, duplex: 'half' } as RequestInit);
  const result = z.object({ documents: z.array(z.object({ name: z.string().max(6000) })).max(limit).default([]), nextPageToken: z.string().max(6000).optional() }).parse(await readLimitedJson(request, 1_000_000));
  const paths = result.documents.map(document => {
    if (!document.name.startsWith(resource + collection + '/')) throw new ApiError('APP-DATA-INVALID', 502, 'Inventory returned an invalid path.');
    const path = document.name.slice(resource.length);
    if (path.split('/').length !== collection.split('/').length + 1) throw new ApiError('APP-DATA-INVALID', 502, 'Inventory returned an invalid path.');
    return path;
  });
  return { paths, after: result.nextPageToken || undefined };
}

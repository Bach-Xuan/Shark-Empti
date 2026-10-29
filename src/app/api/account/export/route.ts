import { NextRequest, NextResponse } from 'next/server';
import { FieldPath } from 'firebase-admin/firestore';
import { z } from 'zod';
import { ACCOUNT_EXPORT_DATASETS } from '@/lib/account-data';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { ApiError, apiFailure, authenticatedUser } from '@/lib/server-api';
import { readLimitedJson } from '@/lib/server-json';
import { enforceRequestBudget } from '@/lib/request-budget';
import { requireDocumentId } from '@/lib/forum-deletion';
import { exportValue } from '@/lib/export-value';

export const runtime = 'nodejs';
const Input = z.object({ dataset: z.enum(ACCOUNT_EXPORT_DATASETS), cursor: z.string().max(128).optional() }).strict();
export async function POST(request: NextRequest) {
  try {
    const uid = await authenticatedUser(request);
    await enforceRequestBudget(uid, 'account-traffic');
    const { dataset, cursor } = Input.parse(await readLimitedJson(request, 4096));
    if (cursor) requireDocumentId(cursor);
    if (dataset === 'profile' && cursor) throw new ApiError('APP-INVALID-INPUT', 400, 'Profile export has no cursor.');
    await enforceRequestBudget(uid, 'account-export');
    const db = getAdminDb();
    const owner = db.collection('users').doc(uid);
    if (dataset === 'profile') {
      const [snapshot, auth] = await Promise.all([owner.get(), getAdminAuth().getUser(uid)]);
      return NextResponse.json({ dataset, uid, documents: snapshot.exists ? [{ path: snapshot.ref.path, data: exportValue(snapshot.data()) }] : [],
        identity: { uid, displayName: auth.displayName ?? null, email: auth.email ?? null, photoURL: auth.photoURL ?? null, providers: auth.providerData.map(provider => ({ providerId: provider.providerId, uid: provider.uid, email: provider.email ?? null })) }, nextCursor: null }, { headers: { 'Cache-Control': 'no-store' } });
    }
    let query = owner.collection(dataset).orderBy(FieldPath.documentId()).limit(11);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    const documents: { path: string; data: unknown }[] = [];
    let bytes = 0, last: string | null = null;
    for (const snapshot of page.docs.slice(0, 10)) {
      const item = { path: snapshot.ref.path, data: exportValue(snapshot.data()) };
      const size = Buffer.byteLength(JSON.stringify(item));
      if (bytes + size > 2_000_000) break;
      documents.push(item); bytes += size; last = snapshot.id;
    }
    if (!documents.length && page.size) throw new ApiError('APP-EXPORT-LIMIT', 413, 'Use a complete account export request for this dataset.');
    return NextResponse.json({ dataset, uid, documents, nextCursor: documents.length < page.size ? last : null }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiFailure(error); }
}

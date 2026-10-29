import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getAdminDb } from '@/lib/firebase-admin';
import { apiFailure, authenticatedUser, idempotentTransaction } from '@/lib/server-api';
import { readLimitedJson } from '@/lib/server-json';
import { enforceRequestBudget, prepareRequestBudget } from '@/lib/request-budget';

export const runtime = 'nodejs';
const Input = z.object({ kind: z.enum(['export', 'deletion']), requestId: z.string().uuid() }).strict();
const id = (uid: string, kind: string) => createHash('sha256').update(JSON.stringify([uid, kind])).digest('hex');
export async function GET(request: NextRequest) {
  try {
    const uid = await authenticatedUser(request);
    await enforceRequestBudget(uid, 'account-traffic');
    const db = getAdminDb();
    const requests = await Promise.all(['export', 'deletion'].map(async kind => {
      const row = await db.collection('_accountRequests').doc(id(uid, kind)).get();
      return row.exists ? { kind, status: row.get('status'), createdAt: row.get('createdAt')?.toDate?.().toISOString() ?? null } : null;
    }));
    return NextResponse.json({ requests: requests.filter(Boolean), automatedDeletion: false, operatorConfigured: false }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiFailure(error); }
}
export async function POST(request: NextRequest) {
  try {
    const uid = await authenticatedUser(request);
    await enforceRequestBudget(uid, 'account-traffic');
    const { kind, requestId } = Input.parse(await readLimitedJson(request, 4096));
    const result = await idempotentTransaction('account-request', uid, requestId, { kind }, async transaction => {
      const ref = getAdminDb().collection('_accountRequests').doc(id(uid, kind));
      const previous = await transaction.get(ref);
      const commitBudget = await prepareRequestBudget(transaction, uid, 'account-request');
      commitBudget();
      if (!previous.exists) transaction.create(ref, { uid, kind, status: 'pending-operator', createdAt: FieldValue.serverTimestamp() });
      return { kind, status: previous.get('status') ?? 'pending-operator', automatedDeletion: false, operatorConfigured: false };
    });
    return NextResponse.json(result, { status: 202 });
  } catch (error) { return apiFailure(error); }
}

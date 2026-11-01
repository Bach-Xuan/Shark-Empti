import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getAdminDb } from '@/lib/firebase-admin';
import { apiFailure, authenticatedUser } from '@/lib/server-api';
import { readLimitedJson } from '@/lib/server-json';
import { enforceRequestBudget, prepareRequestBudget } from '@/lib/request-budget';
import { currentServicePolicy, SERVICE_CONSENT_COLLECTION } from '@/lib/service-policy';
import { hasCurrentServiceConsent } from '@/lib/server-consent';

export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'no-store' };
const Confirmation = z.object({ policyVersion: z.literal(currentServicePolicy.policyVersion), minimumAge: z.literal(currentServicePolicy.minimumAge), accept: z.literal(true) }).strict();

export async function GET(request: Request) {
  try {
    const uid = await authenticatedUser(request, { allowUnconsented: true, allowLocked: true, allowMaintenance: true });
    await enforceRequestBudget(uid, 'account-traffic', { allowLocked: true, allowMaintenance: true });
    const snapshot = await getAdminDb().collection(SERVICE_CONSENT_COLLECTION).doc(uid).get();
    return NextResponse.json({ ...currentServicePolicy, accepted: hasCurrentServiceConsent(snapshot.data()) }, { headers });
  } catch (error) { return apiFailure(error); }
}

export async function POST(request: Request) {
  try {
    const uid = await authenticatedUser(request, { allowUnconsented: true });
    await enforceRequestBudget(uid, 'account-traffic');
    Confirmation.parse(await readLimitedJson(request, 4096));
    const db = getAdminDb(), ref = db.collection(SERVICE_CONSENT_COLLECTION).doc(uid);
    await db.runTransaction(async transaction => {
      const previous = await transaction.get(ref);
      const commitBudget = await prepareRequestBudget(transaction, uid, 'account-traffic');
      commitBudget();
      if (!hasCurrentServiceConsent(previous.data())) transaction.set(ref, { ...currentServicePolicy, acceptedAt: FieldValue.serverTimestamp() });
    });
    return NextResponse.json({ ...currentServicePolicy, accepted: true }, { headers });
  } catch (error) { return apiFailure(error); }
}

import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { currentServicePolicy, SERVICE_CONSENT_COLLECTION } from '@/lib/service-policy';

/** Trusted Emulator fixture for tests whose subject is unrelated to consent. */
export async function seedServiceConsent(...uids: string[]) {
  await Promise.all(uids.map(uid => getAdminDb().collection(SERVICE_CONSENT_COLLECTION).doc(uid).set({ ...currentServicePolicy, acceptedAt: Timestamp.now() })));
}

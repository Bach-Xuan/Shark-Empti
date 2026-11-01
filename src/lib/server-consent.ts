import 'server-only';
import { Timestamp } from 'firebase-admin/firestore';
import { currentServicePolicy } from './service-policy';

/** Only server-owned records with the same timestamp contract as Rules qualify. */
export function hasCurrentServiceConsent(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return record.policyVersion === currentServicePolicy.policyVersion && record.minimumAge === currentServicePolicy.minimumAge
    && record.acceptedAt instanceof Timestamp && record.acceptedAt.toMillis() > 0 && record.acceptedAt.toMillis() <= Date.now();
}

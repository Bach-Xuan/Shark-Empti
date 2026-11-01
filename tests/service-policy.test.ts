// @vitest-environment node
import { expect, it, vi } from 'vitest';
import { Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
import { currentServicePolicy } from '@/lib/service-policy';
import { hasCurrentServiceConsent } from '@/lib/server-consent';
vi.mock('server-only', () => ({}));

it('requires a current policy, eligibility and valid acknowledgement time', () => {
  const valid = { ...currentServicePolicy, acceptedAt: Timestamp.fromMillis(1) };
  expect(hasCurrentServiceConsent(valid)).toBe(true);
  for (const value of [null, {}, { ...valid, policyVersion: '1' }, { ...valid, minimumAge: '16' }, { ...valid, minimumAge: 15 },
    { ...valid, acceptedAt: undefined }, { ...valid, acceptedAt: new Date(1) }, { ...valid, acceptedAt: 1 },
    { ...valid, acceptedAt: Timestamp.fromMillis(0) }, { ...valid, acceptedAt: Timestamp.fromMillis(Date.now() + 60_000) }]) {
    expect(hasCurrentServiceConsent(value)).toBe(false);
  }
});
it('keeps Rules acknowledgement requirements synchronized with the active application policy', () => {
  const rules = readFileSync('firestore.rules', 'utf8');
  expect(rules).toContain(`consent.policyVersion == '${currentServicePolicy.policyVersion}'`);
  expect(rules).toContain(`consent.minimumAge == ${currentServicePolicy.minimumAge}`);
});

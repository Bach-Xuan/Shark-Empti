import { SITE_INFO } from './site-info';

export const SERVICE_CONSENT_COLLECTION = '_serviceConsents';
export const currentServicePolicy = { policyVersion: SITE_INFO.policyVersion, minimumAge: SITE_INFO.minimumAge } as const;


import type { FirestoreSettings } from 'firebase/firestore';

/** WebKit can buffer an open watch response without delivering its final frame.
 * Use close-after-data transport with a five-second maximum hanging GET, so
 * buffered completion frames settle within the reader's 15-second deadline.
 * https://github.com/firebase/firebase-js-sdk/issues/9789
 */
export function firestoreTransportSettings(userAgent: string): FirestoreSettings {
  const webkit = /AppleWebKit\//.test(userAgent) && !/(?:Chrome|Chromium|Edg|OPR)\//.test(userAgent);
  return webkit ? { experimentalForceLongPolling: true, experimentalAutoDetectLongPolling: false,
    experimentalLongPollingOptions: { timeoutSeconds: 5 } } : {};
}

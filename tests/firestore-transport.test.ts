import { expect, it } from 'vitest';
import { firestoreTransportSettings } from '@/firebase/firestore-transport';

it.each([
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Safari/605.1.15',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 26_5 like Mac OS X) AppleWebKit/605.1.15 CriOS/151.0 Mobile/15E148 Safari/604.1',
])('uses complete watch responses on WebKit, including iOS browser shells', userAgent => {
  expect(firestoreTransportSettings(userAgent)).toEqual({ experimentalForceLongPolling: true, experimentalAutoDetectLongPolling: false,
    experimentalLongPollingOptions: { timeoutSeconds: 5 } });
});
it.each([
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
  'Mozilla/5.0 Gecko/20100101 Firefox/153.0',
  '',
])('retains native defaults for Chromium, Gecko and server initialization', userAgent => {
  expect(firestoreTransportSettings(userAgent)).toEqual({});
});

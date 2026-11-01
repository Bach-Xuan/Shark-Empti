import { assertFirebaseConfig } from '../src/firebase/config';
import { validateAdminConfiguration } from '../src/lib/firebase-admin';

try {
  assertFirebaseConfig();
  validateAdminConfiguration();
  console.log('Firebase Web/Admin configuration structure passed; no network, credential authorization or deployed readiness was tested.');
} catch {
  console.error('Firebase configuration is incomplete or invalid. Check the six Web variables, three Admin variables, RSA PEM format and matching project IDs. No credentials were printed.');
  process.exitCode = 1;
}

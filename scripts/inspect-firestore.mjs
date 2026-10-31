import fs from 'node:fs';
import { GoogleAuth } from 'google-auth-library';
process.loadEnvFile('.env');
const project = process.env.FIREBASE_ADMIN_PROJECT_ID;
const auth = new GoogleAuth({ credentials: { client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL, private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n') }, scopes: ['https://www.googleapis.com/auth/datastore'] });
try {
  const client = await auth.getClient();
  const base = 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(project) + '/databases/(default)/collectionGroups/';
  const desired = JSON.parse(fs.readFileSync('firestore.indexes.json', 'utf8'));
  const groups = [...new Set(desired.indexes.map(index => index.collectionGroup))];
  const responses = await Promise.allSettled(groups.map(group => client.request({ url: base + encodeURIComponent(group) + '/indexes', method: 'GET', timeout: 10000 })));
  const indexGroups = Object.fromEntries(groups.map((group, index) => [group, responses[index].status === 'fulfilled'
    ? { status: 200, indexes: (responses[index].value.data.indexes ?? []).map(item => ({ state: item.state, queryScope: item.queryScope, fields: item.fields })) }
    : { status: responses[index].reason.response?.status ?? 'unavailable' }]));
  const fields = await Promise.allSettled(desired.fieldOverrides.map(field => client.request({ url: base + encodeURIComponent(field.collectionGroup) + '/fields/' + encodeURIComponent(field.fieldPath), method: 'GET', timeout: 10000 })));
  const expiryFields = desired.fieldOverrides.map((field, index) => ({ collectionGroup: field.collectionGroup, fieldPath: field.fieldPath,
    expectedIndexes: field.indexes, expectedNativeTtl: false,
    ...(fields[index].status === 'fulfilled' ? { status: 200, indexConfig: fields[index].value.data.indexConfig ?? null, nativeTtl: fields[index].value.data.ttlConfig ?? null }
      : { status: fields[index].reason.response?.status ?? 'unavailable' }) }));
  const report = { measuredAt: new Date().toISOString(), scope: 'Read-only deployed composite and ordinary field-index metadata; Spark design requests no native TTL.', indexGroups, expiryFields };
  fs.mkdirSync('reports', { recursive: true });
  fs.writeFileSync('reports/firestore-metadata.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  if (responses.some(result => result.status === 'rejected') || fields.some(result => result.status === 'rejected')) process.exitCode = 1;
} catch (error) {
  console.error('Read-only Firestore inspection failed; HTTP status: ' + (error.response?.status ?? 'unavailable'));
  process.exitCode = 1;
}

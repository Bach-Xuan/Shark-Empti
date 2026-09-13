import fs from 'node:fs';
import { GoogleAuth } from 'google-auth-library';
process.loadEnvFile('.env');
const project = process.env.FIREBASE_ADMIN_PROJECT_ID;
const auth = new GoogleAuth({ credentials: { client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL, private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g,'\n') }, scopes:['https://www.googleapis.com/auth/datastore'] });
try {
 const client = await auth.getClient();
 const base = 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(project) + '/databases/(default)/collectionGroups/';
 const indexes = await client.request({ url:base+'posts/indexes', method:'GET' });
 const field = await client.request({ url:base+'_requestReceipts/fields/expiresAt', method:'GET' });
 const report={ measuredAt:new Date().toISOString(), scope:'read-only deployed index and TTL metadata', indexes:(indexes.data.indexes||[]).map(index=>({state:index.state,queryScope:index.queryScope,fields:index.fields})), receiptTtl:field.data.ttlConfig ?? null };
 fs.mkdirSync('reports',{recursive:true});fs.writeFileSync('reports/firestore-metadata.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
} catch (error) { console.error('Read-only Firestore inspection failed; HTTP status: '+(error.response?.status ?? 'unavailable')); process.exitCode=1; }

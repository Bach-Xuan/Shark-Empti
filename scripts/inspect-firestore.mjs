import fs from 'node:fs';
import { GoogleAuth } from 'google-auth-library';
process.loadEnvFile('.env');
const project = process.env.FIREBASE_ADMIN_PROJECT_ID;
const auth = new GoogleAuth({ credentials: { client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL, private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g,'\n') }, scopes:['https://www.googleapis.com/auth/datastore'] });
try {
 const client = await auth.getClient();
 const base = 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(project) + '/databases/(default)/collectionGroups/';
 const desired = JSON.parse(fs.readFileSync('firestore.indexes.json', 'utf8'));
 const indexCollections = [...new Set(desired.indexes.map(index => index.collectionGroup))];
 const indexResponses = await Promise.all(indexCollections.map(collection => client.request({ url:base+encodeURIComponent(collection)+'/indexes', method:'GET', timeout:10000 })));
 const indexGroups = Object.fromEntries(indexCollections.map((collection,index) => [collection, (indexResponses[index].data.indexes || []).map(item => ({ state:item.state, queryScope:item.queryScope, fields:item.fields }))]));
 const ttlCollections = desired.fieldOverrides.filter(field => field.ttl && field.fieldPath === 'expiresAt').map(field => field.collectionGroup);
 const ttlResponses=await Promise.all(ttlCollections.map(collection=>client.request({ url:base+encodeURIComponent(collection)+'/fields/expiresAt', method:'GET', timeout:10000 })));
 const ttl=Object.fromEntries(ttlCollections.map((collection,index)=>[collection,ttlResponses[index].data.ttlConfig ?? null]));
 const report={ measuredAt:new Date().toISOString(), scope:'read-only deployed metadata for every declared index group and expiry TTL', indexGroups, indexes:indexGroups.posts ?? [], arenaIndexes:indexGroups.attempts ?? [], ttl };
 fs.mkdirSync('reports',{recursive:true});fs.writeFileSync('reports/firestore-metadata.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
} catch (error) { console.error('Read-only Firestore inspection failed; HTTP status: '+(error.response?.status ?? 'unavailable')); process.exitCode=1; }

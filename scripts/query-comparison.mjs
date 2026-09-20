import fs from 'node:fs';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host || !/^(127\.0\.0\.1|localhost):\d+$/.test(host)) throw new Error('A local Firestore Emulator is required');
const app = initializeApp({ projectId: 'demo-shark-empti' }, 'query-comparison');
const db = getFirestore(app);
const collection = db.collection('_performanceComparison');
const rows = [];
try {
  await db.recursiveDelete(collection);
  let inserted = 0;
  for (const records of [100, 1000, 10000]) {
    while (inserted < records) {
      const batch = db.batch();
      for (let n = 0; n < 400 && inserted < records; n++, inserted++) batch.set(collection.doc(String(inserted).padStart(5, '0')), { ordinal: inserted, content: 'Controlled comparison fixture' });
      await batch.commit();
    }
    const measure = async query => {
      const start = performance.now(), result = await query.get();
      return { returnedDocuments: result.size, serializedBytes: Buffer.byteLength(JSON.stringify(result.docs.map(doc => doc.data()))), elapsedMs: performance.now() - start };
    };
    const samples = [];
    for (let i = 0; i < 5; i++) {
      // Alternate execution order to reduce cache/order bias.
      const all = collection.orderBy('ordinal'), limited = all.limit(50);
      if (i % 2) { const bounded = await measure(limited); samples.push({ bounded, unbounded: await measure(all) }); }
      else { const unbounded = await measure(all); samples.push({ unbounded, bounded: await measure(limited) }); }
    }
    if (samples.some(s => s.unbounded.returnedDocuments !== records || s.bounded.returnedDocuments !== 50)) throw new Error('Unexpected query cardinality');
    rows.push({ records, samples });
  }
  fs.mkdirSync('reports', { recursive: true });
  fs.writeFileSync('reports/query-comparison.json', JSON.stringify({ measuredAt: new Date().toISOString(), node: process.version, scope: 'Admin SDK queries against the local demo Emulator; serialized document data, not wire bytes, billed reads or browser subscriptions', rows }, null, 2));
  console.log('Query comparison passed at 100, 1000 and 10000 documents; five alternating pairs per scale.');
} finally { await db.recursiveDelete(collection); await deleteApp(app); }

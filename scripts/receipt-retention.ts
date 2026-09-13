import { getAdminDb } from '../src/lib/firebase-admin';
import { receiptExpiry } from '../src/lib/receipt-retention';
import { FieldPath } from 'firebase-admin/firestore';
// Read-only by default. --apply backfills expiresAt, never deletes receipts directly.
async function main() {
const apply = process.argv.includes('--apply');
const db = getAdminDb();
let cursor: string | undefined, scanned = 0, missing = 0, invalid = 0, expired = 0;
for (;;) {
 let query = db.collection('_requestReceipts').select('createdAt', 'expiresAt').orderBy(FieldPath.documentId()).limit(250);
 if (cursor) query = query.startAfter(cursor);
 const page = await query.get(); if (page.empty) break;
 for (const doc of page.docs) {
  scanned++;
  if (doc.get('expiresAt')) continue;
  missing++;
  const created = doc.get('createdAt')?.toDate?.();
  if (!(created instanceof Date) || !Number.isFinite(created.getTime())) { invalid++; continue; }
  if (receiptExpiry(created).getTime() < Date.now()) expired++;
  if (apply) await db.runTransaction(async transaction => {
    const fresh = await transaction.get(doc.ref);
    if (fresh.exists && !fresh.get('expiresAt')) transaction.update(doc.ref, { expiresAt: receiptExpiry(created) });
  });
 }
 cursor = page.docs.at(-1)!.id;
}
console.log(JSON.stringify({ mode: apply ? 'backfill' : 'read-only', scanned, missing, invalid, alreadyExpired: expired }));

}
void main().catch(() => { console.error("Receipt metadata inspection/backfill failed; no report claimed."); process.exitCode = 1; });

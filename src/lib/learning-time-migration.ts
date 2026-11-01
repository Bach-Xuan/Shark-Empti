import 'server-only';
import { FieldPath, Timestamp, type DocumentReference, type Firestore } from 'firebase-admin/firestore';
import { readTimeMillis } from './time';

const PAGE_SIZE = 100;
const BATCH_SIZE = 20;
type Candidate = { ref: DocumentReference; owner: string };

/** One bounded transaction shares barrier/owner reads and rechecks every candidate. */
async function convertBatch(db: Firestore, candidates: Candidate[], field: string) {
  const owners = [...new Set(candidates.map(row => row.owner))];
  return db.runTransaction(async transaction => {
    const snapshots = await transaction.getAll(...candidates.map(row => row.ref),
      ...owners.map(owner => db.doc('_accountLocks/' + owner)), db.doc('_serviceState/maintenance'));
    const locks = new Map(owners.map((owner, index) => [owner, snapshots[candidates.length + index]]));
    const maintenance = snapshots.at(-1)!;
    const updates: Array<{ ref: DocumentReference; millis: number }> = [];
    for (let index = 0; index < candidates.length; index++) {
      const fresh = snapshots[index];
      if (!fresh.exists || fresh.get(field) instanceof Timestamp) continue;
      const millis = readTimeMillis(fresh.get(field));
      if (millis === null) continue;
      if (locks.get(candidates[index].owner)!.exists || (maintenance.get('active') === true && maintenance.get('expiresAtMs') > Date.now())) {
        throw new Error('Migration cannot run during deletion or a backup write barrier.');
      }
      updates.push({ ref: fresh.ref, millis });
    }
    for (const update of updates) transaction.update(update.ref, { [field]: Timestamp.fromMillis(update.millis) });
    return updates.length;
  });
}

/** Bounded, repeatable conversion of the three former ISO-writing collections.
 * Group queries include descendants whose user profile document is missing.
 * Exact paths prevent matching another collection with the same group name.
 */
export async function migrateLearningTimes(db: Firestore, apply = false) {
  const result = { scanned: 0, canonical: 0, convertible: 0, invalid: 0, converted: 0 };
  for (const [group, field] of [['history', 'date'], ['flashcards', 'createdAt'], ['practice', 'createdAt']] as const) {
    let cursor: string | undefined;
    for (;;) {
      let source = db.collectionGroup(group).orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
      if (cursor) source = source.startAfter(db.doc(cursor));
      const page = await source.get();
      if (page.empty) break;
      const candidates: Candidate[] = [];
      for (const row of page.docs) {
        const segments = row.ref.path.split('/');
        if (segments.length !== 4 || segments[0] !== 'users' || segments[2] !== group) continue;
        result.scanned++;
        const value: unknown = row.get(field);
        if (value instanceof Timestamp) { result.canonical++; continue; }
        if (readTimeMillis(value) === null) { result.invalid++; continue; }
        result.convertible++;
        if (apply) candidates.push({ ref: row.ref, owner: segments[1] });
      }
      for (let index = 0; index < candidates.length; index += BATCH_SIZE) {
        result.converted += await convertBatch(db, candidates.slice(index, index + BATCH_SIZE), field);
      }
      cursor = page.docs.at(-1)!.ref.path;
    }
  }
  return result;
}

import 'server-only';
import { FieldPath, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { readTimeMillis } from './time';

/** Bounded, repeatable conversion of the three former ISO-writing collections.
 * Group queries include descendants whose user profile document is missing.
 * Exact paths prevent matching another collection with the same group name.
 */
export async function migrateLearningTimes(db: Firestore, apply = false) {
  const result = { scanned: 0, canonical: 0, convertible: 0, invalid: 0, converted: 0 };
  for (const [group, field] of [['history', 'date'], ['flashcards', 'createdAt'], ['practice', 'createdAt']] as const) {
    let cursor: string | undefined;
    for (;;) {
      let source = db.collectionGroup(group).orderBy(FieldPath.documentId()).limit(100);
      if (cursor) source = source.startAfter(db.doc(cursor));
      const page = await source.get();
      if (page.empty) break;
      for (const row of page.docs) {
        const segments = row.ref.path.split('/');
        if (segments.length !== 4 || segments[0] !== 'users' || segments[2] !== group) continue;
        result.scanned++;
        const value: unknown = row.get(field);
        if (value instanceof Timestamp) { result.canonical++; continue; }
        if (readTimeMillis(value) === null) { result.invalid++; continue; }
        result.convertible++;
        if (!apply) continue;
        const changed = await db.runTransaction(async transaction => {
          const [fresh, lock, maintenance] = await Promise.all([
            transaction.get(row.ref), transaction.get(db.doc('_accountLocks/' + segments[1])),
            transaction.get(db.doc('_serviceState/maintenance')),
          ]);
          if (!fresh.exists || fresh.get(field) instanceof Timestamp) return false;
          if (lock.exists || (maintenance.get('active') === true && maintenance.get('expiresAtMs') > Date.now())) {
            throw new Error('Migration cannot run during deletion or a backup write barrier.');
          }
          const millis = readTimeMillis(fresh.get(field));
          if (millis === null) return false;
          transaction.update(row.ref, { [field]: Timestamp.fromMillis(millis) });
          return true;
        });
        if (changed) result.converted++;
      }
      cursor = page.docs.at(-1)!.ref.path;
    }
  }
  return result;
}

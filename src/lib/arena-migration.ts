import 'server-only';
import type { Firestore } from 'firebase-admin/firestore';
import { FieldPath, FieldValue } from 'firebase-admin/firestore';
import { readArenaExam } from './public-firestore-schema';
import { isTrustedArenaExam } from './arena-scoring';

/** Read-only unless explicitly requested by an operator. Never upgrades exposed
 * legacy answers into a newly rewarded/ranked competition. Each document and
 * its backup/key are switched atomically; an interrupted run can be repeated. */
export async function migrateLegacyArena(db: Firestore, apply = false) {
  const result = { scanned: 0, current: 0, eligible: 0, blocked: 0, migrated: 0 };
  let cursor: string | undefined;
  for (;;) {
    let query = db.collection('arenaExams').orderBy(FieldPath.documentId()).limit(100);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    if (page.empty) break;
    for (const row of page.docs) {
      result.scanned++;
      if (row.get('schemaVersion') === 2) { result.current++; continue; }
      const parsed = readArenaExam(row.id, row.data());
      if (!parsed || !isTrustedArenaExam(parsed.questions) || Buffer.byteLength(JSON.stringify(row.data())) > 800_000) { result.blocked++; continue; }
      result.eligible++;
      if (!apply) continue;
      const migrated = await db.runTransaction(async transaction => {
        const keys = db.collection('_arenaAnswerKeys').doc(row.id);
        const backup = db.collection('_arenaLegacyBackups').doc(row.id);
        const [fresh, key, previous] = await Promise.all([transaction.get(row.ref), transaction.get(keys), transaction.get(backup)]);
        if (!fresh.exists || fresh.get('schemaVersion') === 2) return false;
        if (key.exists || previous.exists) throw new Error('Conflicting Arena migration state; operator review required.');
        const exam = readArenaExam(row.id, fresh.data());
        if (!exam || !isTrustedArenaExam(exam.questions) || Buffer.byteLength(JSON.stringify(fresh.data())) > 800_000) throw new Error('Arena record changed during migration; inspect again.');
        const { id: _id, questions, ...metadata } = exam;
        transaction.create(backup, { snapshot: fresh.data(), backedUpAt: FieldValue.serverTimestamp() });
        transaction.create(keys, { schemaVersion: 2, authorId: exam.authorId, questions, createdAt: FieldValue.serverTimestamp() });
        transaction.set(row.ref, { ...metadata, schemaVersion: 2, questionCount: questions.length, practiceOnly: true, firstRewardClaimed: true });
        return true;
      });
      if (migrated) result.migrated++;
    }
    cursor = page.docs.at(-1)!.id;
  }
  return result;
}

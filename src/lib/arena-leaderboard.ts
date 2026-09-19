import { collection, documentId, limit, orderBy, query, where, type Firestore } from 'firebase/firestore';

export function arenaLeaderboardQuery(db: Firestore, examId: string) {
  return query(collection(db, 'arenaExams', examId, 'attempts'),
    where('timingVersion', '==', 1), orderBy('score', 'desc'),
    orderBy('duration', 'asc'), orderBy(documentId(), 'asc'), limit(10));
}

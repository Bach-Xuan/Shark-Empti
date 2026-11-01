import { collection, documentId, limit, orderBy, query, where, type Firestore } from 'firebase/firestore';
import { ARENA_RANKINGS_COLLECTION, COMMUNITY_PRIVACY_VERSION } from './community-privacy';

export function arenaLeaderboardQuery(db: Firestore, examId: string) {
  return query(collection(db, 'arenaExams', examId, ARENA_RANKINGS_COLLECTION),
    where('privacyVersion', '==', COMMUNITY_PRIVACY_VERSION),
    where('rankingVersion', '==', 2), where('timingVersion', '==', 1), orderBy('score', 'desc'),
    orderBy('duration', 'asc'), orderBy(documentId(), 'asc'), limit(10));
}

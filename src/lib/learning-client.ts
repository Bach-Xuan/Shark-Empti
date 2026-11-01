'use client';
import type { User } from 'firebase/auth';
import type { LearningKind } from './learning-records';
import { communityRequest } from './forum-client';

/** One bounded recovery retry reuses an immutable body and record ID. */
async function save(user: Pick<User, 'getIdToken'>, kind: LearningKind, recordId: string, data: unknown, method: 'PUT' | 'PATCH', signal?: AbortSignal) {
  const snapshot = JSON.parse(JSON.stringify(data));
  const path = `/api/learning/${kind}/${encodeURIComponent(recordId)}`;
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await communityRequest(user, path, snapshot, method, signal);
      if (!('recordId' in response) || response.recordId !== recordId) throw { code: 'APP-DATA-INVALID', values: {} };
      return;
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : '';
      if (attempt || signal?.aborted || !(error instanceof TypeError || ['APP-UNAVAILABLE', 'APP-REQUEST-FAILED'].includes(String(code)))) throw error;
    }
  }
}
export function writeLearningRecord(user: Pick<User, 'getIdToken'>, kind: LearningKind, recordId: string, data: unknown, signal?: AbortSignal) {
  return save(user, kind, recordId, data, 'PUT', signal);
}
export function saveHistoryFeedback(user: Pick<User, 'getIdToken'>, recordId: string, data: unknown, signal?: AbortSignal) {
  return save(user, 'history', recordId, data, 'PATCH', signal);
}

import { createHash } from 'node:crypto';
import 'server-only';

export const ARENA_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
export function arenaFingerprint(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
export function arenaSessionId(uid: string, examId: string, requestId: string) {
  return arenaFingerprint([uid, examId, requestId]);
}

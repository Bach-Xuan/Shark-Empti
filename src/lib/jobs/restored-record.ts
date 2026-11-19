import 'server-only';
import { Timestamp, type DocumentData } from 'firebase-admin/firestore';
import { SERVICE_CONSENT_COLLECTION } from '../service-policy';
import { readTimeMillis } from '../time';
import { anonymizeContributions, isCommunityRecordPath, OWNED_RECORDS } from './catalog';
import { digest } from './crypto';

/** Apply identical erasure rules to an archive row and to a row already on an isolated target. */
export function retainedRecord(path: string, data: DocumentData, deleted: Set<string>, budgets: Set<string>, operationId: string) {
  const parts = path.split('/'), [root, id] = parts;
  if ((['users', SERVICE_CONSENT_COLLECTION].includes(root) && deleted.has(id)) || budgets.has(path)
    || (root === '_aiQuota' && id.startsWith('user_') && deleted.has(id.slice(5)))) return null;
  for (const rule of OWNED_RECORDS) {
    if (rule.collection !== root || (rule.action !== 'delete' && rule.action !== 'job')) continue;
    const owner = data[rule.field];
    if (typeof owner === 'string' && deleted.has(owner)) return null;
  }
  if (root === '_requestReceipts' && typeof data.ownerUid !== 'string') return null;
  if (root === 'users') {
    if (parts.length === 4 && ['history', 'flashcards', 'practice'].includes(parts[2])) {
      const field = parts[2] === 'history' ? 'date' : 'createdAt';
      if (!(data[field] instanceof Timestamp)) {
        const millis = readTimeMillis(data[field]);
        if (millis === null) throw new Error('Review an invalid learning timestamp before restoring this backup.');
        return { path, data: { ...data, [field]: Timestamp.fromMillis(millis) } };
      }
    }
    return { path, data };
  }
  const destination = isCommunityRecordPath(path, 'attempts') && deleted.has(data.userId)
    ? parts.slice(0, -1).join('/') + '/' + digest(operationId + path) : path;
  return { path: destination, data: anonymizeContributions(data, deleted) as DocumentData };
}

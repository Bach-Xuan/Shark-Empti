import 'server-only';
import { randomUUID } from 'node:crypto';
import { GeoPoint, Timestamp, type Firestore } from 'firebase-admin/firestore';
import type { Auth, UserImportRecord } from 'firebase-admin/auth';
import { z } from 'zod';
import { ApiError } from '../server-api';
import { retainedRecord } from './restored-record';
import { userBudgetPaths } from './catalog';
import { JOB_LIMITS } from './config';
import type { Artifact } from './types';
import { isCommunityProjectionPath, isManagedCommunityProjection, rebuildRestoredCommunity } from '../community-privacy-migration';

export function importValue(value: unknown, db: Firestore): unknown {
  if (Array.isArray(value)) return value.map(item => importValue(item, db));
  if (!value || typeof value !== 'object') return value;
  const item = value as Record<string, unknown>;
  switch (item.$type) {
    case 'timestamp': return new Timestamp(z.number().int().parse(item.seconds), z.number().int().parse(item.nanoseconds));
    case 'date': return new Date(z.string().parse(item.value));
    case 'geoPoint': return new GeoPoint(z.number().parse(item.latitude), z.number().parse(item.longitude));
    case 'reference': return db.doc(z.string().parse(item.path));
    case 'bytes': return Buffer.from(z.string().parse(item.base64), 'base64');
    case 'number': {
      const number = z.enum(['NaN', 'Infinity', '-Infinity']).parse(item.value);
      return number === 'NaN' ? NaN : number === 'Infinity' ? Infinity : -Infinity;
    }
    case 'map': return Object.fromEntries(Object.entries(z.record(z.string(), z.unknown()).parse(item.value)).map(([key, child]) => [key, importValue(child, db)]));
    default: return Object.fromEntries(Object.entries(item).map(([key, child]) => [key, importValue(child, db)]));
  }
}

/** Empty, isolated target only. This never overwrites an operating environment. */
export async function restoreBackup(options: {
  db: Firestore; auth: Auth; artifacts: Artifact[]; read: (artifact: Artifact) => Promise<Buffer>; currentDeletedUids: Set<string>;
}) {
  const { db, auth, artifacts, read } = options;
  if ((await db.listCollections()).length || (await auth.listUsers(1)).users.length) throw new ApiError('APP-RESTORE-TARGET', 409, 'Restore requires an empty isolated target.');
  const last = artifacts.at(-1);
  if (!last) throw new ApiError('APP-DATA-INVALID', 409, 'Backup manifest is missing.');
  const manifest = z.object({ format: z.literal('shark-backup-v1'), writeWindowStartedAtMs: z.number().int(), artifacts: z.array(z.object({ fileId: z.string(), sha256: z.string() })) }).parse(JSON.parse((await read(last)).toString()));
  const age = Date.now() - manifest.writeWindowStartedAtMs;
  if (age < 0 || age >= JOB_LIMITS.backupLifetimeMs) throw new ApiError('APP-DATA-INVALID', 409, 'Backup is outside the supported restore window.');
  const parts = artifacts.slice(0, -1);
  if (manifest.artifacts.length !== parts.length || manifest.artifacts.some((part, index) => part.fileId !== parts[index].fileId || part.sha256 !== parts[index].sha256)) throw new ApiError('APP-DATA-INVALID', 409, 'Backup manifest integrity check failed.');
  const deleted = new Set(options.currentDeletedUids), operationId = randomUUID();
  // First pass merges the historical and CURRENT journal before restoring any data.
  for (const artifact of parts) {
    const data = JSON.parse((await read(artifact)).toString());
    if (data.kind === 'firestore') for (const document of data.documents) {
      const [root, id, child] = document.path.split('/');
      if (!child && id && (root === '_deletionJournal' || root === '_accountLocks')) deleted.add(id);
      if (isCommunityProjectionPath(document.path) && !isManagedCommunityProjection(document.path, importValue(document.data, db) as Record<string, unknown>)) {
        throw new ApiError('APP-DATA-INVALID', 409, 'Unrecognized data in a public projection namespace requires review before restore.');
      }
    }
  }
  const excluded = new Set(['_accountJobs', '_jobWorkerState', '_jobBudgets', '_serviceState', '_accountLocks', '_deletionJournal']);
  const deletedBudgetPaths = new Set([...deleted].flatMap(userBudgetPaths));
  let documents = 0, users = 0;
  for (const artifact of parts) {
    const data = JSON.parse((await read(artifact)).toString());
    if (data.kind === 'firestore') {
      const batch = db.batch(); let count = 0;
      for (const item of z.array(z.object({ path: z.string().min(1), data: z.record(z.string(), z.unknown()) })).max(100).parse(data.documents)) {
        if (isCommunityProjectionPath(item.path) || excluded.has(item.path.split('/')[0])) continue;
        const record = retainedRecord(item.path, importValue(item.data, db) as Record<string, unknown>, deleted, deletedBudgetPaths, operationId);
        if (record) { batch.set(db.doc(record.path), record.data); count++; }
      }
      if (count) { await batch.commit(); documents += count; }
    } else if (data.kind === 'auth') {
      const records: UserImportRecord[] = [];
      for (const user of z.array(z.object({ uid: z.string(), email: z.string().nullable(), displayName: z.string().nullable(), photoURL: z.string().nullable(), emailVerified: z.boolean(), disabled: z.boolean(),
        customClaims: z.record(z.string(), z.unknown()), metadata: z.object({ creationTime: z.string().optional(), lastSignInTime: z.string().optional() }).optional(), providers: z.array(z.object({ providerId: z.string(), uid: z.string(), email: z.string().optional(), displayName: z.string().optional(), photoURL: z.string().optional() })) })).max(100).parse(data.users)) {
        if (deleted.has(user.uid)) continue;
        if (user.providers.some(provider => provider.providerId !== 'google.com')) throw new ApiError('APP-DATA-INVALID', 409, 'Backup contains an unsupported identity provider.');
        records.push({ uid: user.uid, ...(user.email ? { email: user.email } : {}), ...(user.displayName ? { displayName: user.displayName } : {}), ...(user.photoURL ? { photoURL: user.photoURL } : {}),
          emailVerified: user.emailVerified, disabled: user.disabled, customClaims: user.customClaims, providerData: user.providers, ...(user.metadata ? { metadata: user.metadata } : {}) });
      }
      if (records.length) {
        const result = await auth.importUsers(records);
        if (result.failureCount) throw new ApiError('APP-RESTORE-AUTH', 500, 'Auth restore failed; keep the target isolated.');
        users += result.successCount;
      }
    } else throw new ApiError('APP-DATA-INVALID', 409, 'Unsupported backup part.');
  }
  // No live deletion job is restored. Give erased accounts the normal completed lock and journal lifetimes.
  const now = Date.now();
  for (const uid of deleted) {
    const batch = db.batch();
    batch.set(db.collection('_accountLocks').doc(uid), { status: 'deleted', expiresAt: new Date(now + JOB_LIMITS.backupLifetimeMs) });
    batch.set(db.collection('_deletionJournal').doc(uid), { uid, restoredDeletion: true, expiresAt: new Date(now + JOB_LIMITS.journalLifetimeMs) });
    await batch.commit();
  }
  const community = await rebuildRestoredCommunity(db);
  return { documents, users, appliedDeletions: deleted.size, community };
}

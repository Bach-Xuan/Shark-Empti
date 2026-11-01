import 'server-only';
import { FieldPath, type DocumentSnapshot, type Query } from 'firebase-admin/firestore';
import { cancelGeneration } from '@/ai/generation-store';
import { exportValue } from '../export-value';
import { getAdminAuth, getAdminDb } from '../firebase-admin';
import { ApiError } from '../server-api';
import { continuation, isCommunityRecordPath, isOwnedRecordPath, OWNED_RECORDS, ownedQuery, redactExport, userBudgetPaths } from './catalog';
import { digest } from './crypto';
import { JOB_LIMITS } from './config';
import { PrivateJobStorage } from './storage';
import { readJob, type JobRecord, type JobCursor, type StepResult } from './types';
import { assertJobLease } from './store';
import { inventoryPage } from './inventory';
import { SERVICE_CONSENT_COLLECTION } from '../service-policy';
import { prepareForumPublication } from '../forum-publication';
import { prepareArenaPublication } from '../arena-publication';

const DELETED_AUTHOR = { authorId: '__deleted__', authorName: 'Former member', authorPhoto: '' };
function anonymousArchive(value: unknown, uid: string): unknown {
  if (Array.isArray(value)) return value.map(item => anonymousArchive(item, uid));
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return value;
  const result = { ...value as Record<string, unknown> };
  if (result.authorId === uid) Object.assign(result, DELETED_AUTHOR);
  for (const field of ['uid', 'ownerUid', 'userId', 'actorId', 'hiddenBy', 'reporterId']) if (result[field] === uid) result[field] = '__deleted__';
  if (Array.isArray(result.likedBy)) { result.likedBy = result.likedBy.filter(item => item !== uid); result.likesCount = (result.likedBy as unknown[]).length; }
  for (const [key, child] of Object.entries(result)) result[key] = anonymousArchive(child, uid);
  return result;
}
async function writePart(id: string, job: JobRecord, value: unknown, records: number, label: string) {
  const data = Buffer.from(JSON.stringify(value));
  if (data.length > JOB_LIMITS.objectBytes) throw new ApiError('APP-EXPORT-LIMIT', 413, 'An export record exceeds the supported part size.');
  const name = 'exports/' + id + '/' + label + '-' + digest(data) + '.enc';
  // Pending work may span quota days; owner download authorization starts at ready.
  const objectExpiry = job.createdAtMs + JOB_LIMITS.exportProcessingMs + JOB_LIMITS.exportLifetimeMs;
  return new PrivateJobStorage().put(name, data, records, objectExpiry);
}
async function page(query: Query) {
  const all = (await query.limit(JOB_LIMITS.pageSize + 1).get()).docs;
  const documents: DocumentSnapshot[] = [];
  let bytes = 1000;
  for (const document of all.slice(0, JOB_LIMITS.pageSize)) {
    const size = Buffer.byteLength(JSON.stringify(exportValue(document.data()))) + Buffer.byteLength(document.ref.path) + 100;
    if (bytes + size > JOB_LIMITS.partBytes && documents.length) break;
    if (bytes + size > JOB_LIMITS.objectBytes) break;
    documents.push(document); bytes += size;
    if (bytes > JOB_LIMITS.partBytes) break;
  }
  if (!documents.length && all.length) throw new ApiError('APP-EXPORT-LIMIT', 413, 'An account record exceeds the supported part size.');
  return Object.assign(documents, { more: all.length > documents.length });
}
function advanced(job: JobRecord, patch: Partial<JobCursor>): JobCursor {
  const cursor = { ...job.cursor, ...patch };
  if (patch.after === undefined) delete cursor.after;
  return cursor;
}
async function privatePage(id: string, job: JobRecord, deleting: boolean): Promise<{ documents: DocumentSnapshot[]; cursor: JobCursor }> {
  const db = getAdminDb();
  const uid = job.ownerUid!;
  const collections = job.cursor.collections ?? (await db.doc('users/' + uid).listCollections()).map(item => item.path);
  const index = job.cursor.collectionIndex ?? 0;
  if (index >= collections.length) return { documents: [], cursor: { phase: 2 } };
  const path = collections[index];
  if (!path.startsWith('users/' + uid + '/') || path.split('/').length % 2 === 0) throw new Error('Invalid private collection checkpoint');
  const inventory = job.cursor.pending?.length ? { paths: job.cursor.pending, after: job.cursor.after } : await inventoryPage(path, job.cursor.after, JOB_LIMITS.pageSize);
  const snapshots = inventory.paths.length ? await db.getAll(...inventory.paths.map(path => db.doc(path))) : [];
  const consumed: DocumentSnapshot[] = [];
  let bytes = 1000;
  for (const document of snapshots) {
    const size = document.exists ? Buffer.byteLength(JSON.stringify(exportValue(document.data()))) + Buffer.byteLength(document.ref.path) + 100 : 0;
    if (bytes + size > JOB_LIMITS.partBytes && consumed.length) break;
    if (bytes + size > JOB_LIMITS.objectBytes) throw new ApiError('APP-EXPORT-LIMIT', 413, 'A private record exceeds the supported part size.');
    consumed.push(document); bytes += size;
  }
  const documents = consumed.filter(document => document.exists);
  const descendants = (await Promise.all(consumed.map(document => document.ref.listCollections()))).flat().map(item => item.path);
  for (const child of descendants) if (!collections.includes(child)) collections.push(child);
  if (collections.length > 2000) throw new ApiError('APP-EXPORT-LIMIT', 413, 'Account inventory exceeds its bounded capacity.');
  if (deleting) {
    await db.runTransaction(async transaction => {
      await assertJobLease(transaction, id, job);
      documents.forEach(document => transaction.delete(document.ref));
    });
  }
  const pending = inventory.paths.slice(consumed.length);
  return { documents, cursor: pending.length || inventory.after
    ? { phase: 1, collections, collectionIndex: index, ...(inventory.after ? { after: inventory.after } : {}), ...(pending.length ? { pending } : {}) }
    : { phase: 1, collections, collectionIndex: index + 1 } };
}

export async function exportStep(id: string, job: JobRecord): Promise<StepResult> {
  const uid = job.ownerUid!;
  const db = getAdminDb();
  if (job.cursor.phase === 0) {
    const [profile, auth, consent] = await Promise.all([db.doc('users/' + uid).get(), getAdminAuth().getUser(uid), db.collection(SERVICE_CONSENT_COLLECTION).doc(uid).get()]);
    const identity = { uid, email: auth.email ?? null, emailVerified: auth.emailVerified, displayName: auth.displayName ?? null,
      photoURL: auth.photoURL ?? null, disabled: auth.disabled, metadata: auth.metadata.toJSON(), providers: auth.providerData.map(provider => provider.toJSON()), customClaims: auth.customClaims ?? {} };
    const artifact = await writePart(id, job, { kind: 'identity', identity, profile: profile.exists ? exportValue(profile.data()) : null,
      serviceConsent: consent.exists ? exportValue(consent.data()) : null }, 1 + Number(profile.exists) + Number(consent.exists), 'identity');
    return { cursor: { phase: 1 }, processed: artifact.records, artifact };
  }
  if (job.cursor.phase === 1) {
    const result = await privatePage(id, job, false);
    const documents = result.documents.map(snapshot => ({ path: snapshot.ref.path, data: exportValue(snapshot.data()) }));
    return { cursor: result.cursor, processed: documents.length,
      ...(documents.length ? { artifact: await writePart(id, job, { kind: 'private', documents }, documents.length, 'private') } : {}) };
  }
  const sourceIndex = job.cursor.phase - 2;
  if (sourceIndex < OWNED_RECORDS.length) {
    const raw = await page(continuation(ownedQuery(sourceIndex, uid), job.cursor.after));
    const documents = raw.filter(snapshot => snapshot.ref.path !== '_accountJobs/' + id && isOwnedRecordPath(sourceIndex, snapshot.ref.path));
    const values = documents.map(snapshot => {
      const data = OWNED_RECORDS[sourceIndex].field === 'hiddenBy'
        ? { target: snapshot.get('target') ?? null, hiddenBy: uid, reason: snapshot.get('reason') ?? null, hiddenAt: snapshot.get('hiddenAt') ?? null }
        : snapshot.data();
      return { path: snapshot.ref.path, data: redactExport(exportValue(data), uid) };
    });
    return { cursor: advanced(job, raw.more ? { after: raw.at(-1)!.ref.path } : { phase: job.cursor.phase + 1 }),
      processed: values.length, ...(values.length ? { artifact: await writePart(id, job, { kind: 'associated', documents: values }, values.length, 'associated') } : {}) };
  }
  if (sourceIndex === OWNED_RECORDS.length) {
    const snapshots = await db.getAll(db.doc('_aiQuota/user_' + uid), ...userBudgetPaths(uid).map(path => db.doc(path)));
    const documents = snapshots.filter(snapshot => snapshot.exists).map(snapshot => ({ path: snapshot.ref.path, data: exportValue(snapshot.data()) }));
    return { cursor: { phase: job.cursor.phase + 1 }, processed: documents.length,
      ...(documents.length ? { artifact: await writePart(id, job, { kind: 'budgets', documents }, documents.length, 'budgets') } : {}) };
  }
  const manifest = { format: 'shark-account-export-v1', ownerUid: uid, createdAt: new Date(job.createdAtMs).toISOString(),
    processingDeadline: new Date(job.createdAtMs + JOB_LIMITS.exportProcessingMs).toISOString(),
    downloadLifetimeHours: 24, consistentSnapshot: false, records: job.processed,
    parts: job.artifacts.map((artifact, index) => ({ part: index, filename: 'shark-account-' + index + '.json', sha256: artifact.plaintextSha256, encryptedSha256: artifact.sha256, records: artifact.records })),
    exclusions: ['Credentials and provider tokens', 'Private records belonging to other members', 'Legacy opaque receipts without an attributable owner; these expire through retention'] };
  return { cursor: { phase: job.cursor.phase + 1 }, processed: 0, artifact: await writePart(id, job, manifest, 0, 'manifest'), complete: true };
}

async function deleteOrAnonymize(id: string, job: JobRecord, snapshot: DocumentSnapshot, action: string) {
  const db = getAdminDb(), uid = job.ownerUid!;
  if (snapshot.ref.path === '_accountJobs/' + id) return true;
  if (action === 'job') {
    const record = readJob(snapshot.data());
    const storage = new PrivateJobStorage();
    const prefix = (record.kind === 'backup' ? 'backups/' : 'exports/') + snapshot.id + '/';
    const versions = await storage.listVersions(prefix);
    for (const file of versions.slice(0, JOB_LIMITS.pageSize)) {
      await db.runTransaction(transaction => assertJobLease(transaction, id, job));
      await storage.remove(file);
    }
    // Absence in the version inventory is a durable checkpoint, even if upload
    // or parent-cursor acknowledgement was lost. Keep download indices stable.
    if (versions.length > JOB_LIMITS.pageSize) return false;
  }
  await db.runTransaction(async transaction => {
    await assertJobLease(transaction, id, job);
    const current = await transaction.get(snapshot.ref);
    if (!current.exists) return;
    const publication = await prepareForumPublication(transaction, db, snapshot.ref.path);
    const publishArena = action === 'attempt' ? await prepareArenaPublication(transaction, db, snapshot.ref.path, current.data()!) : null;
    if (action === 'author') {
      const key = snapshot.ref.parent.id === 'arenaExams' ? await transaction.get(db.collection('_arenaAnswerKeys').doc(snapshot.id)) : null;
      // Keep metadata/key ownership atomic; private schemas do not accept display fields.
      if (key?.exists) transaction.update(key.ref, { authorId: '__deleted__' });
      const patch = { authorId: '__deleted__',
        ...(current.get('authorName') !== undefined ? { authorName: DELETED_AUTHOR.authorName } : {}),
        ...(current.get('authorPhoto') !== undefined ? { authorPhoto: '' } : {}) };
      transaction.update(snapshot.ref, patch);
      publication.write({ ...current.data(), ...patch });
    }
    else if (action === 'archive') transaction.set(snapshot.ref, anonymousArchive(current.data(), uid) as Record<string, unknown>);
    else if (action === 'actor') transaction.update(snapshot.ref, { actorId: '__deleted__' });
    else if (action === 'moderator') transaction.update(snapshot.ref, { hiddenBy: '__deleted__' });
    else if (action === 'attempt') {
      const anonymousRef = snapshot.ref.parent.doc(digest(id + ':' + snapshot.ref.path));
      const anonymous = { ...current.data(), userId: '__deleted__', userName: 'Former member', userPhoto: '' };
      transaction.set(anonymousRef, anonymous);
      publishArena?.(anonymous);
      transaction.delete(snapshot.ref);
    } else transaction.delete(snapshot.ref);
  });
  return true;
}

export async function deletionStep(id: string, job: JobRecord): Promise<StepResult> {
  const uid = job.ownerUid!, db = getAdminDb();
  if (job.cursor.phase === 0) {
    const documents = await page(continuation(db.collection('_aiGenerations').where('ownerUid', '==', uid).orderBy(FieldPath.documentId()), job.cursor.after));
    for (const document of documents) {
      try { await cancelGeneration(document.id, uid); }
      catch (error) { if (!(error instanceof ApiError) || error.status !== 404) throw error; }
    }
    return { cursor: documents.more ? { phase: 0, after: documents.at(-1)!.ref.path } : { phase: 1 }, processed: 0 };
  }
  if (job.cursor.phase === 1) { const result = await privatePage(id, job, true); return { cursor: result.cursor, processed: result.documents.length }; }
  const index = job.cursor.phase - 2;
  if (index < OWNED_RECORDS.length) {
    const documents = await page(continuation(ownedQuery(index, uid), job.cursor.after));
    let after = job.cursor.after, processed = 0;
    for (const document of documents) {
      if (isOwnedRecordPath(index, document.ref.path) && !await deleteOrAnonymize(id, job, document, OWNED_RECORDS[index].action)) {
        return { cursor: advanced(job, { after }), processed };
      }
      after = document.ref.path; processed++;
    }
    return { cursor: advanced(job, documents.more ? { after: documents.at(-1)!.ref.path } : { phase: job.cursor.phase + 1 }), processed: documents.length };
  }
  const likesIndex = index - OWNED_RECORDS.length;
  if (likesIndex < 3) {
    const collection = ['posts', 'comments', 'arenaExams'][likesIndex];
    const query = collection === 'comments' ? db.collectionGroup(collection) : db.collection(collection);
    const documents = await page(continuation(query.where('likedBy', 'array-contains', uid).orderBy(FieldPath.documentId()), job.cursor.after));
    for (const document of documents) {
      if (collection === 'comments' && !isCommunityRecordPath(document.ref.path, 'comments')) continue;
      await db.runTransaction(async transaction => {
        await assertJobLease(transaction, id, job);
        const current = await transaction.get(document.ref);
        if (!current.exists || !Array.isArray(current.get('likedBy'))) return;
        const publication = await prepareForumPublication(transaction, db, document.ref.path);
        const likedBy = current.get('likedBy').filter((member: unknown) => member !== uid);
        transaction.update(document.ref, { likedBy, likesCount: likedBy.length });
        publication.write({ ...current.data(), likedBy, likesCount: likedBy.length });
      });
    }
    return { cursor: advanced(job, documents.more ? { after: documents.at(-1)!.ref.path } : { phase: job.cursor.phase + 1 }), processed: documents.length };
  }
  const archiveIndex = likesIndex - 3;
  if (archiveIndex < 2) {
    const collection = ['_moderationArchives', '_arenaLegacyBackups'][archiveIndex];
    const documents = await page(continuation(db.collection(collection).orderBy(FieldPath.documentId()), job.cursor.after));
    for (const document of documents) await db.runTransaction(async transaction => {
      await assertJobLease(transaction, id, job);
      const current = await transaction.get(document.ref);
      if (current.exists) transaction.set(document.ref, anonymousArchive(current.data(), uid) as Record<string, unknown>);
    });
    return { cursor: advanced(job, documents.more ? { after: documents.at(-1)!.ref.path } : { phase: job.cursor.phase + 1 }), processed: documents.length };
  }
  await db.runTransaction(async transaction => {
    await assertJobLease(transaction, id, job);
    for (const path of userBudgetPaths(uid)) transaction.delete(db.doc(path));
    transaction.delete(db.doc('_aiQuota/user_' + uid));
    transaction.delete(db.collection(SERVICE_CONSENT_COLLECTION).doc(uid));
    transaction.delete(db.doc('users/' + uid));
  });
  // Auth is deliberately last; a replay of a successful delete is harmless.
  try { await getAdminAuth().deleteUser(uid); }
  catch (error) { if ((error as { code?: string }).code !== 'auth/user-not-found') throw error; }
  return { cursor: { phase: job.cursor.phase + 1 }, processed: 1, complete: true };
}

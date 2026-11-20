import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { cancelGeneration, claimGeneration, createGeneration, finalizeGeneration } from '@/ai/generation-store';
import { seedServiceConsent } from '../fixtures/service-consent';
import { createAccountJob, claimJob, finishStep } from '@/lib/jobs/store';
import { runJob, maintenanceSweep } from '@/lib/jobs/worker';
import { PrivateJobStorage } from '@/lib/jobs/storage';
import { readJob, type Artifact } from '@/lib/jobs/types';
import { OWNED_RECORDS } from '@/lib/jobs/catalog';
import { JOB_LIMITS } from '@/lib/jobs/config';
import { digest } from '@/lib/jobs/crypto';
import { enqueueJob } from '@/lib/jobs/queue';
import { exportStep, deletionStep } from '@/lib/jobs/account-worker';
import { restoreBackup } from '@/lib/jobs/restore';
import { finalizeRestoredDeletions, releaseDeletionCutover, RESTORE_MARKER } from '@/lib/jobs/restore-cutover';
import { backupStep } from '@/lib/jobs/backup';
import { forumReactionId } from '@/lib/community-privacy';
import { projectForumMetadata } from '@/lib/community-projections';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { GET as listJobs, POST as requestJob } from '@/app/api/account/jobs/route';
import { GET as jobStatus } from '@/app/api/account/jobs/[id]/route';
vi.mock('server-only', () => ({}));
type File = { fileId: string; fileName: string; contentLength: number; fileInfo: Record<string, string>; action: string; data: Buffer };
const realFetch = globalThis.fetch, files = new Map<string, File>();
let uid: string, token: string, queueStatus = 200;
beforeEach(async () => {
  vi.unstubAllGlobals(); files.clear(); queueStatus = 200;
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '')) throw Error('Loopback Auth Emulator required');
  const identities = await getAdminAuth().listUsers(1000);
  if (identities.users.length) await getAdminAuth().deleteUsers(identities.users.map(user => user.uid));
  await realFetch('http://' + process.env.FIRESTORE_EMULATOR_HOST + '/emulator/v1/projects/demo-shark-empti/databases/(default)/documents', { method: 'DELETE' });
  const signup = await (await realFetch('http://' + process.env.FIREBASE_AUTH_EMULATOR_HOST + '/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fixture', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }) })).json();
  uid = signup.localId; token = signup.idToken;
  await getAdminAuth().updateUser(uid, { displayName: 'Learner' });
  await getAdminDb().doc('users/' + uid).set({ displayName: 'Learner', sharkCoins: 20 });
  for (const [key, value] of Object.entries({ ACCOUNT_JOBS_ENABLED: 'true', ACCOUNT_BACKUPS_ENABLED: 'false', JOB_ENVIRONMENT: 'production', JOBS_BASE_URL: 'https://fixture.example.invalid',
    SHARK_EMULATOR_TEST_MODE: 'true', GCLOUD_PROJECT: 'demo-shark-empti', JOB_TRANSPORT_TEST_URL: 'http://127.0.0.1:9097',
    QSTASH_TOKEN: 'fixture', QSTASH_CURRENT_SIGNING_KEY: 'fixture', QSTASH_NEXT_SIGNING_KEY: 'fixture', B2_KEY_ID: 'fixture', B2_APPLICATION_KEY: 'fixture', B2_BUCKET_ID: 'fixture', JOB_ENCRYPTION_KEY: Buffer.alloc(32, 5).toString('base64') })) vi.stubEnv(key, value);
  vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input), operation = url.split('/').at(-1);
    if (!url.startsWith('http://127.0.0.1:9097')) return realFetch(input, init);
    if (url.includes('/qstash/')) return queueStatus === 200 ? Response.json({ messageId: randomUUID() }) : Response.json({ error: 'Synthetic provider quota' }, { status: queueStatus });
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
    if (operation === 'b2_authorize_account') return Response.json({ authorizationToken: 'private', apiInfo: { storageApi: { apiUrl: 'http://127.0.0.1:9097', downloadUrl: 'http://127.0.0.1:9097', allowed: { buckets: [{ id: 'fixture', name: 'fixture' }], namePrefix: null, capabilities: ['listFiles', 'readFiles', 'writeFiles', 'deleteFiles'] } } } });
    if (operation === 'b2_list_file_versions') return Response.json({ files: [...files.values()].filter(file => file.fileName.startsWith(body.prefix ?? '')).map(({ data: _data, ...file }) => file), nextFileName: null, nextFileId: null });
    if (operation === 'b2_get_upload_url') return Response.json({ uploadUrl: 'http://127.0.0.1:9097/upload', authorizationToken: 'private-upload' });
    if (operation === 'b2_list_unfinished_large_files') return Response.json({ files: [] });
    if (operation === 'b2_delete_file_version') { files.delete(body.fileId); return Response.json({ fileId: body.fileId }); }
    if (operation === 'upload') {
      const headers = new Headers(init?.headers), data = Buffer.from(init!.body as Uint8Array), fileId = randomUUID();
      const file = { fileId, fileName: decodeURIComponent(headers.get('x-bz-file-name')!), contentLength: data.length, action: 'upload',
        fileInfo: { plaintext: headers.get('x-bz-info-plaintext')!, sha256: headers.get('x-bz-info-sha256')!, expires: headers.get('x-bz-info-expires')! }, data };
      files.set(fileId, file); return Response.json({ ...file, data: undefined });
    }
    if (url.includes('b2_download_file_by_id')) { const file = files.get(new URL(url).searchParams.get('fileId')!); return file ? new Response(new Uint8Array(file.data)) : new Response(null, { status: 404 }); }
    throw Error('Unexpected fixture operation: ' + operation);
  });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
async function complete(id: string) {
  for (let step = 0; step < 60; step++) {
    const job = readJob((await getAdminDb().doc('_accountJobs/' + id).get()).data());
    if (['ready', 'completed', 'failed'].includes(job.status)) return job;
    await runJob(id);
  }
  throw Error('Job did not finish within its bounded fixture inventory');
}
it('admits account job creation/list/status before parsing or private job lookups', async () => {
  await getAdminDb().doc('_requestBudgets/account-traffic_global').set({ tokens: 0, updatedAtMs: Date.now() + 60000 });
  const headers = { Authorization: 'Bearer ' + token };
  const address = 'https://fixture.example.invalid/api/account/jobs';
  expect((await listJobs(new Request(address, { headers }))).status).toBe(429);
  expect((await requestJob(new Request(address, { method: 'POST', headers, body: '{}' }))).status).toBe(429);
  const id = randomUUID();
  const status = await jobStatus(new Request(address + '/' + id, { headers }), { params: Promise.resolve({ id }) });
  expect(status.status).toBe(429);
});
it('admits a bounded receipt credential before looking up an unknown private job', async () => {
  await getAdminDb().doc('_requestBudgets/account-receipt_global').set({ tokens: 0, updatedAtMs: Date.now() + 60000 });
  const id = randomUUID();
  const response = await jobStatus(new Request('https://fixture.example.invalid/api/account/jobs/' + id, { headers: { 'X-Deletion-Receipt': 'a'.repeat(43) } }), { params: Promise.resolve({ id }) });
  expect(response.status).toBe(429);
});
it('rejects malformed receipt syntax before budget or private-job database access', async () => {
  const db = getAdminDb(), access = vi.spyOn(db, 'collection');
  for (const receipt of ['wrong', 'a'.repeat(129), 'a'.repeat(42) + '+']) {
    const id = randomUUID();
    const response = await jobStatus(new Request('https://fixture.example.invalid/api/account/jobs/' + id, { headers: { 'X-Deletion-Receipt': receipt } }), { params: Promise.resolve({ id }) });
    expect(response.status).toBe(404);
  }
  expect(access).not.toHaveBeenCalled();
});
it('admits only the final global receipt token without persisting receipt identifiers', async () => {
  const db = getAdminDb();
  await db.doc('_requestBudgets/account-receipt_global').set({ tokens: 1, updatedAtMs: Date.now() + 60000 });
  const responses = await Promise.all(['a', 'b'].map(async value => {
    const id = randomUUID();
    return jobStatus(new Request('https://fixture.example.invalid/api/account/jobs/' + id, { headers: { 'X-Deletion-Receipt': value.repeat(43) } }), { params: Promise.resolve({ id }) });
  }));
  expect(responses.map(response => response.status).sort()).toEqual([404, 429]);
  const budgets = await db.collection('_requestBudgets').get();
  expect(budgets.docs.map(doc => doc.id)).toEqual(['account-receipt_global']);
  expect((await budgets.docs[0].ref.get()).get('tokens')).toBe(0);
});
it('keeps admitted account reads available without consent under locks and maintenance while denying new jobs', async () => {
  const db = getAdminDb(), created = await createAccountJob(uid, 'deletion', randomUUID());
  await db.doc('_serviceState/maintenance').set({ active: true, expiresAtMs: Date.now() + 60000 });
  const address = 'https://fixture.example.invalid/api/account/jobs', headers = { Authorization: 'Bearer ' + token };
  expect((await listJobs(new Request(address, { headers }))).status).toBe(200);
  const status = await jobStatus(new Request(address + '/' + created.id, { headers }), { params: Promise.resolve({ id: created.id }) });
  expect(status.status).toBe(200);
  const receipt = await jobStatus(new Request(address + '/' + created.id, { headers: { 'X-Deletion-Receipt': created.receipt! } }), { params: Promise.resolve({ id: created.id }) });
  expect(receipt.status).toBe(200);
  expect((await requestJob(new Request(address, { method: 'POST', headers, body: JSON.stringify({ kind: 'export', requestId: randomUUID() }) }))).status).toBe(503);
});
it('exports private, community and server records through durable parts; duplicate requests and deliveries are safe', async () => {
  const db = getAdminDb();
  await db.doc('_serviceConsents/' + uid).set({ policyVersion: '2', minimumAge: 16, acceptedAt: Timestamp.fromMillis(1) });
  await db.doc('users/' + uid + '/notes/main').set({ text: 'Owned private note' });
  const ownReaction = 'users/' + uid + '/forumReactions/' + await forumReactionId({ postId: 'reacted-post' });
  await db.doc(ownReaction).set({ postId: 'reacted-post', liked: true, privacyVersion: 1 });
  await db.doc('users/' + uid + '/notes/missing/deep/one').set({ text: 'Owned orphan note' });
  await db.doc('users/foreign/notes/main').set({ text: 'Foreign secret' });
  await db.doc('users/foreign/comments/private').set({ authorId: uid, content: 'Foreign private comment', likedBy: [uid] });
  await db.doc('users/foreign/attempts/private').set({ userId: uid, content: 'Foreign private attempt' });
  await db.doc('posts/own').set({ authorId: uid, content: 'Own contribution', likedBy: ['foreign'], likesCount: 1 });
  await db.doc('_aiGenerations/own').set({ ownerUid: uid, status: 'succeeded', result: { text: 'Own AI feedback' } });
  await db.doc('_communityReports/mine').set({ reporterId: uid, decidedBy: 'private-moderator' });
  await db.doc('_communityReports/decision').set({ reporterId: 'private-reporter', decidedBy: uid, reason: 'private-report-text', decisionReason: 'My moderation decision' });
  const requestId = randomUUID(), created = await createAccountJob(uid, 'export', requestId);
  expect((await createAccountJob(uid, 'export', requestId)).id).toBe(created.id);
  await expect(createAccountJob(uid, 'deletion', requestId)).rejects.toMatchObject({ status: 409 });
  const job = await complete(created.id);
  expect(job.status).toBe('ready');
  const output = (await Promise.all(job.artifacts.map(artifact => new PrivateJobStorage().get(artifact)))).map(buffer => buffer.toString());
  expect(JSON.parse(output[0]).serviceConsent).toMatchObject({ policyVersion: '2', minimumAge: 16, acceptedAt: { $type: 'timestamp' } });
  expect(output.join()).toContain('Owned private note'); expect(output.join()).toContain('Own contribution'); expect(output.join()).toContain('Own AI feedback');
  expect(output.join()).not.toContain('Foreign secret'); expect(output.join()).not.toContain('"likedBy":["foreign"]');
  expect(output.join()).toContain('My moderation decision');
  for (const other of ['private-moderator', 'private-reporter', 'private-report-text']) expect(output.join()).not.toContain(other);
  expect(output.join()).toContain('Owned orphan note');
  expect(output.join()).toContain(ownReaction);
  expect(output.join()).not.toContain('Foreign private comment');
  expect(output.join()).not.toContain('Foreign private attempt');
  const manifest = JSON.parse(output.at(-1)!);
  expect(manifest).toMatchObject({ format: 'shark-account-export-v1', consistentSnapshot: false });
  manifest.parts.forEach((part: { filename: string; sha256: string }, index: number) => {
    expect(part.filename).toBe('shark-account-' + index + '.json');
    expect(part.sha256).toBe(digest(Buffer.from(output[index])));
  });
  const count = files.size; await runJob(created.id); expect(files.size).toBe(count);
});
it('locks writes, removes private/Auth records and reactions, and anonymizes retained contributions and ranking identity', async () => {
  const db = getAdminDb();
  await db.doc('_serviceConsents/' + uid).set({ policyVersion: '2', minimumAge: 16, acceptedAt: Timestamp.fromMillis(1) });
  await db.doc('_aiGenerations/expired-owned').set({ ownerUid: uid, expiresAt: new Date(0), status: 'ready' });
  await db.doc('users/' + uid + '/history/one').set({ private: 'Owned history' });
  const ownReaction = 'users/' + uid + '/forumReactions/' + await forumReactionId({ postId: 'own' });
  await db.doc(ownReaction).set({ postId: 'own', liked: true, privacyVersion: 1 });
  await db.doc('users/' + uid + '/notes/missing/deep/one').set({ private: 'Orphan private record' });
  const foreignComment = { authorId: uid, authorName: 'Private copy', likedBy: [uid], likesCount: 1 };
  const foreignAttempt = { userId: uid, userName: 'Private copy' };
  await db.doc('users/foreign/comments/private').set(foreignComment);
  await db.doc('users/foreign/attempts/private').set(foreignAttempt);
  const contribution = { title: 'Retained contribution', content: 'Body', subject: 'math', authorId: uid, authorName: 'Learner', authorPhoto: 'https://example.invalid/avatar', likedBy: [uid, 'other'], likesCount: 2, commentsCount: 0, createdAt: Timestamp.now() };
  await db.doc('posts/own').set(contribution);
  await db.doc('forumPosts/own').set(projectForumMetadata(contribution, 'post')!);
  await db.doc('posts/foreign/comments/own').set({ authorId: uid, authorName: 'Learner', authorPhoto: '', likedBy: [] });
  await db.doc('arenaExams/exam/attempts/old-linked-id').set({ userId: uid, userName: 'Learner', score: 80 });
  await db.doc('arenaExams/owned').set({ authorId: uid, authorName: 'Learner', authorPhoto: '' });
  await db.doc('_arenaAnswerKeys/owned').set({ authorId: uid, questions: [], schemaVersion: 2 });
  await db.doc('_moderationArchives/foreign').set({ constructor: 'legacy', snapshot: { authorId: 'other', likedBy: ['other'], likesCount: 9 }, hiddenBy: uid, comments: [{ authorId: uid, authorName: 'Learner', authorPhoto: '' }], ranking: { userId: uid, userName: 'Learner', userPhoto: 'old-avatar' } });
  await db.doc('_communityReports/decision').set({ reporterId: 'other', decidedBy: uid });
  await db.doc('_communityReports/hidden').set({ reporterId: uid, reason: 'private text', target: { kind: 'post', id: 'other' }, status: 'hidden', createdAt: Timestamp.now() });
  await db.doc('_accountRequests/old').set({ uid, kind: 'deletion', status: 'pending_operator' });
  const created = await createAccountJob(uid, 'deletion', randomUUID());
  expect((await db.doc('_accountLocks/' + uid).get()).get('status')).toBe('deleting');
  await expect(createAccountJob(uid, 'export', randomUUID())).rejects.toMatchObject({ code: 'ACCOUNT-DELETING' });
  expect((await complete(created.id)).status).toBe('completed');
  expect((await db.doc('_communityReports/decision').get()).get('decidedBy')).toBe('__deleted__');
  const control = await db.doc('_communityReports/hidden').get();
  expect(control.get('status')).toBe('hidden');
  expect(control.get('reason')).toBe('');
  expect(control.get('reporterId')).toBeUndefined();
  expect((await db.doc('users/' + uid + '/history/one').get()).exists).toBe(false);
  expect((await db.doc(ownReaction).get()).exists).toBe(false);
  expect((await db.doc('users/' + uid + '/notes/missing/deep/one').get()).exists).toBe(false);
  expect((await db.doc('users/' + uid).get()).exists).toBe(false);
  expect((await db.doc('_serviceConsents/' + uid).get()).exists).toBe(false);
  await expect(getAdminAuth().getUser(uid)).rejects.toMatchObject({ code: 'auth/user-not-found' });
  expect((await db.doc('posts/own').get()).data()).toMatchObject({ authorId: '__deleted__', authorName: 'Former member', authorPhoto: '', likedBy: ['other'], likesCount: 1 });
  expect((await db.doc('forumPosts/own').get()).data()).toMatchObject({ authorId: '__deleted__', authorName: 'Former member', likesCount: 1, privacyVersion: 1 });
  expect((await db.doc('forumPosts/own').get()).get('likedBy')).toBeUndefined();
  expect(JSON.stringify((await db.doc('_moderationArchives/foreign').get()).data())).not.toContain(uid);
  expect((await db.doc('_moderationArchives/foreign').get()).data()).toMatchObject({
    snapshot: { likedBy: ['other'], likesCount: 9 }, ranking: { userId: '__deleted__', userName: 'Former member', userPhoto: '' },
  });
  expect((await db.collection('arenaExams/exam/attempts').where('userId', '==', uid).get()).empty).toBe(true);
  expect((await db.doc('users/foreign/comments/private').get()).data()).toEqual(foreignComment);
  expect((await db.doc('users/foreign/attempts/private').get()).data()).toEqual(foreignAttempt);
  expect((await db.doc('_deletionJournal/' + uid).get()).exists).toBe(true);
  expect((await db.doc('_accountJobs/' + created.id).get()).get('ownerUid')).toBeUndefined();
  const status = await jobStatus(new Request('https://fixture.example.invalid/api/account/jobs/' + created.id, { headers: { 'X-Deletion-Receipt': created.receipt! } }), { params: Promise.resolve({ id: created.id }) });
  expect(status.status).toBe(200);
  expect(await status.json()).toMatchObject({ id: created.id, kind: 'deletion', status: 'completed' });
  expect((await db.doc('_accountLocks/' + uid).get()).get('status')).toBe('deleted');
  expect((await db.doc('_arenaAnswerKeys/owned').get()).data()).toEqual({ authorId: '__deleted__', questions: [], schemaVersion: 2 });
});
it('erases ready and in-flight AI work under the deletion lease while preserving another owner’s running attempt', async () => {
  const db = getAdminDb(), other = 'other-learner';
  await seedServiceConsent(uid, other);
  const ready = randomUUID(), running = randomUUID(), foreign = randomUUID();
  for (const [id, owner] of [[ready, uid], [running, uid], [foreign, other]]) {
    await createGeneration(id, owner, 'academic-validation', { topic: 'Algebra', language: 'en' });
  }
  const attempt = await claimGeneration(running, uid);
  expect(attempt.kind).toBe('claimed');
  expect((await claimGeneration(foreign, other)).kind).toBe('claimed');
  const created = await createAccountJob(uid, 'deletion', randomUUID());
  await expect(cancelGeneration(ready, uid)).rejects.toMatchObject({ code: 'ACCOUNT-DELETING' });
  const job = (await claimJob(created.id))!;
  await expect(deletionStep(created.id, { ...job, lease: { ...job.lease!, id: 'obsolete' } })).rejects.toMatchObject({ code: 'ACCOUNT-JOB-LEASE' });
  const lock = db.doc('_accountLocks/' + uid);
  await lock.update({ jobId: 'different-job' });
  await expect(deletionStep(created.id, job)).rejects.toMatchObject({ code: 'ACCOUNT-DELETING' });
  await lock.update({ jobId: created.id });
  expect((await db.doc('_aiGenerations/' + running).get()).get('status')).toBe('running');
  const progress = await deletionStep(created.id, job);
  expect(progress).toEqual({ cursor: { phase: 1 }, processed: 2 });
  expect(await deletionStep(created.id, job)).toEqual({ cursor: progress.cursor, processed: 0 });
  for (const id of [ready, running]) expect((await db.doc('_aiGenerations/' + id).get()).exists).toBe(false);
  expect((await db.doc('_aiQuota/user_' + uid).get()).get('active')).toEqual([]);
  expect((await db.doc('_aiQuota/global').get()).get('active').map((slot: { generationId: string }) => slot.generationId)).toEqual([foreign]);
  expect((await db.doc('_aiGenerations/' + foreign).get()).get('status')).toBe('running');
  if (attempt.kind === 'claimed') await expect(finalizeGeneration(running, uid, attempt.leaseId, attempt.attempt, 10, { data: {} })).rejects.toMatchObject({ status: 404 });
  await finishStep(created.id, job, progress);
  expect((await complete(created.id)).status).toBe('completed');
});
it('continues an AI deletion page after its cursor document is erased and resumes the legacy owner phase', async () => {
  const db = getAdminDb(), generations = db.collection('_aiGenerations');
  const ids = Array.from({ length: JOB_LIMITS.pageSize + 2 }, (_, index) => 'ai-' + String(index).padStart(3, '0'));
  const batch = db.batch();
  for (const id of ids) batch.set(generations.doc(id), { ownerUid: uid, status: 'ready', expiresAt: new Date(0) });
  await batch.commit();
  const created = await createAccountJob(uid, 'deletion', randomUUID());
  const first = (await claimJob(created.id))!;
  const page = await deletionStep(created.id, first);
  const boundary = generations.doc(ids[JOB_LIMITS.pageSize - 1]);
  expect(page).toEqual({ cursor: { phase: 0, after: boundary.path }, processed: JOB_LIMITS.pageSize });
  expect((await boundary.get()).exists).toBe(false);
  await finishStep(created.id, first, page);
  const second = (await claimJob(created.id))!;
  const last = await deletionStep(created.id, second);
  expect(last).toEqual({ cursor: { phase: 1 }, processed: 2 });
  await finishStep(created.id, second, last);
  expect((await generations.where('ownerUid', '==', uid).get()).empty).toBe(true);

  // Older workers requested cancellation in phase zero and left the record for this checkpoint.
  await generations.doc('legacy-running').set({ ownerUid: uid, status: 'cancel_requested' });
  await db.doc('_aiQuota/global').set({ active: [{ generationId: 'legacy-running', expiresAtMs: Date.now() + 40_000 }] });
  const ownerPhase = 2 + OWNED_RECORDS.findIndex(source => source.collection === '_aiGenerations');
  await db.doc('_accountJobs/' + created.id).update({ cursor: { phase: ownerPhase } });
  const resumed = (await claimJob(created.id))!;
  await finishStep(created.id, resumed, await deletionStep(created.id, resumed));
  expect((await generations.doc('legacy-running').get()).exists).toBe(false);
  expect((await db.doc('_aiQuota/global').get()).get('active')).toEqual([]);
});
it('fences duplicate/expired leases and reports quota waiting without losing the cursor', async () => {
  const { id } = await createAccountJob(uid, 'export', randomUUID());
  const claim = await claimJob(id); expect(claim).not.toBeNull(); expect(await claimJob(id)).toBeNull();
  await getAdminDb().doc('_accountJobs/' + id).update({ 'lease.id': randomUUID() });
  await expect(finishStep(id, claim!, { cursor: { phase: 1 }, processed: 1 })).rejects.toMatchObject({ code: 'ACCOUNT-JOB-LEASE' });
  await getAdminDb().doc('_accountJobs/' + id).update({ status: 'queued', nextRunAtMs: 0, 'lease.expiresAtMs': 1 });
  const day = new Date().toISOString().slice(0, 10);
  await getAdminDb().doc('_jobBudgets/production_' + day).set({ reserved: 500 });
  expect(await enqueueJob(id)).toBe(false);
  expect((await getAdminDb().doc('_accountJobs/' + id).get()).get('status')).toBe('waiting_quota');
});
it('dispatches a due deletion behind five expired backups without reserving their delivery credits', async () => {
  const db = getAdminDb(), now = Date.now();
  const deletion = await createAccountJob(uid, 'deletion', randomUUID());
  const jobs = db.collection('_accountJobs');
  await jobs.doc(deletion.id).update({ expiresAtMs: now - 1, nextRunAtMs: now });
  const backups = Array.from({ length: 5 }, () => jobs.doc(randomUUID()));
  for (const ref of backups) {
    await ref.set({ kind: 'backup', status: 'queued', environment: 'production', cursor: { phase: 0 },
      artifacts: [], processed: 0, createdAtMs: now - 10000, updatedAtMs: now - 10000,
      expiresAtMs: now - 1000, nextRunAtMs: now - 2000 });
  }
  const budget = db.doc('_jobBudgets/production_' + new Date(now).toISOString().slice(0, 10));
  expect(await enqueueJob(backups[0].id)).toBe(false);
  expect(await claimJob(backups[0].id)).toBeNull();
  expect((await budget.get()).exists).toBe(false);
  await db.doc('_serviceState/maintenance').set({ active: true, jobId: backups[0].id, expiresAtMs: now + 60_000 });
  await maintenanceSweep();
  expect((await db.doc('_serviceState/maintenance').get()).get('active')).toBe(false);
  expect((await budget.get()).get('reserved')).toBe(4);
  expect((await jobs.doc(deletion.id).get()).get('nextRunAtMs')).toBeGreaterThan(now);
  expect((await Promise.all(backups.map(ref => ref.get()))).every(doc => !doc.exists || doc.get('status') === 'failed')).toBe(true);
  expect(await claimJob(deletion.id)).not.toBeNull();
});
it('sweeps expired server records with Spark queries rather than native TTL', async () => {
  await getAdminDb().doc('_arenaSessions/expired').set({ uid, expiresAt: new Date(0) });
  await getAdminDb().doc('_arenaSessions/live').set({ uid, expiresAt: new Date(Date.now() + 100000) });
  await maintenanceSweep();
  expect((await getAdminDb().doc('_arenaSessions/expired').get()).exists).toBe(false);
  expect((await getAdminDb().doc('_arenaSessions/live').get()).exists).toBe(true);
});
it('bounds download traffic while keeping quota-delayed export processing separate from ready expiry', async () => {
  const db = getAdminDb(), day = 86_400_000;
  const created = await createAccountJob(uid, 'export', randomUUID());
  expect(created.job.expiresAtMs - created.job.createdAtMs).toBe(7 * day);
  const started = Date.now() - 2 * day;
  await db.doc('_accountJobs/' + created.id).update({ createdAtMs: started, expiresAtMs: started + 7 * day,
    expiresAt: new Date(started + 7 * day), status: 'waiting_quota', nextRunAtMs: Date.now() - 1 });
  const before = Date.now(), ready = await complete(created.id);
  expect(ready.status).toBe('ready');
  expect(ready.expiresAtMs).toBeGreaterThanOrEqual(before + day);
  expect(ready.expiresAtMs).toBeLessThanOrEqual(Date.now() + day);
  expect([...files.values()].every(file => Number(file.fileInfo.expires) === started + 8 * day)).toBe(true);
  const manifest = JSON.parse((await new PrivateJobStorage().get(ready.artifacts.at(-1)!)).toString());
  expect(manifest).toMatchObject({ downloadLifetimeHours: 24, processingDeadline: new Date(started + 7 * day).toISOString() });
  const download = () => jobStatus(new Request('https://fixture.example.invalid/api/account/jobs/' + created.id + '?part=0', {
    headers: { Authorization: 'Bearer ' + token },
  }), { params: Promise.resolve({ id: created.id }) });
  expect((await download()).status).toBe(200);
  const storage = vi.spyOn(PrivateJobStorage.prototype, 'get');
  const traffic = db.doc('_requestBudgets/account-traffic_global');
  await traffic.set({ tokens: 0, updatedAtMs: Date.now() + 60000 });
  expect((await download()).status).toBe(429);
  expect(storage).not.toHaveBeenCalled();
  await traffic.delete();
  await db.doc('_accountJobs/' + created.id).update({ expiresAtMs: Date.now() - 1 });
  expect((await download()).status).toBe(404);
  expect(files.size).toBeGreaterThan(0); // Physical retention cannot extend download authorization.
});
it('rejects export completion after the processing deadline even with a valid lease', async () => {
  const db = getAdminDb(), created = await createAccountJob(uid, 'export', randomUUID());
  const now = Date.now(), deadline = now + 1000;
  await db.doc('_accountJobs/' + created.id).update({ createdAtMs: deadline - 7 * 86_400_000, expiresAtMs: deadline });
  const claim = await claimJob(created.id);
  expect(claim).not.toBeNull();
  vi.spyOn(Date, 'now').mockReturnValue(now + 2000);
  await finishStep(created.id, claim!, { cursor: claim!.cursor, processed: 0, complete: true });
  expect((await db.doc('_accountJobs/' + created.id).get()).data()).toMatchObject({ status: 'failed', errorCode: 'ACCOUNT-JOB-EXPIRED' });
});
it('shows expired processing as failed and does not let pending deletions starve terminal cleanup', async () => {
  const db = getAdminDb(), pending = await createAccountJob(uid, 'export', randomUUID());
  await db.doc('_accountJobs/' + pending.id).update({ expiresAtMs: Date.now() - 1, expiresAt: new Date(0), status: 'waiting_quota' });
  for (let index = 0; index < 21; index++) await db.doc('_accountJobs/00000000-0000-4000-8000-' + String(index).padStart(12, '0')).set({
    ...pending.job, kind: 'deletion', expiresAtMs: 1, expiresAt: new Date(1), status: 'queued' });
  const old = randomUUID();
  await db.doc('_accountJobs/' + old).set({ ...pending.job, status: 'ready', expiresAtMs: 1, expiresAt: new Date(1) });
  await maintenanceSweep();
  const failed = (await db.doc('_accountJobs/' + pending.id).get()).data();
  expect(failed).toMatchObject({ status: 'failed', errorCode: 'ACCOUNT-JOB-EXPIRED' });
  expect(failed!.expiresAtMs).toBeGreaterThan(Date.now());
  expect((await db.doc('_accountJobs/' + old).get()).exists).toBe(false);
  expect((await db.collection('_accountJobs').where('kind', '==', 'deletion').get()).size).toBe(21);
});
it('recovers an uploaded part after a lost checkpoint without creating another object version', async () => {
  const { id } = await createAccountJob(uid, 'export', randomUUID()), claim = await claimJob(id);
  await exportStep(id, claim!); // Upload succeeds; simulate losing the HTTP/checkpoint result.
  expect(files.size).toBe(1);
  await getAdminDb().doc('_accountJobs/' + id).update({ 'lease.expiresAtMs': 1 });
  await getAdminDb().doc('_jobWorkerState/lease').update({ expiresAtMs: 1 });
  await runJob(id);
  expect(files.size).toBe(1);
  expect((await getAdminDb().doc('_accountJobs/' + id).get()).get('cursor.phase')).toBeGreaterThanOrEqual(1);
});
it('authenticates job admission, enforces explicit deletion confirmation and hides another owner status', async () => {
  const request = (body: unknown, bearer = token) => new Request('https://fixture.example.invalid/api/account/jobs', { method: 'POST', headers: { Authorization: 'Bearer ' + bearer, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  expect((await requestJob(request({ kind: 'deletion', requestId: randomUUID() }))).status).toBe(400);
  const response = await requestJob(request({ kind: 'export', requestId: randomUUID() }));
  expect(response.status).toBe(202); const job = await response.json();
  const owner = await jobStatus(new Request('https://fixture.example.invalid/api/account/jobs/' + job.id, { headers: { Authorization: 'Bearer ' + token } }), { params: Promise.resolve({ id: job.id }) });
  expect(owner.status).toBe(200); expect(await owner.json()).not.toHaveProperty('ownerUid');
  const other = await (await realFetch('http://' + process.env.FIREBASE_AUTH_EMULATOR_HOST + '/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fixture', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }) })).json();
  const forbidden = await jobStatus(new Request('https://fixture.example.invalid/api/account/jobs/' + job.id, { headers: { Authorization: 'Bearer ' + other.idToken } }), { params: Promise.resolve({ id: job.id }) });
  expect(forbidden.status).toBe(404);
  // Emulator tokens are unsigned. Change auth_time without changing gRPC's clock.
  const segments = token.split('.'), claims = JSON.parse(Buffer.from(segments[1], 'base64url').toString());
  claims.auth_time -= 360;
  segments[1] = Buffer.from(JSON.stringify(claims)).toString('base64url');
  expect((await requestJob(request({ kind: 'export', requestId: randomUUID() }, segments.join('.')))).status).toBe(401);
});
it('exposes provider quota waiting while retaining the durable cursor', async () => {
  const { id } = await createAccountJob(uid, 'export', randomUUID());
  queueStatus = 429;
  expect(await enqueueJob(id)).toBe(false);
  const job = readJob((await getAdminDb().doc('_accountJobs/' + id).get()).data());
  expect(job.status).toBe('waiting_quota'); expect(job.cursor.phase).toBe(0);
});
it('grants one worker lease under contention and leaves each waiting checkpoint intact', async () => {
  const ids = [];
  for (let index = 0; index < 4; index++) {
    const { id } = await createAccountJob('lease-fixture-' + index, 'export', randomUUID());
    ids.push(id);
  }
  const start = performance.now();
  const claims = await Promise.all(ids.map(id => claimJob(id)));
  const winners = claims.flatMap((claim, index) => claim ? [index] : []);
  expect(winners).toHaveLength(1);
  const winner = winners[0];
  const snapshots = await getAdminDb().getAll(...ids.map(id => getAdminDb().doc('_accountJobs/' + id)));
  snapshots.forEach((doc, index) => {
    expect(doc.get('status')).toBe(index === winner ? 'running' : 'queued');
    expect(doc.get('processed')).toBe(0);
    expect(doc.get('cursor')).toEqual({ phase: 0 });
  });
  const lease = await getAdminDb().doc('_jobWorkerState/lease').get();
  expect(lease.get('jobId')).toBe(ids[winner]);
  console.info(JSON.stringify({ fixture: 'four-worker-claims', milliseconds: Math.round(performance.now() - start), granted: winners.length }));
});

it('retains an unfinished deletion journal past the normal retention window', async () => {
  const db = getAdminDb();
  await createAccountJob(uid, 'deletion', randomUUID());
  const ref = db.doc('_deletionJournal/' + uid);
  expect((await ref.get()).get('expiresAt')).toBeUndefined();
  // A legacy record with an expiry still has its active deletion lock.
  await ref.update({ expiresAt: Timestamp.fromMillis(1) });
  await maintenanceSweep();
  expect((await ref.get()).exists).toBe(true);
  expect((await db.doc('_accountLocks/' + uid).get()).get('status')).toBe('deleting');
});

it('restores encrypted Firestore/Auth parts into an empty isolated target and applies a newer deletion journal', async () => {
  const db = getAdminDb(), removedUid = 'removed-after-backup';
  await db.doc('_serviceConsents/' + uid).set({ policyVersion: '2', minimumAge: 16, acceptedAt: Timestamp.fromMillis(1) });
  await db.doc('_accountLocks/legacy-stalled').set({ status: 'deleting', jobId: 'older-job' });
  await db.doc('users/legacy-stalled/notes/one').set({ text: 'Protected by legacy lock alone' });
  await db.doc('_aiGenerations/erased-owner').set({ $type: 'retained legacy field', ownerUid: removedUid });
  await db.doc('_serviceConsents/' + removedUid).set({ policyVersion: '2', minimumAge: 16, acceptedAt: Timestamp.fromMillis(1) });
  await getAdminAuth().createUser({ uid: removedUid, displayName: 'Removed later' });
  await db.doc('users/' + removedUid + '/notes/one').set({ text: 'Must not resurrect' });
  await db.doc('users/' + uid + '/notes/missing/deep/one').set({ text: 'Restore an owned orphan' });
  const privateCopy = { authorId: removedUid, authorName: 'Original attribution', likedBy: [uid], likesCount: 9 };
  await db.doc('users/' + uid + '/comments/private').set(privateCopy);
  await db.doc('_arenaAnswerKeys/retained').set({ schemaVersion: 2, authorId: removedUid, questions: [] });
  const retained = { $type: 'legacy-map', constructor: 'legacy', title: 'Retained post', content: 'Body', subject: 'math', commentsCount: 0, createdAt: Timestamp.now(), authorId: removedUid, authorName: 'Removed later', authorPhoto: '', likedBy: [removedUid, uid], likesCount: 2 };
  await db.doc('posts/retained').set(retained);
  await db.doc('forumPosts/retained').set(projectForumMetadata(retained, 'post')!);
  const rankingId = randomUUID(), stamp = Timestamp.now();
  await db.doc('arenaExams/exam').set({ schemaVersion: 2, title: 'Exam', authorId: 'remaining-author', authorName: 'Author', authorPhoto: '', questionCount: 1, createdAt: stamp,
    totalAttempts: 1, config: { topic: 'Addition', subject: 'math', grade: 'none', type: 'Mixed', difficulty: 'Easy', numQuestions: '1' } });
  await db.doc('arenaExams/exam/attempts/' + uid).set({ examId: 'exam', userId: uid, userName: 'Learner', userPhoto: '', score: 100, duration: 3,
    timingVersion: 1, rankingVersion: 2, createdAt: stamp, publicId: rankingId });
  await db.doc('users/remaining-author/history/session').set({ date: '2026-09-03T19:00:00+07:00', content: 'Retain this session' });
  await getAdminAuth().setCustomUserClaims(uid, { moderator: true });
  vi.stubEnv('ACCOUNT_BACKUPS_ENABLED', 'true'); await maintenanceSweep();
  const jobs = await db.collection('_accountJobs').where('kind', '==', 'backup').get();
  expect(jobs.size).toBe(1);
  const job = await complete(jobs.docs[0].id); expect(job.status).toBe('completed');
  expect((await Promise.all(job.artifacts.map(artifact => new PrivateJobStorage().get(artifact)))).map(value => value.toString()).join()).toContain('Must not resurrect');
  const targetId = 'demo-restore-' + randomUUID().slice(0, 8), app = initializeApp({ projectId: targetId }, targetId);
  const partialId = 'demo-restore-' + randomUUID().slice(0, 8), partialApp = initializeApp({ projectId: partialId }, partialId);
  try {
    const targetDb = getFirestore(app), targetAuth = getAuth(app), storage = new PrivateJobStorage();
    const partialDb = getFirestore(partialApp), partialAuth = getAuth(partialApp);
    const partial = { db: partialDb, auth: partialAuth, artifacts: job.artifacts, read: (artifact: Artifact) => storage.get(artifact), currentDeletedUids: new Set([removedUid]) };
    vi.spyOn(partialAuth, 'importUsers').mockRejectedValueOnce(new Error('Interrupted Auth import'));
    await expect(restoreBackup(partial)).rejects.toThrow('Interrupted Auth import');
    expect((await partialDb.doc('posts/retained').get()).exists).toBe(true);
    await expect(restoreBackup(partial)).rejects.toMatchObject({ code: 'APP-RESTORE-TARGET' });
    const manifestFile = job.artifacts.at(-1)!;
    const manifest = JSON.parse((await storage.get(manifestFile)).toString());
    for (const started of [0, Date.now() + 86_400_000]) {
      await expect(restoreBackup({ db: targetDb, auth: targetAuth, artifacts: job.artifacts,
        read: async artifact => artifact.fileId === manifestFile.fileId
          ? Buffer.from(JSON.stringify({ ...manifest, writeWindowStartedAtMs: started })) : storage.get(artifact),
        currentDeletedUids: new Set([removedUid]) })).rejects.toMatchObject({ code: 'APP-DATA-INVALID' });
      expect(await targetDb.listCollections()).toHaveLength(0);
    }
    const result = await restoreBackup({ db: targetDb, auth: targetAuth, artifacts: job.artifacts, read: artifact => storage.get(artifact), currentDeletedUids: new Set([removedUid]) });
    expect(result.appliedDeletions).toBe(2);
    for (const deletedUid of ['legacy-stalled', removedUid]) {
      const lock = (await targetDb.doc('_accountLocks/' + deletedUid).get()).data();
      expect(lock).toEqual({ status: 'deleted', expiresAt: expect.any(Timestamp) });
      expect(lock!.expiresAt.toMillis()).toBeGreaterThan(Date.now());
      const journal = (await targetDb.doc('_deletionJournal/' + deletedUid).get()).data();
      expect(journal!.expiresAt.toMillis()).toBeGreaterThan(lock!.expiresAt.toMillis());
    }
    expect((await targetDb.doc('_arenaAnswerKeys/retained').get()).data()).toEqual({ schemaVersion: 2, authorId: '__deleted__', questions: [] });
    expect((await targetDb.doc('users/' + uid + '/comments/private').get()).data()).toEqual(privateCopy);
    expect((await targetDb.doc('users/legacy-stalled/notes/one').get()).exists).toBe(false);
    expect((await targetDb.doc('_aiGenerations/erased-owner').get()).exists).toBe(false);
    expect(result.community.blocked).toBe(0);
    expect((await targetDb.doc('forumPosts/retained').get()).data()).toMatchObject({ authorId: '__deleted__', authorName: 'Former member', likesCount: 1, privacyVersion: 1 });
    expect((await targetDb.doc('forumPosts/retained').get()).get('likedBy')).toBeUndefined();
    expect((await targetDb.doc('posts/retained').get()).get('constructor')).toBe('legacy');
    expect((await targetDb.doc('_serviceConsents/' + removedUid).get()).exists).toBe(false);
    expect((await targetDb.doc('_serviceConsents/' + uid).get()).get('policyVersion')).toBe('2');
    expect((await targetDb.doc('users/' + uid + '/notes/missing/deep/one').get()).get('text')).toBe('Restore an owned orphan');
    expect((await targetDb.doc('users/' + removedUid + '/notes/one').get()).exists).toBe(false);
    await expect(targetAuth.getUser(removedUid)).rejects.toMatchObject({ code: 'auth/user-not-found' });
    expect((await targetAuth.getUser(uid)).customClaims?.moderator).toBe(true);
    expect((await targetAuth.getUser(uid)).metadata.creationTime).toBe((await getAdminAuth().getUser(uid)).metadata.creationTime);
    expect((await targetDb.doc('posts/retained').get()).data()).toMatchObject({ authorId: '__deleted__', authorName: 'Former member', likedBy: [uid], likesCount: 1 });
    await expect(restoreBackup({ db: targetDb, auth: targetAuth, artifacts: job.artifacts, read: artifact => storage.get(artifact), currentDeletedUids: new Set() })).rejects.toMatchObject({ code: 'APP-RESTORE-TARGET' });
    const backupId = jobs.docs[0].id, sourceProject = getAdminAuth().app.options.projectId!;
    const finalize = () => finalizeRestoredDeletions(db, targetDb, targetAuth, backupId, sourceProject);
    await expect(finalize()).rejects.toThrow('matching completed initial restore');
    await targetDb.doc(RESTORE_MARKER).create({ sourceProject, jobId: backupId, phase: 'restored' });
    const extraPage = targetDb.batch();
    extraPage.set(targetDb.doc('_communityReports/retained-decision'), { reporterId: 'other', decidedBy: uid });
    for (let i = 0; i < 105; i++) extraPage.set(targetDb.doc('users/' + uid + '/notes/item' + i), { text: 'Owned row' });
    await extraPage.commit();
    const requestId = randomUUID();
    const late = await createAccountJob(uid, 'deletion', requestId);
    vi.spyOn(targetAuth, 'deleteUsers').mockRejectedValueOnce(new Error('Temporary Auth outage'));
    await expect(finalize()).rejects.toThrow('Temporary Auth outage');
    expect((await targetDb.doc(RESTORE_MARKER).get()).get('phase')).toBe('reconciling');
    await expect(createAccountJob('another-learner', 'deletion', randomUUID())).rejects.toMatchObject({ status: 503 });
    await expect(finalize()).resolves.toMatchObject({ verified: true });
    expect((await targetDb.doc(RESTORE_MARKER).get()).get('phase')).toBe('verified');
    expect((await targetDb.doc('_communityReports/retained-decision').get()).get('decidedBy')).toBe('__deleted__');
    await expect(createAccountJob('another-learner', 'deletion', randomUUID())).rejects.toMatchObject({ status: 503 });
    expect((await createAccountJob(uid, 'deletion', requestId)).id).toBe(late.id);
    await expect(targetAuth.getUser(uid)).rejects.toMatchObject({ code: 'auth/user-not-found' });
    expect((await targetDb.doc('users/' + uid + '/notes/missing/deep/one').get()).exists).toBe(false);
    expect((await targetDb.doc('_serviceConsents/' + uid).get()).exists).toBe(false);
    expect((await targetDb.doc('posts/retained').get()).get('likedBy')).toEqual([]);
    expect((await targetDb.doc('forumPosts/retained').get()).get('likesCount')).toBe(0);
    expect((await targetDb.collection('users/' + uid + '/notes').limit(1).get()).empty).toBe(true);
    expect((await targetDb.doc('arenaExams/exam/attempts/' + uid).get()).exists).toBe(false);
    expect((await targetDb.doc('arenaExams/exam/rankings/' + rankingId).get()).data()).toMatchObject({ formerMember: true, userName: 'Former member', score: 100 });
    const retainedSession = (await targetDb.doc('users/remaining-author/history/session').get()).data()!;
    expect(retainedSession.content).toBe('Retain this session');
    expect(retainedSession.date.toMillis()).toBe(Date.parse('2026-09-03T12:00:00Z'));
    await expect(finalize()).resolves.toMatchObject({ verified: true, changed: 0 });
    await expect(releaseDeletionCutover(db, backupId, partialId)).rejects.toThrow('another restore');
    await releaseDeletionCutover(db, backupId, targetId);
    await expect(createAccountJob('another-learner', 'deletion', randomUUID())).resolves.toHaveProperty('id');
  } finally { await Promise.all([deleteApp(app), deleteApp(partialApp)]); }
});

it('keeps the backup write barrier until the final checkpoint commits and recovers a lost completion response', async () => {
  const db = getAdminDb();
  vi.stubEnv('ACCOUNT_BACKUPS_ENABLED', 'true');
  await maintenanceSweep();
  const jobs = await db.collection('_accountJobs').where('kind', '==', 'backup').get();
  const id = jobs.docs[0].id, ref = jobs.docs[0].ref;
  let discardedFile: string | undefined;
  for (let step = 0; step < 60; step++) {
    const job = await claimJob(id);
    expect(job).not.toBeNull();
    const result = await backupStep(id, job!);
    if (result.complete) {
      expect((await db.doc('_serviceState/maintenance').get()).get('active')).toBe(true);
      if (!discardedFile) {
        discardedFile = result.artifact!.fileId;
        // Simulate process loss after upload, before the durable completion checkpoint.
        await ref.update({ 'lease.expiresAtMs': Date.now() - 1 });
        await db.doc('_jobWorkerState/lease').delete();
        continue;
      }
      expect(result.artifact!.fileId).toBe(discardedFile);
    }
    await finishStep(id, job!, result);
    if (result.complete) {
      expect((await ref.get()).get('status')).toBe('completed');
      expect((await db.doc('_serviceState/maintenance').get()).get('active')).toBe(false);
      return;
    }
  }
  throw new Error('Backup completion did not recover within the fixture inventory');
});

it('checkpoints a bounded batch of another export artifacts and resumes when the parent checkpoint is lost', async () => {
  const db = getAdminDb(), storage = new PrivateJobStorage();
  const exported = await createAccountJob(uid, 'export', randomUUID());
  const artifacts: Artifact[] = [];
  for (let index = 0; index < 13; index++) {
    artifacts.push(await storage.put('exports/' + exported.id + '/part-' + index + '.enc', Buffer.from(JSON.stringify({ index })), 1, Date.now() + 86_400_000));
  }
  const exportRef = db.doc('_accountJobs/' + exported.id);
  await exportRef.update({ artifacts });
  // A successful upload whose Firestore checkpoint was lost must be removed too.
  await storage.put('exports/' + exported.id + '/orphan.enc', Buffer.from('{"orphan":true}'), 1, Date.now() + 86_400_000);
  const deletion = await createAccountJob(uid, 'deletion', randomUUID());
  const ref = db.doc('_accountJobs/' + deletion.id);
  const phase = 2 + OWNED_RECORDS.findIndex(source => source.action === 'job');
  await ref.update({ cursor: { phase } });
  const first = await claimJob(deletion.id);
  const partial = await deletionStep(deletion.id, first!);
  expect(partial.cursor.phase).toBe(phase);
  const remaining = await storage.listVersions('exports/' + exported.id + '/');
  expect(remaining.length).toBeGreaterThan(0);
  expect(remaining.length).toBeLessThan(artifacts.length + 1);
  expect((await exportRef.get()).get('artifacts')).toEqual(artifacts);
  // Child object checkpoints survive a crash before the parent cursor commits.
  await ref.update({ 'lease.expiresAtMs': Date.now() - 1 });
  await db.doc('_jobWorkerState/lease').delete();
  const second = await claimJob(deletion.id);
  await finishStep(deletion.id, second!, await deletionStep(deletion.id, second!));
  expect((await exportRef.get()).exists).toBe(false);
  expect((await complete(deletion.id)).status).toBe('completed');
  expect(files.size).toBe(0);
});

it('preserves a quota renewed after the expiry query and deletes only still-expired records', async () => {
  const db = getAdminDb(), renewed = db.doc('_aiQuota/renewed'), expired = db.doc('_aiQuota/expired');
  await renewed.set({ expiresAt: new Date(0), used: 0 });
  await expired.set({ expiresAt: new Date(0) });
  const original = db.runTransaction.bind(db);
  let calls = 0;
  vi.spyOn(db, 'runTransaction').mockImplementation(async (...args: Parameters<typeof db.runTransaction>) => {
    if (++calls === 2) await renewed.set({ expiresAt: new Date(Date.now() + 60000), used: 3 });
    return original(...args);
  });
  expect((await maintenanceSweep()).removed).toBe(1);
  expect((await renewed.get()).get('used')).toBe(3);
  expect((await expired.get()).exists).toBe(false);
});
it('cleans Firestore with retention enabled while account jobs and B2 are disabled', async () => {
  vi.stubEnv('ACCOUNT_JOBS_ENABLED', 'false'); vi.stubEnv('RETENTION_ENABLED', 'true');
  vi.stubEnv('B2_APPLICATION_KEY', ''); vi.stubEnv('JOB_ENCRYPTION_KEY', '');
  const ref = getAdminDb().doc('_arenaSessions/expired'); await ref.set({ expiresAt: new Date(0) });
  await maintenanceSweep();
  expect((await ref.get()).exists).toBe(false);
});

it('resumes a terminal deletion with the original lock, receipt and cursor after a fresh confirmation', async () => {
  const db = getAdminDb();
  const original = await createAccountJob(uid, 'deletion', randomUUID());
  const job = (await claimJob(original.id))!;
  await finishStep(original.id, job, { cursor: { phase: 1 }, processed: 2 }, 'APP-EXPORT-LIMIT');
  const barrier = db.doc('_serviceState/maintenance');
  await barrier.set({ active: true, expiresAtMs: Date.now() + 60_000 });
  await expect(createAccountJob(uid, 'deletion', randomUUID())).rejects.toMatchObject({ code: 'APP-MAINTENANCE' });
  await barrier.delete();
  const resumed = await createAccountJob(uid, 'deletion', randomUUID());
  expect(resumed).toMatchObject({ id: original.id, receipt: original.receipt, job: { status: 'queued', cursor: { phase: 1 }, processed: 2 } });
  expect((await db.doc('_accountLocks/' + uid).get()).get('jobId')).toBe(original.id);
  expect((await db.doc('_deletionJournal/' + uid).get()).get('jobId')).toBe(original.id);
  expect((await db.collection('_accountJobs').get()).size).toBe(1);
});

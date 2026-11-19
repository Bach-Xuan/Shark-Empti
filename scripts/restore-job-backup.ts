import { initializeApp, cert, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getAdminAuth, getAdminDb } from '../src/lib/firebase-admin';
import { readJob } from '../src/lib/jobs/types';
import { PrivateJobStorage } from '../src/lib/jobs/storage';
import { restoreBackup } from '../src/lib/jobs/restore';
import { finalizeRestoredDeletions, readErasedOwners, releaseDeletionCutover, RESTORE_MARKER } from '../src/lib/jobs/restore-cutover';

const args = process.argv.slice(2);
const argument = (name: string) => args.find(value => value.startsWith(name + '='))?.slice(name.length + 1);
const id = z.string().uuid().parse(argument('--job')), target = argument('--target');
const finalize = args.includes('--finalize'), release = args.includes('--release-deletion-freeze');
const source = getAdminDb(), sourceProject = getAdminAuth().app.options.projectId;
if (!sourceProject || !target || target === sourceProject || target !== process.env.RESTORE_ADMIN_PROJECT_ID
  || !/(?:restore|staging)/.test(target) || !args.includes('--apply') || (finalize && release)) {
  throw new Error('Specify a distinct isolated target, its dedicated project configuration and one restore operation.');
}
if (release) {
  if (!args.includes('--confirm-reopen-source')) throw new Error('Confirm the decision to reopen source deletion admission.');
  await releaseDeletionCutover(source, id, target);
  console.log(JSON.stringify({ sourceProject, target, sourceDeletionAdmission: 'open' }));
} else {
  const confirmation = finalize ? '--confirm-source-deletion-freeze' : '--confirm-isolated-empty-target';
  if (!args.includes(confirmation)) throw new Error('Missing required confirmation ' + confirmation);
  const job = readJob((await source.collection('_accountJobs').doc(id).get()).data());
  if (job.kind !== 'backup' || job.status !== 'completed' || job.expiresAtMs <= Date.now()) throw new Error('A completed, unexpired backup is required.');
  const app = initializeApp({ projectId: target, credential: cert({ projectId: target, clientEmail: process.env.RESTORE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.RESTORE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n') }) }, 'isolated-restore');
  try {
    const db = getFirestore(app), auth = getAuth(app);
    if (finalize) {
      const result = await finalizeRestoredDeletions(source, db, auth, id, sourceProject);
      console.log(JSON.stringify({ target, ...result, sourceDeletionAdmission: 'held' }));
    } else {
      const storage = new PrivateJobStorage();
      const result = await restoreBackup({ db, auth, artifacts: job.artifacts, read: artifact => storage.get(artifact), currentDeletedUids: await readErasedOwners(source) });
      if (result.community.blocked) throw new Error('Community reconstruction requires review. Keep the target isolated.');
      await db.doc(RESTORE_MARKER).create({ sourceProject, jobId: id, phase: 'restored' });
      console.log(JSON.stringify({ target, ...result, phase: 'restored', finalReconciliationRequired: true }));
    }
  } finally { await deleteApp(app); }
}

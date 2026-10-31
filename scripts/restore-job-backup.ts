import { initializeApp, cert, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldPath } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getAdminDb } from '../src/lib/firebase-admin';
import { readJob } from '../src/lib/jobs/types';
import { PrivateJobStorage } from '../src/lib/jobs/storage';
import { restoreBackup } from '../src/lib/jobs/restore';

const args = process.argv.slice(2), argument = (name: string) => args.find(value => value.startsWith(name + '='))?.slice(name.length + 1);
const id = z.string().uuid().parse(argument('--job')), target = argument('--target');
if (!args.includes('--apply') || !args.includes('--confirm-isolated-empty-target') || !target || target !== process.env.RESTORE_ADMIN_PROJECT_ID
  || target === process.env.FIREBASE_ADMIN_PROJECT_ID || target === process.env.GCLOUD_PROJECT || !/(?:restore|staging)/.test(target)) throw new Error('Specify an explicitly isolated, empty restore target and matching dedicated credentials.');
const source = getAdminDb(), job = readJob((await source.collection('_accountJobs').doc(id).get()).data());
if (job.kind !== 'backup' || job.status !== 'completed' || job.expiresAtMs <= Date.now()) throw new Error('A completed, unexpired backup is required.');
const deleted = new Set<string>();
let after: string | undefined;
for (let page = 0; page < 50; page++) {
  let query = source.collection('_deletionJournal').orderBy(FieldPath.documentId()).limit(100);
  if (after) query = query.startAfter(after);
  const result = await query.get(); result.docs.forEach(document => deleted.add(document.id));
  if (result.size < 100) { after = undefined; break; }
  after = result.docs.at(-1)!.id;
}
if (after) throw new Error('Deletion journal exceeds the bounded restore inventory.');
const app = initializeApp({ projectId: target, credential: cert({ projectId: target, clientEmail: process.env.RESTORE_ADMIN_CLIENT_EMAIL,
  privateKey: process.env.RESTORE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n') }) }, 'isolated-restore-' + Date.now());
try {
  const storage = new PrivateJobStorage();
  const result = await restoreBackup({ db: getFirestore(app), auth: getAuth(app), artifacts: job.artifacts, read: artifact => storage.get(artifact), currentDeletedUids: deleted });
  console.log(JSON.stringify({ target, ...result, acceptance: 'Isolated restore only; production RPO/RTO remain unverified.' }));
} finally { await deleteApp(app); }

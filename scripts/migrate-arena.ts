import { getAdminDb } from '../src/lib/firebase-admin';
import { migrateLegacyArena } from '../src/lib/arena-migration';

async function main() {
  const apply = process.argv.includes('--apply');
  const project = process.argv.find(value => value.startsWith('--project='))?.slice('--project='.length);
  const configured = process.env.GCLOUD_PROJECT || process.env.FIREBASE_ADMIN_PROJECT_ID;
  if (!project || project !== configured) throw new Error('Specify --project=<exact configured project>; no implicit target is allowed.');
  const demo = project === 'demo-shark-empti' && process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if (apply && !demo && !process.argv.includes('--confirm-legacy-practice-only')) throw new Error('Production writes require explicit --confirm-legacy-practice-only after backup/index/Rules review.');
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'read-only', project, ...await migrateLegacyArena(getAdminDb(), apply) }));
}
void main().catch(error => { console.error(error instanceof Error ? error.message : 'Arena migration failed.'); process.exitCode = 1; });

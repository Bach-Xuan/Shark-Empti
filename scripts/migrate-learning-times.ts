import { getAdminAuth, getAdminDb } from '../src/lib/firebase-admin';
import { migrateLearningTimes } from '../src/lib/learning-time-migration';

async function main() {
  const args = process.argv.slice(2);
  const project = args.find(value => value.startsWith('--project='))?.slice('--project='.length);
  const configured = process.env.GCLOUD_PROJECT || process.env.FIREBASE_ADMIN_PROJECT_ID;
  const apply = args.includes('--apply');
  const verify = args.includes('--verify');
  if (verify && apply) throw new Error('Verify the inventory in a separate read-only run after applying.');
  if (!project || project !== configured) throw new Error('Specify --project=<exact configured project>; no implicit target is allowed.');
  const demo = project.startsWith('demo-') && process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if (apply && !demo && !args.includes('--confirm-timestamp-migration')) throw new Error('Remote conversion requires --confirm-timestamp-migration after a backup and dry-run review.');
  const db = getAdminDb();
  if (getAdminAuth().app.options.projectId !== project) throw new Error('The initialized Admin project does not match the explicit target.');
  const result = await migrateLearningTimes(db, apply);
  console.log(JSON.stringify({ mode: apply ? 'apply' : verify ? 'verify' : 'read-only', project, ...result }));
  if (verify && (result.invalid || result.convertible)) process.exitCode = 1;
}
void main().catch(() => { console.error('Learning timestamp migration failed; inspect configuration and migration preconditions.'); process.exitCode = 1; });

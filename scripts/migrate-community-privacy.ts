import { getAdminAuth, getAdminDb } from '../src/lib/firebase-admin';
import { migrateCommunityPrivacy } from '../src/lib/community-privacy-migration';

async function main() {
  const args = process.argv.slice(2), project = args.find(value => value.startsWith('--project='))?.slice('--project='.length);
  const apply = args.includes('--apply'), configured = process.env.GCLOUD_PROJECT || process.env.FIREBASE_ADMIN_PROJECT_ID;
  if (!project || project !== configured) throw new Error('An exact configured project is required.');
  const demo = project.startsWith('demo-') && /^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? '')
    && /^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '');
  if (apply && !demo && !args.includes('--confirm-community-privacy-migration')) throw new Error('Remote conversion requires explicit confirmation after backup and dry-run review.');
  if (getAdminAuth().app.options.projectId !== project) throw new Error('Initialized Admin project does not match the selected project.');
  const result = await migrateCommunityPrivacy(getAdminDb(), apply);
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'read-only', project, ...result }));
  if (result.blocked) process.exitCode = 1;
}
void main().catch(() => { console.error('Community privacy migration stopped; partial work is repeatable. Check target, lease, locks and dry-run results before retrying.'); process.exitCode = 1; });

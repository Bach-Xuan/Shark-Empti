import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fs.realpathSync(fileURLToPath(new URL('../', import.meta.url)));
const base = path.join(root, '.tools', 'tmp');
fs.mkdirSync(base, { recursive: true });
const inside = (parent, child) => { const relative = path.relative(parent, child); return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative); };
if (!inside(root, fs.realpathSync(base))) throw new Error('Restore-drill temporary path escapes the checkout.');
const directory = fs.mkdtempSync(path.join(base, 'restore-drill-'));
const snapshot = path.join(directory, 'snapshot');
const cli = path.join(root, 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');
const env = { ...process.env, GCLOUD_PROJECT: 'demo-shark-empti', NEXT_PUBLIC_USE_EMULATORS: 'true' };
const run = args => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [cli, ...args], { cwd: root, env, stdio: 'inherit', windowsHide: true });
  child.once('error', reject);
  child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Isolated restore stage failed (${code}).`)));
});
function assertNoLinks(target) {
  const stat = fs.lstatSync(target);
  if (stat.isSymbolicLink()) throw new Error('Refusing linked restore-drill cleanup.');
  if (stat.isDirectory()) for (const name of fs.readdirSync(target)) assertNoLinks(path.join(target, name));
}
let complete = false;
try {
  const common = ['emulators:exec', '--project', 'demo-shark-empti', '--only', 'auth,firestore'];
  await run([...common, '--export-on-exit', snapshot, 'node --conditions=react-server --import tsx scripts/restore-drill-step.ts seed']);
  if (!fs.existsSync(path.join(snapshot, 'firebase-export-metadata.json'))) throw new Error('Native Emulator export was not produced.');
  await run([...common, '--import', snapshot, 'node --conditions=react-server --import tsx scripts/restore-drill-step.ts verify']);
  complete = true;
  console.log('Native Auth/Firestore export/import drill passed; this is not a production backup/restore certification.');
} finally {
  if (complete) {
    const resolved = fs.realpathSync(directory);
    if (!inside(fs.realpathSync(base), resolved) || !path.basename(resolved).startsWith('restore-drill-')) throw new Error('Restore cleanup target is outside its generated scope.');
    assertNoLinks(resolved);
    fs.rmSync(resolved, { recursive: true });
    console.log('Removed the generated synthetic restore snapshot.');
  } else console.error(`Synthetic restore snapshot retained for diagnosis: ${directory}`);
}

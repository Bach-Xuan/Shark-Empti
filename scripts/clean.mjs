import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const CLEANUP_TARGETS = {
  build: ['.next'],
  artifacts: ['coverage', 'test-results', 'playwright-report', 'blob-report', 'tmp/pdfs'],
  cache: ['.next/cache', '.next/dev', '.tools/tmp'],
};
const DAY_MS = 24 * 60 * 60 * 1000;
const debugLog = /^(?:firebase|firestore|pubsub|ui)-debug(?:\.[\w-]+)?\.log$/;

function isInside(root, target) {
  const relative = path.relative(root, target);
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}

function inspect(target) {
  const stat = fs.lstatSync(target);
  // rm removes nested links themselves; never inspect or traverse their targets.
  if (stat.isSymbolicLink()) return { bytes: 0, newest: stat.mtimeMs };
  let bytes = stat.isFile() ? stat.size : 0;
  let newest = stat.mtimeMs;
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(target)) {
      const child = inspect(path.join(target, name));
      bytes += child.bytes;
      newest = Math.max(newest, child.newest);
    }
  }
  return { bytes, newest };
}

/** Fixed project-relative scopes only. Reports, credentials, dependencies and
 * installed local runtimes are intentionally outside the cleanup inventory.
 * @param {string} root
 * @param {{ mode: string; olderThanDays?: number; dryRun?: boolean; now?: number; trackedPaths?: string[] }} options
 */
export function cleanGenerated(root, { mode, olderThanDays = 7, dryRun = false, now = Date.now(), trackedPaths = [] }) {
  if (!Object.hasOwn(CLEANUP_TARGETS, mode)) throw new Error('Expected cleanup scope: build, artifacts or cache.');
  if (!Number.isInteger(olderThanDays) || olderThanDays < 0 || olderThanDays > 3650) throw new Error('Retention must be an integer from 0 to 3650 days.');
  const workspace = fs.realpathSync(root);
  const candidates = [...CLEANUP_TARGETS[mode]];
  if (mode === 'artifacts') candidates.push(...fs.readdirSync(workspace).filter(name => debugLog.test(name)));

  // Validate the entire plan before deleting anything.
  const plan = candidates.flatMap(relative => {
    const target = path.resolve(workspace, relative);
    if (!isInside(workspace, target)) throw new Error('Cleanup target escapes the workspace.');
    if (!fs.existsSync(target)) return [];
    if (fs.lstatSync(target).isSymbolicLink()) throw new Error(`Refusing linked artifact root: ${relative}`);
    if (!isInside(workspace, fs.realpathSync(target))) throw new Error(`Artifact resolves outside the workspace: ${relative}`);
    const normalized = relative.replaceAll('\\', '/');
    if (trackedPaths.some(file => file === normalized || file.startsWith(`${normalized}/`))) throw new Error(`Refusing tracked artifact content: ${relative}`);
    const metadata = inspect(target);
    const retained = mode !== 'build' && olderThanDays > 0 && metadata.newest > now - olderThanDays * DAY_MS;
    return [{ path: relative, bytes: metadata.bytes, retained, target }];
  });

  for (const entry of plan) {
    if (!entry.retained && !dryRun) fs.rmSync(entry.target, { recursive: true, force: true });
  }
  return plan.map(entry => ({ path: entry.path, bytes: entry.bytes, retained: entry.retained }));
}

function main() {
  const [mode, ...flags] = process.argv.slice(2);
  let olderThanDays = 7;
  let dryRun = false;
  for (const flag of flags) {
    if (flag === '--dry-run') dryRun = true;
    else if (/^--older-than-days=\d+$/.test(flag)) olderThanDays = Number(flag.split('=')[1]);
    else throw new Error(`Unknown cleanup option: ${flag}`);
  }
  const root = fileURLToPath(new URL('../', import.meta.url));
  const trackedPaths = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  const entries = cleanGenerated(root, { mode, olderThanDays, dryRun, trackedPaths });
  for (const entry of entries) {
    const action = entry.retained ? 'Retained (recent)' : dryRun ? 'Would remove' : 'Removed';
    console.log(`${action}: ${entry.path} (${(entry.bytes / 1024 / 1024).toFixed(1)} MiB)`);
  }
  const selected = entries.filter(entry => !entry.retained);
  console.log(`${dryRun ? 'Selected' : 'Removed'} ${selected.length} artifact paths; ${(selected.reduce((sum, entry) => sum + entry.bytes, 0) / 1024 / 1024).toFixed(1)} MiB. Reports and installed runtimes retained.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); }
  catch (error) { console.error(error instanceof Error ? error.message : 'Artifact cleanup failed.'); process.exitCode = 1; }
}

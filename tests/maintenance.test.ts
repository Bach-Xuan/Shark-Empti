// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { afterEach, expect, it } from 'vitest';
import { cleanGenerated } from '../scripts/clean.mjs';
import { readPerformanceBuild, requireMatchingDependencies } from '../scripts/lib/performance-build.mjs';
import { DEMO_ENV, verificationBuildId, requireDemoBuild, requireLocalEmulators } from '../scripts/lib/demo-build.mjs';

const roots: string[] = [];
const tempRoot = fs.realpathSync(os.tmpdir());
function fixture() {
  const root = fs.mkdtempSync(path.join(tempRoot, 'shark-maintenance-test-'));
  roots.push(root);
  return root;
}
function write(root: string, relative: string) {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, 'fixture');
}
function ageTree(target: string) {
  if (fs.lstatSync(target).isDirectory()) {
    for (const name of fs.readdirSync(target)) ageTree(path.join(target, name));
  }
  const old = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
  fs.utimesSync(target, old, old);
}
afterEach(() => {
  for (const root of roots.splice(0)) {
    if (path.dirname(root) !== tempRoot || !path.basename(root).startsWith('shark-maintenance-test-')) throw new Error('Unexpected fixture cleanup path');
    fs.rmSync(root, { recursive: true, force: true });
  }
});

it('keeps a dry run non-mutating and preserves reports, credentials and installed runtimes', () => {
  const root = fixture();
  for (const file of ['coverage/old.html', 'reports/evidence.json', '.env', '.tools/java/runtime', 'node_modules/package/index.js']) write(root, file);
  ageTree(root);
  const selected = cleanGenerated(root, { mode: 'artifacts', dryRun: true });
  expect(selected).toMatchObject([{ path: 'coverage', retained: false }]);
  for (const file of ['coverage/old.html', 'reports/evidence.json', '.env', '.tools/java/runtime', 'node_modules/package/index.js']) expect(fs.existsSync(path.join(root, file))).toBe(true);
});

it('removes old artifact runs but retains a directory containing a recent failure', () => {
  const root = fixture();
  write(root, 'coverage/old.html');
  write(root, 'test-results/old.txt');
  ageTree(root);
  write(root, 'test-results/recent-trace.zip');
  const entries = cleanGenerated(root, { mode: 'artifacts' });
  expect(entries.find(entry => entry.path === 'test-results')?.retained).toBe(true);
  expect(fs.existsSync(path.join(root, 'coverage'))).toBe(false);
  expect(fs.existsSync(path.join(root, 'test-results/recent-trace.zip'))).toBe(true);
});

it('validates all targets before deletion and refuses tracked generated content', () => {
  const root = fixture();
  write(root, 'coverage/old.html');
  write(root, 'test-results/fixture.txt');
  ageTree(root);
  expect(() => cleanGenerated(root, { mode: 'artifacts', trackedPaths: ['test-results/fixture.txt'] })).toThrow('Refusing tracked');
  expect(fs.existsSync(path.join(root, 'coverage/old.html'))).toBe(true);
});

it('refuses a linked artifact root without touching the linked directory', () => {
  const root = fixture();
  const outside = fixture();
  write(root, 'coverage/old.html');
  write(outside, 'keep.txt');
  ageTree(root);
  fs.symlinkSync(outside, path.join(root, 'test-results'), process.platform === 'win32' ? 'junction' : 'dir');
  expect(() => cleanGenerated(root, { mode: 'artifacts' })).toThrow(/linked artifact root|outside the workspace/);
  expect(fs.existsSync(path.join(outside, 'keep.txt'))).toBe(true);
  expect(fs.existsSync(path.join(root, 'coverage/old.html'))).toBe(true);
  fs.unlinkSync(path.join(root, 'test-results'));
});

it('removes a generated build containing a nested link without traversing that link', () => {
  const root = fixture();
  const outside = fixture();
  write(root, '.next/server/page.js');
  write(outside, 'keep.txt');
  fs.symlinkSync(outside, path.join(root, '.next/external'), process.platform === 'win32' ? 'junction' : 'dir');
  cleanGenerated(root, { mode: 'build' });
  expect(fs.existsSync(path.join(root, '.next'))).toBe(false);
  expect(fs.readFileSync(path.join(outside, 'keep.txt'), 'utf8')).toBe('fixture');
});

it('rejects arbitrary cleanup scopes and invalid retention', () => {
  const root = fixture();
  expect(() => cleanGenerated(root, { mode: '../' })).toThrow('cleanup scope');
  expect(() => cleanGenerated(root, { mode: 'artifacts', olderThanDays: -1 })).toThrow('Retention');
});

it('lets an explicit zero-day override remove even future-dated generated files', () => {
  const root = fixture();
  write(root, 'coverage/new.html');
  const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
  fs.utimesSync(path.join(root, 'coverage/new.html'), future, future);
  expect(cleanGenerated(root, { mode: 'artifacts', olderThanDays: 0 })).toMatchObject([{ path: 'coverage', retained: false }]);
  expect(fs.existsSync(path.join(root, 'coverage'))).toBe(false);
});

it('keeps package, documentation, compiler and ignore contracts consistent', () => {
  const output = execFileSync(process.execPath, ['scripts/check-maintenance.mjs'], { encoding: 'utf8', timeout: 30000, windowsHide: true });
  expect(output).toContain('Maintenance contracts passed');
}, 35000);

it('reads dependency provenance from each measured checkout and rejects different graphs', () => {
  const baseline = fixture();
  const current = fixture();
  for (const root of [baseline, current]) {
    write(root, '.next/BUILD_ID');
    write(root, 'node_modules/.package-lock.json');
  }
  expect(() => requireMatchingDependencies(readPerformanceBuild(baseline), readPerformanceBuild(current))).not.toThrow();
  fs.writeFileSync(path.join(baseline, 'node_modules/.package-lock.json'), 'different dependency graph');
  expect(readPerformanceBuild(baseline).root).toBe(baseline);
  expect(() => requireMatchingDependencies(readPerformanceBuild(baseline), readPerformanceBuild(current))).toThrow('dependency locks differ');
});

it('rejects an incomplete performance fixture before starting measurement', () => {
  const root = fixture();
  expect(() => readPerformanceBuild(root)).toThrow('production build');
  write(root, '.next/BUILD_ID');
  expect(() => readPerformanceBuild(root)).toThrow('installed dependency lock');
});

it('accepts only a demo build tied to its current source and dependency inputs', () => {
  const root = fixture();
  write(root, 'src/app/page.tsx');
  write(root, '.next/BUILD_ID');
  fs.writeFileSync(path.join(root, '.next/BUILD_ID'), verificationBuildId(root, { ...process.env, ...DEMO_ENV }));
  expect(() => requireDemoBuild(root)).not.toThrow();
  fs.writeFileSync(path.join(root, 'src/app/page.tsx'), 'changed after build');
  expect(() => requireDemoBuild(root)).toThrow('stale');
});

it('rejects non-demo, old-format and missing builds despite runtime demo variables', () => {
  const root = fixture();
  expect(() => requireDemoBuild(root)).toThrow('required');
  write(root, '.next/BUILD_ID');
  fs.writeFileSync(path.join(root, '.next/BUILD_ID'), verificationBuildId(root, { ...process.env, ...DEMO_ENV, NEXT_PUBLIC_USE_EMULATORS: 'false' }));
  expect(() => requireDemoBuild(root)).toThrow('non-demo');
  fs.writeFileSync(path.join(root, '.next/BUILD_ID'), 'historical-unverified-build');
  expect(() => requireDemoBuild(root)).toThrow('unverified');
});

it('rejects linked build inputs instead of hashing files outside the checkout', () => {
  const root = fixture();
  const outside = fixture();
  write(outside, 'file.ts');
  fs.symlinkSync(outside, path.join(root, 'src'), process.platform === 'win32' ? 'junction' : 'dir');
  expect(() => verificationBuildId(root)).toThrow('Linked build input');
  fs.unlinkSync(path.join(root, 'src'));
});

it('requires both configured loopback Emulators and rejects non-demo projects', () => {
  const env = { ...process.env, FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099', GCLOUD_PROJECT: 'demo-shark-empti' };
  expect(() => requireLocalEmulators(env)).not.toThrow();
  expect(() => requireLocalEmulators({ ...env, FIRESTORE_EMULATOR_HOST: 'production.example:8080' })).toThrow('local demo');
  expect(() => requireLocalEmulators({ ...env, GCLOUD_PROJECT: 'production-project' })).toThrow('demo-shark-empti');
});

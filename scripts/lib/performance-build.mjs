import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

/** Read build identity and dependency metadata, not compiled demo configuration. */
export function readPerformanceBuild(root) {
  const directory = path.resolve(root);
  const build = path.join(directory, '.next/BUILD_ID');
  const lock = path.join(directory, 'node_modules/.package-lock.json');
  if (!fs.existsSync(build)) throw new Error(`A production build is required in ${directory}`);
  if (!fs.existsSync(lock)) throw new Error(`The measured checkout needs an installed dependency lock: ${directory}`);
  return {
    root: directory,
    buildId: fs.readFileSync(build, 'utf8').trim(),
    installedDependencyLockSha256: createHash('sha256').update(fs.readFileSync(lock)).digest('hex'),
  };
}

export function requireMatchingDependencies(baseline, current) {
  if (baseline.installedDependencyLockSha256 !== current.installedDependencyLockSha256) {
    throw new Error('Baseline and current installed dependency locks differ; normalize them before measuring.');
  }
}

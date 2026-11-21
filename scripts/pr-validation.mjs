import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const sharedDirectories = ['src/lib/', 'src/ai/', 'src/app/api/', 'scripts/', 'config/', '.github/workflows/', 'tests/fixtures/'];
const sharedFiles = new Set(['package.json', 'package-lock.json', 'firebase.json', 'firestore.rules',
  'firestore.indexes.json', '.nvmrc', 'tsconfig.json', 'vitest.config.mts', 'vitest.integration.config.mts']);

export function selectPrChecks(paths) {
  let integration = false;
  for (const path of paths) {
    // Storage, migrations and restore share record readers, schemas and job helpers.
    if (sharedFiles.has(path) || sharedDirectories.some(prefix => path.startsWith(prefix))) {
      return { integration: true, restore: true };
    }
    if (path.startsWith('src/firebase/') || path.startsWith('tests/integration/') || path === 'tests/firebase.rules.test.ts') {
      integration = true;
    }
  }
  return { integration, restore: false };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // On pull_request, checkout uses the synthetic merge commit. Its first parent is the PR base.
  const changes = execFileSync('git', ['diff', '--name-only', '--no-renames', '-z', 'HEAD^1', 'HEAD'], { encoding: 'utf8' });
  const checks = selectPrChecks(changes.split('\0').filter(Boolean));
  appendFileSync(process.env.GITHUB_OUTPUT, `integration=${checks.integration}\nrestore=${checks.restore}\n`);
}

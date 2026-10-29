import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DEMO_ENV } from './lib/demo-build.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const result = spawnSync(process.execPath, ['node_modules/next/dist/bin/next', 'build'], {
  cwd: root, windowsHide: true, stdio: 'inherit',
  env: { ...process.env, ...DEMO_ENV, NEXT_TELEMETRY_DISABLED: '1', OPENROUTER_API_KEY: '', AI_GENERATION_PROTOCOL_ENABLED: 'false' },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;

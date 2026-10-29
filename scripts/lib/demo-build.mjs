import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export const DEMO_ENV = Object.freeze({
  NEXT_PUBLIC_USE_EMULATORS: 'true',
  NEXT_PUBLIC_FIREBASE_API_KEY: 'test-api-key',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'demo-shark-empti',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'demo-shark-empti.firebaseapp.com',
  NEXT_PUBLIC_FIREBASE_APP_ID: 'demo-app',
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'demo-shark-empti.appspot.com',
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '123456',
});

const buildInputs = [
  'src', 'public', 'package.json', 'package-lock.json', 'next.config.ts',
  'tsconfig.json', 'tailwind.config.mts', 'postcss.config.mjs', 'scripts/lib/demo-build.mjs',
];

/** Hash only build inputs, never credentials, Git internals or generated output. */
export function buildFingerprint(root) {
  const hash = createHash('sha256');
  const visit = relative => {
    const absolute = path.join(root, relative);
    if (!fs.existsSync(absolute)) return;
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) throw new Error(`Linked build input is not supported: ${relative}`);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(absolute).sort()) visit(`${relative}/${name}`);
    } else if (stat.isFile()) {
      hash.update(`${relative}\0${stat.size}\0`);
      hash.update(fs.readFileSync(absolute));
    }
  };
  for (const input of buildInputs) visit(input);
  return hash.digest('hex').slice(0, 32);
}

/** Next calls this after loading build-time .env values, before compilation. */
export function verificationBuildId(root, env = process.env) {
  const demo = Object.entries(DEMO_ENV).every(([name, value]) => env[name] === value);
  return `shark-${demo ? 'demo' : 'app'}-v1-${buildFingerprint(root)}-${randomUUID()}`;
}

export function requireDemoBuild(root) {
  const file = path.join(root, '.next/BUILD_ID');
  if (!fs.existsSync(file)) throw new Error('A verified demo production build is required; build with the documented demo environment first.');
  const id = fs.readFileSync(file, 'utf8').trim();
  const expected = `shark-demo-v1-${buildFingerprint(root)}-`;
  if (!id.startsWith(expected) || !/^[\da-f-]{36}$/.test(id.slice(expected.length))) {
    throw new Error('Refusing a non-demo, stale or unverified production build. Rebuild with the demo environment.');
  }
}

export function requireLocalEmulators(env = process.env) {
  for (const [name, port] of [['FIRESTORE_EMULATOR_HOST', '8080'], ['FIREBASE_AUTH_EMULATOR_HOST', '9099']]) {
    if (![ `127.0.0.1:${port}`, `localhost:${port}` ].includes(env[name])) throw new Error(`${name} must identify the configured local demo Emulator.`);
  }
  if (env.GCLOUD_PROJECT && env.GCLOUD_PROJECT !== 'demo-shark-empti') throw new Error('Verification requires the demo-shark-empti project.');
}

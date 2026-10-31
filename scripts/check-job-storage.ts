import { randomUUID } from 'node:crypto';
import { PrivateJobStorage } from '../src/lib/jobs/storage';
import { digest } from '../src/lib/jobs/crypto';

if (!process.argv.includes('--confirm-synthetic-remote')) throw new Error('Explicit synthetic remote-storage verification is required.');
const storage = new PrivateJobStorage(), id = randomUUID(), bytes = Buffer.from('{"fixture":"synthetic-only","language":"Tiếng Việt"}');
const name = 'exports/' + id + '/' + digest(bytes) + '.enc';
let complete = false;
try {
  const artifact = await storage.put(name, bytes, 1, Date.now() + 3_600_000);
  if (!(await storage.get(artifact)).equals(bytes)) throw new Error('Integrity verification failed.');
  complete = true;
} finally {
  for (const file of await storage.listVersions(name)) await storage.remove(file);
  if ((await storage.listVersions(name)).length) throw new Error('Synthetic object cleanup failed.');
}
if (complete) console.log('Private encrypted upload/download/delete fixture passed; no account data was used.');

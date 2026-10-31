import 'server-only';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { jobSecret, JOB_LIMITS } from './config';

const MAGIC = Buffer.from('SHARK-JOB-1\n');
const key = () => Buffer.from(jobSecret('JOB_ENCRYPTION_KEY'), 'base64');
export const digest = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
export function receiptFor(id: string, uid: string) {
  return createHmac('sha256', key()).update(JSON.stringify(['deletion-receipt', id, uid])).digest('base64url');
}
export function matchesReceipt(value: string, expectedHash: string) {
  const actual = Buffer.from(digest(value));
  const expected = Buffer.from(expectedHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Filename is authenticated too: ciphertext cannot be moved between jobs/parts. */
export function encryptArtifact(data: Buffer, name: string): Buffer {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), nonce);
  cipher.setAAD(Buffer.from(name));
  const ciphertext = Buffer.concat([cipher.update(gzipSync(data)), cipher.final()]);
  return Buffer.concat([MAGIC, nonce, cipher.getAuthTag(), ciphertext]);
}
export function decryptArtifact(data: Buffer, name: string): Buffer {
  if (!data.subarray(0, MAGIC.length).equals(MAGIC) || data.length < MAGIC.length + 28) throw new Error('Invalid encrypted artifact');
  const offset = MAGIC.length;
  const cipher = createDecipheriv('aes-256-gcm', key(), data.subarray(offset, offset + 12));
  cipher.setAAD(Buffer.from(name));
  cipher.setAuthTag(data.subarray(offset + 12, offset + 28));
  return gunzipSync(Buffer.concat([cipher.update(data.subarray(offset + 28)), cipher.final()]), { maxOutputLength: JOB_LIMITS.objectBytes });
}

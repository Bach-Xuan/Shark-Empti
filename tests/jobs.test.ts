// @vitest-environment node
import { createHmac, createHash } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { encryptArtifact, decryptArtifact, receiptFor, matchesReceipt, digest } from '@/lib/jobs/crypto';
import { requireJobs } from '@/lib/jobs/config';
import { verifyJobSignature } from '@/lib/jobs/queue';
import { redactExport } from '@/lib/jobs/catalog';
import { jobIdFor } from '@/lib/jobs/store';
import { parsePreferences } from '@/lib/preferences';

beforeEach(() => {
  for (const [key, value] of Object.entries({ ACCOUNT_JOBS_ENABLED: 'true', JOB_ENVIRONMENT: 'staging', JOBS_BASE_URL: 'https://staging.example.invalid',
    QSTASH_TOKEN: 'test', QSTASH_CURRENT_SIGNING_KEY: 'current-test-signing-key', QSTASH_NEXT_SIGNING_KEY: 'next-test-signing-key',
    B2_KEY_ID: 'test', B2_APPLICATION_KEY: 'test', B2_BUCKET_ID: 'bucket', JOB_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64') })) vi.stubEnv(key, value);
});
afterEach(() => vi.unstubAllEnvs());

it('authenticates encrypted artifact contents and their filename; detects tampering', () => {
  const source = Buffer.from('{"text":"Tiếng Việt — dữ liệu riêng"}');
  const first = encryptArtifact(source, 'part-a'), second = encryptArtifact(source, 'part-a');
  expect(first.equals(second)).toBe(false);
  expect(decryptArtifact(first, 'part-a').equals(source)).toBe(true);
  expect(() => decryptArtifact(first, 'part-b')).toThrow();
  first[first.length - 1] ^= 1;
  expect(() => decryptArtifact(first, 'part-a')).toThrow();
});
it('scopes minimal receipts and stable request IDs to their owner without exposing UID', () => {
  const id = jobIdFor('user-one:request');
  expect(id).toMatch(/^[a-f0-9-]{36}$/);
  expect(jobIdFor('user-two:request')).not.toBe(id);
  const receipt = receiptFor(id, 'user-one');
  expect(matchesReceipt(receipt, digest(receipt))).toBe(true);
  expect(matchesReceipt(receiptFor(id, 'user-two'), digest(receipt))).toBe(false);
});
it('verifies QStash raw body, destination, expiration and either signing key', async () => {
  const body = JSON.stringify({ jobId: jobIdFor('test'), environment: 'staging' });
  const sign = (key: string, sub = requireJobs().workerUrl, exp = Math.floor(Date.now() / 1000) + 30) => {
    const head = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url');
    const claims = Buffer.from(JSON.stringify({ iss: 'Upstash', sub, exp, nbf: Math.floor(Date.now() / 1000) - 5, body: createHash('sha256').update(body).digest('base64url') })).toString('base64url');
    return head + '.' + claims + '.' + createHmac('sha256', key).update(head + '.' + claims).digest('base64url');
  };
  await expect(verifyJobSignature(body, sign('current-test-signing-key'))).resolves.toBeUndefined();
  await expect(verifyJobSignature(body, sign('next-test-signing-key'))).resolves.toBeUndefined();
  const retentionSignature = sign('current-test-signing-key');
  vi.stubEnv('ACCOUNT_JOBS_ENABLED', 'false'); vi.stubEnv('RETENTION_ENABLED', 'true'); vi.stubEnv('B2_APPLICATION_KEY', '');
  await expect(verifyJobSignature(body, retentionSignature)).resolves.toBeUndefined();
  await expect(verifyJobSignature(body, null)).rejects.toMatchObject({ status: 403 });
  vi.stubEnv('ACCOUNT_JOBS_ENABLED', 'true'); vi.stubEnv('B2_APPLICATION_KEY', 'test');
  await expect(verifyJobSignature(body + ' ', sign('current-test-signing-key'))).rejects.toMatchObject({ status: 403 });
  await expect(verifyJobSignature(body, sign('current-test-signing-key', 'https://other.invalid'))).rejects.toMatchObject({ status: 403 });
  await expect(verifyJobSignature(body, sign('current-test-signing-key', undefined, 1))).rejects.toMatchObject({ status: 403 });
});
it('fails closed when disabled, keys are invalid, or a worker origin includes credentials/path', () => {
  expect(requireJobs().storageBytes).toBe(1_000_000_000);
  vi.stubEnv('JOBS_BASE_URL', 'https://user:secret@staging.example.invalid/path');
  expect(() => requireJobs()).toThrow();
  vi.stubEnv('ACCOUNT_JOBS_ENABLED', 'false');
  expect(() => requireJobs()).toThrow();
});
it('does not export other members IDs, reaction membership or credentials', () => {
  expect(redactExport({ authorId: 'owner', likedBy: ['owner', 'other'], refreshToken: 'secret', nested: { reporterId: 'other', text: 'Own writing' } }, 'owner'))
    .toEqual({ authorId: 'owner', likedBy: ['owner'], nested: { text: 'Own writing' } });
});
it('rejects malformed preference cookies including trailing or additional segments', () => {
  expect(parsePreferences('v1.vi.dark')).toEqual({ lang: 'vi', theme: 'dark' });
  for (const value of ['v1.en.light.', 'v1.en.light..extra', 'v2.vi.dark', 'v1.fr.dark']) expect(parsePreferences(value)).toBeNull();
});

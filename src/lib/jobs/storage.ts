import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { ApiError } from '../server-api';
import { readLimitedBytes } from '../server-json';
import { fixtureOrigin, jobSecret, JOB_LIMITS, requireJobs } from './config';
import { decryptArtifact, digest, encryptArtifact } from './crypto';
import type { Artifact } from './types';

const fileSchema = z.object({
  fileId: z.string(), fileName: z.string(), contentLength: z.number().nonnegative(),
  action: z.string().optional(), uploadTimestamp: z.number().optional(),
  fileInfo: z.record(z.string(), z.string()).optional(),
});
type FileVersion = z.infer<typeof fileSchema>;
type Authorization = { token: string; apiUrl: string; downloadUrl: string };

function trustedUrl(value: string) {
  const url = new URL(value);
  const fixture = fixtureOrigin();
  if (fixture && url.origin === fixture) return url.href;
  if (url.protocol !== 'https:' || url.username || url.password
    || !['backblaze.com', 'backblazeb2.com'].some(domain => url.hostname === domain || url.hostname.endsWith('.' + domain))) {
    throw new ApiError('ACCOUNT-STORAGE-UNAVAILABLE', 503, 'Private storage is unavailable.');
  }
  return url.href;
}
async function bytes(response: Response, signal: AbortSignal) {
  if (!response.ok) throw new ApiError(response.status === 429 || response.status === 403 ? 'ACCOUNT-STORAGE-QUOTA' : 'ACCOUNT-STORAGE-UNAVAILABLE', 503, 'Private storage is unavailable.');
  const request = new Request('https://storage.invalid/body', { method: 'POST', body: response.body, headers: response.headers, signal, duplex: 'half' } as RequestInit);
  return Buffer.from(await readLimitedBytes(request, JOB_LIMITS.objectBytes));
}
async function jsonResponse(response: Response, signal: AbortSignal): Promise<unknown> {
  return JSON.parse((await bytes(response, signal)).toString('utf8'));
}

/** Native B2 API; no public bucket, master key, or browser-side storage credential. */
export class PrivateJobStorage {
  private authorization: Promise<Authorization> | undefined;
  private authorize(): Promise<Authorization> {
    return this.authorization ??= (async () => {
      requireJobs();
      const signal = AbortSignal.timeout(10_000);
      const base = fixtureOrigin() ?? 'https://api.backblazeb2.com';
      const response = await fetch(base + '/b2api/v4/b2_authorize_account', {
        headers: { Authorization: 'Basic ' + Buffer.from(jobSecret('B2_KEY_ID') + ':' + jobSecret('B2_APPLICATION_KEY')).toString('base64') }, signal,
      });
      const value = z.object({ authorizationToken: z.string(), apiInfo: z.object({ storageApi: z.object({
        apiUrl: z.string(), downloadUrl: z.string(), allowed: z.object({
          buckets: z.array(z.object({ id: z.string(), name: z.string() })).nullable(),
          namePrefix: z.string().nullable().optional(), capabilities: z.array(z.string()),
        }),
      }) }) }).parse(await jsonResponse(response, signal));
      const storage = value.apiInfo.storageApi;
      const bucket = jobSecret('B2_BUCKET_ID');
      // Account-wide keys prevent a meaningful free-tier inventory and are refused.
      if (!storage.allowed.buckets || storage.allowed.buckets.length !== 1 || storage.allowed.buckets[0].id !== bucket
        || storage.allowed.namePrefix || !['listFiles', 'readFiles', 'writeFiles', 'deleteFiles'].every(capability => storage.allowed.capabilities.includes(capability))) {
        throw new ApiError('ACCOUNT-STORAGE-UNAVAILABLE', 503, 'A dedicated bucket-scoped storage key is required.');
      }
      return { token: value.authorizationToken, apiUrl: trustedUrl(storage.apiUrl), downloadUrl: trustedUrl(storage.downloadUrl) };
    })();
  }
  private async call(operation: string, body: object) {
    const auth = await this.authorize();
    const signal = AbortSignal.timeout(10_000);
    const response = await fetch(auth.apiUrl.replace(/\/$/, '') + '/b2api/v3/' + operation, {
      method: 'POST', headers: { Authorization: auth.token, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal,
    });
    return jsonResponse(response, signal);
  }
  async listVersions(prefix = ''): Promise<FileVersion[]> {
    const files: FileVersion[] = [];
    let cursor: { startFileName: string; startFileId: string } | undefined;
    const seen = new Set<string>();
    for (let page = 0; page < 20; page++) {
      const result = z.object({ files: z.array(fileSchema), nextFileName: z.string().nullable(), nextFileId: z.string().nullable() }).parse(
        await this.call('b2_list_file_versions', { bucketId: jobSecret('B2_BUCKET_ID'), maxFileCount: 1000, prefix, ...cursor }),
      );
      if (result.files.some(file => !file.fileName.startsWith(prefix))) throw new ApiError('APP-DATA-INVALID', 502, 'Storage returned an invalid inventory.');
      files.push(...result.files);
      if (!result.nextFileName || !result.nextFileId) return files;
      const next = JSON.stringify([result.nextFileName, result.nextFileId]);
      if (seen.has(next)) break;
      seen.add(next); cursor = { startFileName: result.nextFileName, startFileId: result.nextFileId };
    }
    throw new ApiError('ACCOUNT-STORAGE-QUOTA', 503, 'Storage inventory exceeds its bounded capacity.');
  }
  async put(name: string, plaintext: Buffer, records: number, expiresAtMs: number): Promise<Artifact> {
    const config = requireJobs();
    if (!/^(exports|backups)\/[a-f0-9-]{36}\/[a-z0-9-]+\.enc$/.test(name) || plaintext.length > JOB_LIMITS.objectBytes) throw new ApiError('APP-INVALID-INPUT', 400, 'Invalid artifact.');
    const previous = (await this.listVersions(name)).find(file => file.fileName === name && file.action === 'upload');
    const plaintextHash = digest(plaintext);
    if (previous) {
      if (previous.fileInfo?.plaintext !== plaintextHash || !/^[a-f0-9]{64}$/.test(previous.fileInfo?.sha256 ?? '')) throw new ApiError('APP-REQUEST-CONFLICT', 409, 'Artifact identity conflict.');
      return { fileId: previous.fileId, name, bytes: previous.contentLength, sha256: previous.fileInfo!.sha256, plaintextSha256: plaintextHash, records, expiresAtMs };
    }
    const encrypted = encryptArtifact(plaintext, name);
    const used = (await this.listVersions()).reduce((sum, file) => sum + file.contentLength, 0);
    if (used + encrypted.length > config.storageBytes) throw new ApiError('ACCOUNT-STORAGE-QUOTA', 503, 'Private storage has reached its configured free-tier allowance.');
    const upload = z.object({ uploadUrl: z.string(), authorizationToken: z.string() }).parse(await this.call('b2_get_upload_url', { bucketId: jobSecret('B2_BUCKET_ID') }));
    const sha256 = digest(encrypted);
    const signal = AbortSignal.timeout(10_000);
    const response = await fetch(trustedUrl(upload.uploadUrl), {
      method: 'POST', headers: { Authorization: upload.authorizationToken, 'Content-Type': 'application/octet-stream',
        'X-Bz-File-Name': encodeURIComponent(name), 'X-Bz-Content-Sha1': createHash('sha1').update(encrypted).digest('hex'),
        'X-Bz-Info-plaintext': plaintextHash, 'X-Bz-Info-sha256': sha256, 'X-Bz-Info-expires': String(expiresAtMs) }, body: new Uint8Array(encrypted), signal,
    });
    const result = fileSchema.parse(await jsonResponse(response, signal));
    if (result.fileName !== name || result.contentLength !== encrypted.length) throw new ApiError('ACCOUNT-STORAGE-UNAVAILABLE', 503, 'Private storage returned an invalid artifact.');
    return { fileId: result.fileId, name, bytes: encrypted.length, sha256, plaintextSha256: plaintextHash, records, expiresAtMs };
  }
  async get(artifact: Artifact) {
    const auth = await this.authorize();
    const signal = AbortSignal.timeout(10_000);
    const url = new URL('/b2api/v3/b2_download_file_by_id', auth.downloadUrl);
    url.searchParams.set('fileId', artifact.fileId);
    const data = await bytes(await fetch(url, { headers: { Authorization: auth.token }, signal }), signal);
    if (data.length !== artifact.bytes || digest(data) !== artifact.sha256) throw new ApiError('APP-DATA-INVALID', 502, 'Artifact integrity check failed.');
    const plaintext = decryptArtifact(data, artifact.name);
    if (digest(plaintext) !== artifact.plaintextSha256) throw new ApiError('APP-DATA-INVALID', 502, 'Artifact integrity check failed.');
    return plaintext;
  }
  async remove(file: Pick<FileVersion, 'fileId' | 'fileName'>) {
    try { await this.call('b2_delete_file_version', { fileId: file.fileId, fileName: file.fileName }); }
    catch (error) {
      // A replay after successful deletion can see an absent object; re-list to confirm.
      if ((await this.listVersions(file.fileName)).some(item => item.fileId === file.fileId)) throw error;
    }
  }
  async removeExpired(limit = JOB_LIMITS.maintenanceDeletes) {
    const expired = (await this.listVersions()).filter(file => Number(file.fileInfo?.expires) > 0 && Number(file.fileInfo?.expires) <= Date.now()).slice(0, limit);
    for (const file of expired) await this.remove(file);
    const unfinished = z.object({ files: z.array(z.object({ fileId: z.string(), uploadTimestamp: z.number() })) }).parse(
      await this.call('b2_list_unfinished_large_files', { bucketId: jobSecret('B2_BUCKET_ID'), maxFileCount: 100 }),
    );
    for (const file of unfinished.files.filter(file => file.uploadTimestamp < Date.now() - 3_600_000).slice(0, Math.max(0, limit - expired.length))) {
      await this.call('b2_cancel_large_file', { fileId: file.fileId });
    }
    return expired.length;
  }
}

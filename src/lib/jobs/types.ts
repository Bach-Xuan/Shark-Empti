import { z } from 'zod';

export const jobKinds = ['export', 'deletion', 'backup'] as const;
export type JobKind = typeof jobKinds[number];
export const jobStatuses = ['queued', 'running', 'waiting_quota', 'ready', 'completed', 'failed'] as const;
export type JobStatus = typeof jobStatuses[number];
export const jobRequestSchema = z.object({
  kind: z.enum(['export', 'deletion']), requestId: z.string().uuid(),
  confirmDeletion: z.boolean().optional(),
}).strict();
export const jobMessageSchema = z.object({
  jobId: z.union([z.string().uuid(), z.literal('maintenance')]),
  environment: z.enum(['staging', 'production', 'test']),
}).strict();
export type JobMessage = z.infer<typeof jobMessageSchema>;

export type Artifact = { fileId: string; name: string; bytes: number; sha256: string; plaintextSha256: string; records: number; expiresAtMs: number };
export type JobCursor = { phase: number; after?: string; collections?: string[]; collectionIndex?: number; pending?: string[] };
export type StepResult = { cursor: JobCursor; processed: number; artifact?: Artifact; complete?: boolean };
export type JobRecord = {
  kind: JobKind; ownerUid?: string; status: JobStatus; environment: JobMessage['environment'];
  cursor: JobCursor; artifacts: Artifact[]; processed: number; receiptHash?: string;
  createdAtMs: number; updatedAtMs: number; expiresAtMs: number; nextRunAtMs: number;
  lease?: { id: string; expiresAtMs: number }; errorCode?: string;
};
export type JobView = {
  id: string; kind: JobKind; status: JobStatus; processed: number; parts: number;
  expiresAtMs: number; errorCode?: string;
};
export function jobView(id: string, job: JobRecord): JobView {
  return { id, kind: job.kind, status: job.status, processed: job.processed,
    parts: job.kind === 'export' && job.status === 'ready' ? job.artifacts.length : 0,
    expiresAtMs: job.expiresAtMs, ...(job.errorCode ? { errorCode: job.errorCode } : {}) };
}

const artifactSchema = z.object({ fileId: z.string().min(1).max(200), name: z.string().min(1).max(500), bytes: z.number().int().nonnegative().max(10000000), sha256: z.string().regex(/^[a-f0-9]{64}$/), plaintextSha256: z.string().regex(/^[a-f0-9]{64}$/), records: z.number().int().nonnegative(), expiresAtMs: z.number().int().positive() });
export const jobRecordSchema = z.object({
  kind: z.enum(jobKinds), ownerUid: z.string().min(1).max(128).optional(), status: z.enum(jobStatuses), environment: z.enum(['staging', 'production', 'test']),
  cursor: z.object({ phase: z.number().int().nonnegative(), after: z.string().max(6000).optional(), collections: z.array(z.string().max(6000)).max(2000).optional(), collectionIndex: z.number().int().nonnegative().optional(), pending: z.array(z.string().max(6000)).max(100).optional() }),
  artifacts: z.array(artifactSchema).max(5000), processed: z.number().int().nonnegative(), receiptHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  createdAtMs: z.number().int().positive(), updatedAtMs: z.number().int().positive(), expiresAtMs: z.number().int().positive(), nextRunAtMs: z.number().int().nonnegative(),
  lease: z.object({ id: z.string().uuid(), expiresAtMs: z.number().int().positive() }).optional(), errorCode: z.string().regex(/^[A-Z][A-Z0-9-]+$/).optional(),
});
export function readJob(value: unknown): JobRecord { return jobRecordSchema.parse(value); }

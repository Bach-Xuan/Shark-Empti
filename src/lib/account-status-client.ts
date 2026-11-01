import type { User } from 'firebase/auth';
import { z } from 'zod';
import { communityRequest } from './forum-client';
import type { DeletionReceipt } from './account-receipt';
import { jobStatuses } from './jobs/types';

export const accountJobViewSchema = z.object({
  id: z.string().uuid(), kind: z.enum(['export', 'deletion']), status: z.enum(jobStatuses),
  processed: z.number().int().nonnegative(), parts: z.number().int().nonnegative().max(5000),
  expiresAtMs: z.number().int().positive(), errorCode: z.string().optional(),
});
const receiptViewSchema = accountJobViewSchema.pick({ id: true, status: true, expiresAtMs: true }).extend({ kind: z.literal('deletion') });
const listSchema = z.object({ enabled: z.boolean(), jobs: z.array(accountJobViewSchema).max(20) });

/** Minimal status only; the credential stays in a header and never enters a URL. */
export async function readReceiptStatus(receipt: DeletionReceipt, signal: AbortSignal) {
  const response = await fetch('/api/account/jobs/' + receipt.id, { headers: { 'X-Deletion-Receipt': receipt.receipt }, signal });
  if (!response.ok) throw { code: 'APP-REQUEST-FAILED', status: response.status };
  const result = receiptViewSchema.safeParse(await response.json().catch(() => null));
  if (!result.success || result.data.id !== receipt.id) throw { code: 'APP-DATA-INVALID' };
  return result.data;
}

export async function readAccountStatus(user: Pick<User, 'getIdToken'>, receipt: DeletionReceipt | null, signal: AbortSignal) {
  let result: z.infer<typeof listSchema>;
  try {
    const parsed = listSchema.safeParse(await communityRequest(user, '/api/account/jobs', undefined, 'GET', signal));
    if (!parsed.success) throw { code: 'APP-DATA-INVALID' };
    result = parsed.data;
  } catch (error) {
    const status = error && typeof error === 'object' && 'status' in error ? error.status : null;
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    const rejectedIdentity = status === 401 || status === 403 || /^AUTH-/.test(code)
      || ['auth/user-disabled', 'auth/user-token-expired', 'auth/invalid-user-token', 'auth/user-not-found'].includes(code);
    if (!receipt || !rejectedIdentity) throw error;
    const minimal = await readReceiptStatus(receipt, signal);
    return { enabled: false, receiptOnly: true, jobs: [{ ...minimal, parts: 0, processed: 0 }] };
  }
  if (receipt && !result.jobs.some(job => job.id === receipt.id)) {
    try {
      const minimal = await readReceiptStatus(receipt, signal);
      result.jobs.push({ ...minimal, parts: 0, processed: 0 });
    } catch (error) {
      if (!(error && typeof error === 'object' && 'status' in error && error.status === 404)) throw error;
    }
  }
  return { ...result, receiptOnly: false };
}

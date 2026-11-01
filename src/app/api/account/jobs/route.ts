import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { apiFailure, ApiError, authenticatedUser } from '@/lib/server-api';
import { readLimitedJson } from '@/lib/server-json';
import { jobRequestSchema, jobView, readJob } from '@/lib/jobs/types';
import { createAccountJob } from '@/lib/jobs/store';
import { enqueueJob } from '@/lib/jobs/queue';
import { jobsConfigured } from '@/lib/jobs/config';
import { enforceRequestBudget } from '@/lib/request-budget';

export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'no-store' };
export async function POST(request: Request) {
  try {
    const uid = await authenticatedUser(request, { allowLocked: true, allowUnconsented: true });
    await enforceRequestBudget(uid, 'account-traffic', { allowLocked: true });
    const token = await getAdminAuth().verifyIdToken(request.headers.get('authorization')!.slice(7), true)
      .catch(() => { throw new ApiError('AUTH-REAUTHENTICATE', 401, 'Sign in again to confirm this sensitive action.'); });
    const age = Date.now() / 1000 - token.auth_time;
    if (!Number.isFinite(age) || age > 300 || age < -30) throw new ApiError('AUTH-REAUTHENTICATE', 401, 'Sign in again to confirm this sensitive action.');
    const input = jobRequestSchema.parse(await readLimitedJson(request, 4096));
    if (input.kind === 'deletion' && input.confirmDeletion !== true) throw new ApiError('APP-INVALID-INPUT', 400, 'Account deletion requires explicit confirmation.');
    const { id, job, receipt } = await createAccountJob(uid, input.kind, input.requestId);
    await enqueueJob(id);
    return NextResponse.json({ ...jobView(id, job), ...(receipt ? { receipt } : {}) }, { status: 202, headers });
  } catch (error) { return apiFailure(error); }
}
export async function GET(request: Request) {
  try {
    const uid = await authenticatedUser(request, { allowLocked: true, allowMaintenance: true, allowUnconsented: true });
    await enforceRequestBudget(uid, 'account-traffic', { allowLocked: true, allowMaintenance: true });
    const enabled = jobsConfigured();
    if (!enabled) return NextResponse.json({ enabled, jobs: [] }, { headers });
    const jobs = await getAdminDb().collection('_accountJobs').where('ownerUid', '==', uid).orderBy('createdAtMs', 'desc').limit(20).get();
    const visible = jobs.docs.map(snapshot => ({ id: snapshot.id, job: readJob(snapshot.data()) }))
      .filter(({ job }) => job.expiresAtMs > Date.now() || (job.kind === 'deletion' && job.status !== 'completed'));
    return NextResponse.json({ enabled, jobs: visible.map(({ id, job }) => jobView(id, job)) }, { headers });
  } catch (error) { return apiFailure(error); }
}

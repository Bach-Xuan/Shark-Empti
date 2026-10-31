import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminDb } from '@/lib/firebase-admin';
import { apiFailure, ApiError, authenticatedUser } from '@/lib/server-api';
import { jobView, readJob } from '@/lib/jobs/types';
import { matchesReceipt } from '@/lib/jobs/crypto';
import { PrivateJobStorage } from '@/lib/jobs/storage';

export const runtime = 'nodejs';
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = z.string().uuid().parse((await params).id);
    const receipt = request.headers.get('x-deletion-receipt');
    const uid = receipt ? null : await authenticatedUser(request, { allowLocked: true, allowMaintenance: true });
    const snapshot = await getAdminDb().collection('_accountJobs').doc(id).get();
    if (!snapshot.exists) throw new ApiError('APP-NOT-FOUND', 404, 'Job not found.');
    const job = readJob(snapshot.data());
    const receiptAuthorized = receipt && receipt.length <= 128 && job.kind === 'deletion' && job.receiptHash && matchesReceipt(receipt, job.receiptHash);
    const expired = job.expiresAtMs <= Date.now() && (job.kind !== 'deletion' || job.status === 'completed');
    if ((!receiptAuthorized && job.ownerUid !== uid) || expired) throw new ApiError('APP-NOT-FOUND', 404, 'Job not found.');
    const url = new URL(request.url), part = url.searchParams.get('part');
    if (part !== null) {
      if (!uid || job.kind !== 'export' || job.status !== 'ready') throw new ApiError('APP-NOT-FOUND', 404, 'Part not found.');
      const index = z.coerce.number().int().nonnegative().max(4999).parse(part), artifact = job.artifacts[index];
      if (!artifact || artifact.expiresAtMs <= Date.now()) throw new ApiError('APP-NOT-FOUND', 404, 'Part not found.');
      const data = await new PrivateJobStorage().get(artifact);
      return new NextResponse(new Uint8Array(data), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
        'Content-Disposition': 'attachment; filename="shark-account-' + index + '.json"', 'X-Content-Type-Options': 'nosniff' } });
    }
    return NextResponse.json(receiptAuthorized ? { id, kind: 'deletion', status: job.status, expiresAtMs: job.expiresAtMs } : jobView(id, job), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiFailure(error); }
}

import { NextResponse } from 'next/server';
import { apiFailure, ApiError } from '@/lib/server-api';
import { readLimitedBytes } from '@/lib/server-json';
import { jobMessageSchema } from '@/lib/jobs/types';
import { requireRetention } from '@/lib/jobs/config';
import { verifyJobSignature } from '@/lib/jobs/queue';
import { maintenanceSweep, runJob } from '@/lib/jobs/worker';

export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const body = new TextDecoder('utf-8', { fatal: true }).decode(await readLimitedBytes(request, 4096));
    await verifyJobSignature(body, request.headers.get('upstash-signature'));
    const message = jobMessageSchema.parse(JSON.parse(body));
    if (message.environment !== requireRetention().environment) throw new ApiError('AUTH-FORBIDDEN', 403, 'Job environment is invalid.');
    if (message.jobId === 'maintenance') await maintenanceSweep(); else await runJob(message.jobId);
    return NextResponse.json({ accepted: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiFailure(error); }
}

import { authenticatedUser,apiFailure } from '@/lib/server-api';
import { buildAiRequest } from '@/ai/operation-registry';
import { claimGeneration,finalizeGeneration } from '@/ai/generation-store';
import { requestStructuredOnce } from '@/ai/openrouter';
import { classifyAiFailure } from '@/ai/error-classifier';
import { protocolJson } from '@/ai/route-utils';
import { recordAiEvent } from '@/ai/telemetry';

export const runtime = 'nodejs';
type Context = { params: Promise<{ generationId: string }> };

export async function POST(request: Request, { params }: Context) {
  try {
    const uid = await authenticatedUser(request);
    const generationId = (await params).generationId;
    const claim = await claimGeneration(generationId, uid);
    if (claim.kind === 'response') return protocolJson(claim.value);
    const built = buildAiRequest(claim.record.operation, claim.record.validatedInput);
    const startedAt = Date.now();
    const result = await requestStructuredOnce({ operation: claim.record.operation, modelOrdinal: claim.attempt, ...built, signal: request.signal });
    const durationMs = Date.now() - startedAt;
    const outcome = result.ok ? { data: result.data } : { failure: result.failure, ...classifyAiFailure(result.failure) };
    const finalized = await finalizeGeneration(generationId, uid, claim.leaseId, claim.attempt, durationMs, outcome);
    recordAiEvent({ generationId, operation: claim.record.operation, state: finalized.state, durationMs, outcome: result.ok ? 'succeeded' : result.failure.code });
    return protocolJson(finalized);
  } catch (error) { return apiFailure(error); }
}

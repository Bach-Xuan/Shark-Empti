import { authenticatedUser } from '@/lib/server-api';
import { requireDocumentId } from '@/lib/forum-deletion';
import { buildAiRequest } from '@/ai/operation-registry';
import { claimGeneration,finalizeGeneration } from '@/ai/generation-store';
import { requestStructuredOnce } from '@/ai/openrouter';
import { classifyAiFailure } from '@/ai/error-classifier';
import { protocolJson, aiApiFailure } from '@/ai/route-utils';
import { recordAiEvent, type AiStage } from '@/ai/telemetry';
import type { AiOperation } from '@/ai/protocol';
import { enforceRequestBudget } from '@/lib/request-budget';

export const runtime = 'nodejs';
type Context = { params: Promise<{ generationId: string }> };

export async function POST(request: Request, { params }: Context) {
  let generationId: string | undefined;
  let operation: AiOperation | undefined;
  let stage: 'claim' | 'provider' | 'finalize' = 'claim';
  const checkpoint = (value: AiStage) => {
    if (generationId) recordAiEvent({ generationId, operation, stage: value });
  };
  try {
    const uid = await authenticatedUser(request);
    generationId = (await params).generationId;
    requireDocumentId(generationId);
    checkpoint('claim_started');
    await enforceRequestBudget(uid, 'ai-traffic');
    const claim = await claimGeneration(generationId, uid);
    if (claim.kind === 'response') { checkpoint('claim_observed'); return protocolJson(claim.value); }
    operation = claim.record.operation;
    checkpoint('claim_accepted');
    const built = buildAiRequest(claim.record.operation, claim.record.validatedInput);
    const startedAt = Date.now();
    stage = 'provider';
    checkpoint('provider_dispatch');
    const result = await requestStructuredOnce({ operation, modelOrdinal: claim.attempt, ...built, signal: request.signal, checkpoint });
    const durationMs = Date.now() - startedAt;
    const outcome = result.ok ? { data: result.data } : { failure: result.failure, ...classifyAiFailure(result.failure) };
    if (!result.ok) checkpoint('provider_failed');
    stage = 'finalize';
    checkpoint('finalize_started');
    const finalized = await finalizeGeneration(generationId, uid, claim.leaseId, claim.attempt, durationMs, outcome);
    recordAiEvent({ generationId, operation, stage: 'finalize_succeeded', state: finalized.state, durationMs,
      outcome: result.ok ? finalized.error?.code ?? finalized.state : result.failure.code,
      ...(!result.ok ? { failureKind: result.failure.kind } : {}),
    });
    return protocolJson(finalized);
  } catch (error) {
    return aiApiFailure(error, { generationId, stage: `${stage}_failed`, persistence: stage !== 'provider' });
  }
}

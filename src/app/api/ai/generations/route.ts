import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticatedUser,ApiError } from '@/lib/server-api';
import { boundedJson,aiProtocolEnabled,protocolJson,aiApiFailure } from '@/ai/route-utils';
import { isAiOperation } from '@/ai/protocol';
import { getAiOperationDefinition } from '@/ai/operation-registry';
import { createGeneration } from '@/ai/generation-store';
import { enforceRequestBudget } from '@/lib/request-budget';
import { recordAiEvent } from '@/ai/telemetry';

export const runtime = 'nodejs';
const envelopeSchema = z.object({ generationId: z.string().uuid(), operation: z.string(), input: z.unknown() }).strict();

export async function POST(request: Request) {
  let generationId: string | undefined;
  try {
    const uid = await authenticatedUser(request);
    if (!aiProtocolEnabled()) throw new ApiError('AI-PROTOCOL-DISABLED', 503, 'The AI service is temporarily unavailable.');
    await enforceRequestBudget(uid, 'ai-traffic');
    const envelope = envelopeSchema.parse(await boundedJson(request, 140_000));
    generationId = envelope.generationId;
    if (!isAiOperation(envelope.operation)) throw new ApiError('AI-UNKNOWN-OPERATION', 400, 'Invalid AI operation.');
    const definition = getAiOperationDefinition(envelope.operation);
    const inputBytes = new TextEncoder().encode(JSON.stringify(envelope.input)).byteLength;
    if (inputBytes > definition.inputLimits.maxSerializedBytes) throw new ApiError('APP-PAYLOAD-TOO-LARGE', 413, 'Request data is too large.');
    const input = definition.inputSchema.parse(envelope.input);
    recordAiEvent({ generationId, operation: envelope.operation, stage: 'create_started' });
    const result = await createGeneration(generationId, uid, envelope.operation, input);
    recordAiEvent({ generationId, operation: envelope.operation, stage: 'create_succeeded', state: result.state });
    return protocolJson(result);
  } catch (error) { return aiApiFailure(error, { generationId, stage: 'create_failed', persistence: true }); }
}

export function GET() {
  return NextResponse.json({ error: 'Method not allowed.', code: 'APP-METHOD-NOT-ALLOWED', values: {} }, { status: 405 });
}

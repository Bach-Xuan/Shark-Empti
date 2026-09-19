import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticatedUser,apiFailure,ApiError } from '@/lib/server-api';
import { boundedJson,aiProtocolEnabled,protocolJson } from '@/ai/route-utils';
import { isAiOperation } from '@/ai/protocol';
import { getAiOperationDefinition } from '@/ai/operation-registry';
import { createGeneration } from '@/ai/generation-store';

export const runtime = 'nodejs';
const envelopeSchema = z.object({ generationId: z.string().uuid(), operation: z.string(), input: z.unknown() }).strict();

export async function POST(request: Request) {
  try {
    const uid = await authenticatedUser(request);
    if (!aiProtocolEnabled()) throw new ApiError('AI-PROTOCOL-DISABLED', 503, 'The AI service is temporarily unavailable.');
    const envelope = envelopeSchema.parse(await boundedJson(request, 140_000));
    if (!isAiOperation(envelope.operation)) throw new ApiError('AI-UNKNOWN-OPERATION', 400, 'Invalid AI operation.');
    const definition = getAiOperationDefinition(envelope.operation);
    const inputBytes = new TextEncoder().encode(JSON.stringify(envelope.input)).byteLength;
    if (inputBytes > definition.inputLimits.maxSerializedBytes) throw new ApiError('APP-PAYLOAD-TOO-LARGE', 413, 'Request data is too large.');
    const input = definition.inputSchema.parse(envelope.input);
    return protocolJson(await createGeneration(envelope.generationId, uid, envelope.operation, input));
  } catch (error) { return apiFailure(error); }
}

export function GET() {
  return NextResponse.json({ error: 'Method not allowed.', code: 'APP-METHOD-NOT-ALLOWED', values: {} }, { status: 405 });
}

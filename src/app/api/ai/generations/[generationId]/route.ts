import { authenticatedUser } from '@/lib/server-api';
import { cancelGeneration,getGeneration } from '@/ai/generation-store';
import { protocolJson, aiApiFailure } from '@/ai/route-utils';
import { enforceRequestBudget } from '@/lib/request-budget';
import { requireDocumentId } from '@/lib/forum-deletion';
import { recordAiEvent } from '@/ai/telemetry';

export const runtime = 'nodejs';
type Context = { params: Promise<{ generationId: string }> };

export async function GET(request: Request, { params }: Context) {
  let generationId: string | undefined;
  try {
    const uid = await authenticatedUser(request);
    generationId = (await params).generationId;
    requireDocumentId(generationId);
    await enforceRequestBudget(uid, 'ai-traffic');
    return protocolJson(await getGeneration(generationId, uid));
  } catch (error) { return aiApiFailure(error, { generationId, stage: 'read_failed', persistence: true }); }
}

export async function DELETE(request: Request, { params }: Context) {
  let generationId: string | undefined;
  try {
    const uid = await authenticatedUser(request);
    generationId = (await params).generationId;
    requireDocumentId(generationId);
    await enforceRequestBudget(uid, 'ai-traffic');
    const result = await cancelGeneration(generationId, uid);
    recordAiEvent({ generationId, stage: 'cancel_succeeded', state: result.state });
    return protocolJson(result);
  } catch (error) { return aiApiFailure(error, { generationId, stage: 'cancel_failed', persistence: true }); }
}

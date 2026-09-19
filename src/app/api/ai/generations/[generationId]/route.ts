import { authenticatedUser,apiFailure } from '@/lib/server-api';
import { cancelGeneration,getGeneration } from '@/ai/generation-store';
import { protocolJson } from '@/ai/route-utils';

export const runtime = 'nodejs';
type Context = { params: Promise<{ generationId: string }> };

export async function GET(request: Request, { params }: Context) {
  try {
    const uid = await authenticatedUser(request);
    return protocolJson(await getGeneration((await params).generationId, uid));
  } catch (error) { return apiFailure(error); }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    const uid = await authenticatedUser(request);
    return protocolJson(await cancelGeneration((await params).generationId, uid));
  } catch (error) { return apiFailure(error); }
}

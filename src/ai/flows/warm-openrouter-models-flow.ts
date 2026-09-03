'use server';

import { warmOpenRouterModels } from '@/ai/openrouter';

/**
 * Invoked in the background by the browser bootstrap. It does not expose a
 * provider response or credential to the client.
 */
export async function warmOpenRouterModelPriority() {
  return warmOpenRouterModels();
}

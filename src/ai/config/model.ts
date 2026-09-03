/**
 * Kept server-side: the browser never receives an OpenRouter model name or key.
 * The order is a product decision, rather than an environment override, so every
 * AI flow has the same fallback behaviour.
 */
export const OPENROUTER_MODEL_PRIORITY = [
  'thinkingmachines/inkling:free',
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-3.5-lightning:free',
] as const;

export type OpenRouterModel = (typeof OPENROUTER_MODEL_PRIORITY)[number];

export const LAST_RESORT_OPENROUTER_MODEL =
  OPENROUTER_MODEL_PRIORITY[OPENROUTER_MODEL_PRIORITY.length - 1];

/** OpenRouter metadata currently advertises native response_format only for Gemma. */
export const modelsWithNativeStructuredOutput = new Set<OpenRouterModel>([
  'google/gemma-4-31b-it:free',
]);

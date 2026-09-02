export const DEFAULT_OPENROUTER_MODEL =
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free';

export const AI_MODEL_NAME =
  process.env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL;

/**
 * Định danh mô hình đầy đủ cho Genkit (bao gồm tiền tố provider).
 */
export const AI_MODEL = `openai/${AI_MODEL_NAME}`;

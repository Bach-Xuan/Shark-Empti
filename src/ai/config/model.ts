export const AI_MODEL_NAME =
  process.env.OPENROUTER_MODEL ??
  "google/gemma-4-31b-it";

/**
 * Định danh mô hình đầy đủ cho Genkit (bao gồm tiền tố provider).
 */
export const AI_MODEL = `openai/${AI_MODEL_NAME}`;

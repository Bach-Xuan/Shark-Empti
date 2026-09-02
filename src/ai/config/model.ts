export const AI_MODEL_NAME =
  process.env.OPENROUTER_MODEL ??
  "nvidia/nemotron-3.5-content-safety:free";

/**
 * Định danh mô hình đầy đủ cho Genkit (bao gồm tiền tố provider).
 */
export const AI_MODEL = `openai/${AI_MODEL_NAME}`;

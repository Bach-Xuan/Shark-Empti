export const DEFAULT_OPENROUTER_MODEL =
  'liquid/lfm-2.5-2.6b:free';

export const AI_MODEL_NAME =
  process.env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL;

/**
 * OpenRouter's OpenAI-compatible API does not accept Gemini safety settings.
 * Keep this shared value model-neutral so flows can use a consistent config.
 */
export const DEFAULT_GENERATION_CONFIG = {};

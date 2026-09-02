import { genkit } from 'genkit';
import { openAICompatible } from '@genkit-ai/compat-oai';
import { AI_MODEL } from './config/model';

function getOpenRouterApiKey(): string {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      'OPENROUTER_API_KEY is missing. Add it to .env and restart the server.'
    );
  }

  return apiKey;
}

/**
 * Cấu hình OpenRouter qua OpenAI Compatibility API.
 * Thiết lập name là 'openai' để khớp với tiền tố trong AI_MODEL (openai/...).
 */
const OPENROUTER_CONFIG = {
  name: 'openai',
  apiKey: getOpenRouterApiKey(),
  baseURL: 'https://openrouter.ai/api/v1',
};

/**
 * Thực thể AI mặc định của Shark Guru.
 * Thiết lập model mặc định để tránh lỗi "Model not found" khi gọi generate() không tham số model.
 */
export const ai = genkit({
  plugins: [openAICompatible(OPENROUTER_CONFIG)],
  model: AI_MODEL,
});

/**
 * Hàm khởi tạo AI với API Key động (hỗ trợ Key Rotation/Fallback).
 */
export function getAiWithKey(apiKey?: string) {
  const resolvedApiKey = apiKey?.trim() || getOpenRouterApiKey();

  return genkit({
    plugins: [
      openAICompatible({
        ...OPENROUTER_CONFIG,
        apiKey: resolvedApiKey,
      }),
    ],
    model: AI_MODEL,
  });
}

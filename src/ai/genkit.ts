import { genkit } from 'genkit';
import { openAICompatible } from '@genkit-ai/compat-oai';
import { AI_MODEL } from './config/model';

/**
 * Cấu hình OpenRouter qua OpenAI Compatibility API.
 * Thiết lập name là 'openai' để khớp với tiền tố trong AI_MODEL (openai/...).
 */
const OPENROUTER_CONFIG = {
  name: 'openai',
  apiKey: process.env.OPENROUTER_API_KEY!,
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
  return genkit({
    plugins: [
      openAICompatible({
        ...OPENROUTER_CONFIG,
        apiKey: apiKey || OPENROUTER_CONFIG.apiKey,
      }),
    ],
    model: AI_MODEL,
  });
}

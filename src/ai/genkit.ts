import { genkit } from 'genkit';
import { openAICompatible } from '@genkit-ai/compat-oai';
import { AI_MODEL } from './config/model';
import { createAppError, OpenRouterProviderError } from '@/lib/app-error';

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
  // Flows are defined during module loading. Keep the missing-key error at request
  // time so a server can start and report a structured, user-safe failure.
  apiKey: process.env.OPENROUTER_API_KEY?.trim() || '',
  baseURL: 'https://openrouter.ai/api/v1',
  fetch: async (...args: Parameters<typeof fetch>) => {
    let response: Response;
    try {
      response = await globalThis.fetch(...args);
    } catch (cause) {
      throw new OpenRouterProviderError(
        createAppError('AI-TRANSPORT', 'The AI connection was interrupted.'),
        { cause }
      );
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const payload = await response.clone().json().catch(() => null) as {
        error?: { message?: string; code?: string | number; metadata?: { provider_name?: string; retry_after_seconds?: number } };
      } | null;
      if (payload?.error) {
        const providerCode = payload.error.code ?? response.status;
        const numericCode = Number(providerCode);
        const code = numericCode === 429
          ? 'AI-RATE-LIMIT-429'
          : numericCode >= 500
            ? `AI-UPSTREAM-${numericCode}`
            : `AI-PROVIDER-${numericCode || response.status}`;
        throw new OpenRouterProviderError(createAppError(
          code,
          'OpenRouter could not complete the AI request.',
          {
            httpStatus: response.status,
            providerCode: String(providerCode),
            provider: payload.error.metadata?.provider_name || 'OpenRouter',
            ...(payload.error.metadata?.retry_after_seconds
              ? { retryAfterSeconds: payload.error.metadata.retry_after_seconds }
              : {}),
          }
        ));
      }
    }
    return response;
  },
  maxRetries: 2,
  timeout: 60_000,
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

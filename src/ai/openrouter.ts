import 'server-only';
import { z } from 'zod';
import { createAppError, OpenRouterProviderError } from '@/lib/app-error';
import { AI_MODEL_NAME } from './config/model';

type Message = { role: 'user' | 'assistant'; content: string };
type StructuredRequest<T> = { system: string; prompt: string; schema: z.ZodType<T>; messages?: Message[] };
const pause = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));
const failure = (code: string, status?: number) => new OpenRouterProviderError(
  createAppError(code, 'The AI request could not be completed.', status ? { httpStatus: status } : {}),
);

/** One configured model; validate locally even when the provider enforces JSON schema. */
export async function generateStructured<T>({ system, prompt, schema, messages = [] }: StructuredRequest<T>): Promise<T> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw failure('AI-CONFIG-MISSING');
  let endpoint = 'https://openrouter.ai/api/v1/chat/completions';
  if (process.env.OPENROUTER_TEST_URL) {
    const url = new URL(process.env.OPENROUTER_TEST_URL);
    if (process.env.NODE_ENV === 'production' || !process.env.FIRESTORE_EMULATOR_HOST || !process.env.GCLOUD_PROJECT?.startsWith('demo-') || !['127.0.0.1', 'localhost'].includes(url.hostname)) throw failure('AI-CONFIG-MISSING');
    endpoint = url.toString();
  }
  const body = JSON.stringify({
    model: AI_MODEL_NAME,
    messages: [{ role: 'system', content: system }, ...messages, { role: 'user', content: prompt }],
    response_format: { type: 'json_schema', json_schema: { name: 'response', strict: true, schema: z.toJSONSchema(schema) } },
  });
  for (let attempt = 0; attempt < 3; attempt++) {
    const signal = AbortSignal.timeout(60_000);
    let response: Response;
    let payload: unknown;
    try {
      response = await fetch(endpoint, {
        method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body, signal,
      });
      const text = await response.text();
      try { payload = JSON.parse(text); } catch { payload = null; }
    } catch {
      if (attempt < 2) { await pause(500 * 2 ** attempt); continue; }
      throw failure(signal.aborted ? 'AI-TIMEOUT' : 'AI-TRANSPORT');
    }
    const envelope = z.object({
      error: z.object({ code: z.union([z.number(), z.string()]).optional() }).passthrough().optional(),
      choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })).optional(),
    }).passthrough().safeParse(payload);
    const embedded = envelope.success ? envelope.data.error : undefined;
    if (!response.ok || embedded) {
      const status = embedded ? Number(embedded.code) || (response.ok ? 502 : response.status) : response.status;
      const transient = status === 429 || status >= 500;
      if (transient && attempt < 2) {
        const retryAfter = response.headers.get('Retry-After');
        const seconds = retryAfter ? Number(retryAfter) : NaN;
        const delay = Number.isFinite(seconds) ? seconds * 1000 : retryAfter ? Date.parse(retryAfter) - Date.now() : 500 * 2 ** attempt;
        await pause(Math.max(0, Math.min(Number.isFinite(delay) ? delay : 500, 10_000)));
        continue;
      }
      throw failure(status === 429 ? 'AI-RATE-LIMIT-429' : status >= 500 ? `AI-UPSTREAM-${status}` : `AI-PROVIDER-${status}`, status);
    }
    const content = envelope.success ? envelope.data.choices?.[0]?.message.content : undefined;
    if (!content) throw failure('AI-INVALID-RESPONSE');
    let output: unknown;
    try { output = JSON.parse(content); } catch { throw failure('AI-INVALID-RESPONSE'); }
    const result = schema.safeParse(output);
    if (!result.success) throw failure('AI-INVALID-RESPONSE');
    return result.data;
  }
  throw failure('AI-REQUEST-FAILED');
}

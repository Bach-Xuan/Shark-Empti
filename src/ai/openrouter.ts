import 'server-only';
import type { AiOperation } from './protocol';
import type { AiMessage } from './operation-registry';
import { modelsWithNativeStructuredOutput,OPENROUTER_MODEL_PRIORITY } from './config/model';
import { z } from 'zod';

export type AiFailureKind = 'cancelled' | 'configuration' | 'provider' | 'timeout' | 'dns' | 'tls' | 'reset' | 'transport' | 'empty' | 'invalid_json' | 'invalid_schema' | 'unknown';
export type NormalizedAiFailure = { kind: AiFailureKind; code: string; httpStatus?: number; retryAfterMs?: number };
export type SingleAttemptResult<T> = { ok: true; data: T; upstreamRequestId?: string } | { ok: false; failure: NormalizedAiFailure };
type SingleAttemptRequest<T> = { operation: AiOperation; modelOrdinal: 0 | 1 | 2; system: string; prompt: string; messages?: AiMessage[]; schema: z.ZodType<T>; signal: AbortSignal };

const parseJsonContent = (content: string): unknown => {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return JSON.parse(fenced?.[1] ?? trimmed);
};

function endpointForEnvironment(apiKey: string) {
  if (!process.env.OPENROUTER_TEST_URL) return 'https://openrouter.ai/api/v1/chat/completions';
  const url = new URL(process.env.OPENROUTER_TEST_URL);
  const localHost = (value: string | undefined) => !!value && /^(?:127\.0\.0\.1|localhost):\d+$/.test(value);
  const isolatedProductionTest = process.env.SHARK_EMULATOR_TEST_MODE === 'true' && process.env.NEXT_PUBLIC_USE_EMULATORS === 'true' && apiKey === 'test-only'
    && localHost(process.env.FIRESTORE_EMULATOR_HOST) && localHost(process.env.FIREBASE_AUTH_EMULATOR_HOST);
  if ((process.env.NODE_ENV === 'production' && !isolatedProductionTest) || !process.env.FIRESTORE_EMULATOR_HOST || !process.env.GCLOUD_PROJECT?.startsWith('demo-')
    || !['127.0.0.1', 'localhost'].includes(url.hostname) || url.protocol !== 'http:' || url.username || url.password) return null;
  return url.toString();
}

function transportFailure(error: unknown, requestSignal: AbortSignal, deadline: AbortSignal): NormalizedAiFailure {
  // A route/request disconnect is not proof of explicit user cancellation.
  // DELETE updates the ledger when the user actually cancels.
  if (requestSignal.aborted) return { kind: 'transport', code: 'AI-CLIENT-DISCONNECTED' };
  if (deadline.aborted || (error instanceof Error && error.name === 'TimeoutError')) return { kind: 'timeout', code: 'AI-TIMEOUT' };
  const cause = error instanceof Error ? error.cause : undefined;
  const code = typeof cause === 'object' && cause && 'code' in cause ? String(cause.code) : '';
  if (['ENOTFOUND', 'EAI_AGAIN'].includes(code)) return { kind: 'dns', code: 'AI-TRANSPORT-DNS' };
  if (code.startsWith('ERR_TLS') || code.includes('CERT')) return { kind: 'tls', code: 'AI-TRANSPORT-TLS' };
  if (['ECONNRESET', 'UND_ERR_SOCKET'].includes(code)) return { kind: 'reset', code: 'AI-TRANSPORT-RESET' };
  return { kind: 'transport', code: 'AI-TRANSPORT' };
}

/** Performs exactly one request to the server-selected model. */
export async function requestStructuredOnce<T>({ modelOrdinal, system, prompt, schema, messages = [], signal: requestSignal }: SingleAttemptRequest<T>): Promise<SingleAttemptResult<T>> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const endpoint = apiKey ? endpointForEnvironment(apiKey) : null;
  if (!apiKey || !endpoint) return { ok: false, failure: { kind: 'configuration', code: 'AI-CONFIG-MISSING' } };
  const model = OPENROUTER_MODEL_PRIORITY[modelOrdinal];
  const deadline = AbortSignal.timeout(20_000);
  const signal = AbortSignal.any([requestSignal, deadline]);
  const body = {
    model,
    messages: [{ role: 'system', content: `${system}\n\nReturn only a JSON object matching the requested result. Do not use Markdown fences or add prose.` }, ...messages, { role: 'user', content: prompt }],
    ...(modelsWithNativeStructuredOutput.has(model) ? { response_format: { type: 'json_schema', json_schema: { name: 'response', strict: true, schema: z.toJSONSchema(schema) } } } : {}),
  };
  let response: Response;
  let payload: unknown;
  try {
    response = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
    const text = await response.text();
    try { payload = JSON.parse(text); } catch { payload = null; }
  } catch (error) { return { ok: false, failure: transportFailure(error, requestSignal, deadline) }; }
  const envelope = z.object({ id: z.string().optional(), error: z.object({ code: z.union([z.number(), z.string()]).optional() }).passthrough().optional(), choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })).optional() }).passthrough().safeParse(payload);
  const embedded = envelope.success ? envelope.data.error : undefined;
  if (!response.ok || embedded) {
    const status = embedded ? Number(embedded.code) || (response.ok ? 502 : response.status) : response.status;
    const retryAfter = Number(response.headers.get('retry-after'));
    return { ok: false, failure: { kind: 'provider', code: `AI-PROVIDER-${status}`, httpStatus: status, ...(status === 429 && Number.isFinite(retryAfter) ? { retryAfterMs: retryAfter * 1_000 } : {}) } };
  }
  const content = envelope.success ? envelope.data.choices?.[0]?.message.content : undefined;
  if (!content) return { ok: false, failure: { kind: 'empty', code: 'AI-INVALID-RESPONSE' } };
  let output: unknown;
  try { output = parseJsonContent(content); } catch { return { ok: false, failure: { kind: 'invalid_json', code: 'AI-INVALID-RESPONSE' } }; }
  const result = schema.safeParse(output);
  if (!result.success) return { ok: false, failure: { kind: 'invalid_schema', code: 'AI-INVALID-RESPONSE' } };
  return { ok: true, data: result.data, ...(envelope.success && envelope.data.id ? { upstreamRequestId: envelope.data.id } : {}) };
}

import 'server-only';
import { z } from 'zod';
import { createAppError, getAiAppError, OpenRouterProviderError } from '@/lib/app-error';
import { LAST_RESORT_OPENROUTER_MODEL, modelsWithNativeStructuredOutput, OPENROUTER_MODEL_PRIORITY, type OpenRouterModel } from './config/model';

type Message = { role: 'user' | 'assistant'; content: string };
const pause = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));
const failure = (code: string, status?: number) => new OpenRouterProviderError(
  createAppError(code, 'The AI request could not be completed.', status ? { httpStatus: status } : {}),
);

let preferredModel: OpenRouterModel = OPENROUTER_MODEL_PRIORITY[0];

/** Test-only reset; production code never calls this. */
export function resetOpenRouterModelPreferenceForTest() {
  preferredModel = OPENROUTER_MODEL_PRIORITY[0];
}

const isCancellation = (error: unknown) => {
  const code = getAiAppError(error).code;
  return code === 'AI-TIMEOUT' || code === 'AI-TRANSPORT';
};

const canTryAnotherModel = (error: unknown) => {
  const code = getAiAppError(error).code;
  // A 403 can be a free-model/provider availability restriction even with a
  // valid key, so only a confirmed unauthenticated key stops the sequence.
  return !['AI-CONFIG-MISSING', 'AI-INVALID-INPUT', 'AI-PROVIDER-401'].includes(code);
};

const orderedModels = (first: OpenRouterModel) => [
  first,
  ...OPENROUTER_MODEL_PRIORITY.filter(model => model !== first),
];

const cancellationOrder = () => [
  LAST_RESORT_OPENROUTER_MODEL,
  ...OPENROUTER_MODEL_PRIORITY.filter(model => model !== LAST_RESORT_OPENROUTER_MODEL),
];

const parseJsonContent = (content: string): unknown => {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return JSON.parse(fenced?.[1] ?? trimmed);
};

type StructuredRequest<T> = { system: string; prompt: string; schema: z.ZodType<T>; messages?: Message[] };
const FLOW_MODEL_TIMEOUT_MS = 20_000;
const WARMUP_MODEL_TIMEOUT_MS = 8_000;

async function requestStructured<T>(model: OpenRouterModel, { system, prompt, schema, messages = [] }: StructuredRequest<T>, timeoutMs = FLOW_MODEL_TIMEOUT_MS): Promise<T> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw failure('AI-CONFIG-MISSING');
  let endpoint = 'https://openrouter.ai/api/v1/chat/completions';
  if (process.env.OPENROUTER_TEST_URL) {
    const url = new URL(process.env.OPENROUTER_TEST_URL);
    if (process.env.NODE_ENV === 'production' || !process.env.FIRESTORE_EMULATOR_HOST || !process.env.GCLOUD_PROJECT?.startsWith('demo-') || !['127.0.0.1', 'localhost'].includes(url.hostname)) throw failure('AI-CONFIG-MISSING');
    endpoint = url.toString();
  }
  const body = {
    model,
    messages: [{ role: 'system', content: `${system}\n\nReturn only a JSON object matching the requested result. Do not use Markdown fences or add prose.` }, ...messages, { role: 'user', content: prompt }],
    ...(modelsWithNativeStructuredOutput.has(model)
      ? { response_format: { type: 'json_schema', json_schema: { name: 'response', strict: true, schema: z.toJSONSchema(schema) } } }
      : {}),
  };

  const signal = AbortSignal.timeout(timeoutMs);
  let response: Response;
  let payload: unknown;
  try {
    response = await fetch(endpoint, {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal,
    });
    const text = await response.text();
    try { payload = JSON.parse(text); } catch { payload = null; }
  } catch {
    throw failure(signal.aborted ? 'AI-TIMEOUT' : 'AI-TRANSPORT');
  }
  const envelope = z.object({
    error: z.object({ code: z.union([z.number(), z.string()]).optional() }).passthrough().optional(),
    choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })).optional(),
  }).passthrough().safeParse(payload);
  const embedded = envelope.success ? envelope.data.error : undefined;
  if (!response.ok || embedded) {
    const status = embedded ? Number(embedded.code) || (response.ok ? 502 : response.status) : response.status;
    throw failure(status === 429 ? 'AI-RATE-LIMIT-429' : status >= 500 ? `AI-UPSTREAM-${status}` : `AI-PROVIDER-${status}`, status);
  }
  const content = envelope.success ? envelope.data.choices?.[0]?.message.content : undefined;
  if (!content) throw failure('AI-INVALID-RESPONSE');
  let output: unknown;
  try { output = parseJsonContent(content); } catch { throw failure('AI-INVALID-RESPONSE'); }
  const result = schema.safeParse(output);
  if (!result.success) throw failure('AI-INVALID-RESPONSE');
  return result.data;
}

/** Every public flow shares the same bounded, model-aware fallback sequence. */
export async function generateStructured<T>(request: StructuredRequest<T>): Promise<T> {
  let lastError: unknown = failure('AI-REQUEST-FAILED');
  let models = orderedModels(preferredModel);
  while (models.length) {
    const model = models.shift()!;
    try {
      const result = await requestStructured(model, request);
      preferredModel = model;
      return result;
    } catch (error) {
      lastError = error;
      if (!canTryAnotherModel(error)) throw error;
      if (isCancellation(error)) {
        // A cancelled generation gets the requested last-resort model first.
        // If that also fails, continue once through the normal priority list.
        models = cancellationOrder().filter(candidate => candidate !== model || candidate !== LAST_RESORT_OPENROUTER_MODEL);
      }
    }
  }
  throw lastError;
}

/** A lightweight structured response proves the same contract used by the real flows. */
export async function warmOpenRouterModels(): Promise<{ available: boolean; retryable: boolean; model?: OpenRouterModel }> {
  for (const model of OPENROUTER_MODEL_PRIORITY) {
    try {
      await requestStructured(model, {
        system: 'You are a service health check.',
        prompt: 'Return {"ready":true}.',
        schema: z.object({ ready: z.literal(true) }),
      }, WARMUP_MODEL_TIMEOUT_MS);
      preferredModel = model;
      return { available: true, retryable: false, model };
    } catch (error) {
      if (!canTryAnotherModel(error)) return { available: false, retryable: false };
    }
  }
  await pause(0);
  return { available: false, retryable: true };
}

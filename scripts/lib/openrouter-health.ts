import { OPENROUTER_MODEL_PRIORITY } from '../../src/ai/config/model';

class HealthError extends Error {}

/** Metadata checks only; this command never requests billable generation. */
export async function checkOpenRouterHealth(key: string | undefined, request: typeof fetch = fetch, timeoutMs = 10_000) {
  const apiKey = key?.trim();
  if (!apiKey) throw new HealthError('OPENROUTER_API_KEY is missing.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const auth = await request('https://openrouter.ai/api/v1/key', {
      headers: { Authorization: `Bearer ${apiKey}` }, signal: controller.signal,
    });
    if (!auth.ok) throw new HealthError(`Credential authentication failed (HTTP ${auth.status}).`);
    const payload = await auth.json();
    const data = payload?.data;
    if (!data || typeof data !== 'object' || !('limit_remaining' in data)
      || (data.limit_remaining !== null && (typeof data.limit_remaining !== 'number' || !Number.isFinite(data.limit_remaining)))) {
      throw new HealthError('Credential endpoint returned invalid metadata.');
    }
    if (data.limit_remaining !== null && data.limit_remaining <= 0) {
      throw new HealthError('Credential authenticated; configured key spending limit is exhausted. Live inference was not tested.');
    }
    const models = await request('https://openrouter.ai/api/v1/models', { signal: controller.signal });
    if (!models.ok) throw new HealthError(`Model catalogue check failed (HTTP ${models.status}).`);
    const catalogue = await models.json();
    if (!Array.isArray(catalogue?.data)) throw new HealthError('Model catalogue returned invalid metadata.');
    const unavailable = OPENROUTER_MODEL_PRIORITY.filter(model => !catalogue.data.some((item: unknown) =>
      item !== null && typeof item === 'object' && 'id' in item && item.id === model));
    if (unavailable.length) throw new HealthError(`Configured models missing from catalogue: ${unavailable.join(', ')}.`);
    return [
      'Credential authentication: passed.',
      `Model catalogue: all ${OPENROUTER_MODEL_PRIORITY.length} configured models are listed.`,
      data.limit_remaining === null ? 'Key spending limit: no configured cap.' : 'Key spending limit: remaining allowance reported.',
      'Live inference, account credits and model-specific quotas: not tested. Run ai:smoke separately for generation validation.',
    ];
  } catch (error) {
    if (error instanceof HealthError) throw error;
    throw new HealthError(controller.signal.aborted ? 'OpenRouter health check timed out.' : 'OpenRouter health check failed: network error or invalid response.');
  } finally { clearTimeout(timeout); }
}

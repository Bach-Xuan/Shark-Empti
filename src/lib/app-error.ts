export type ErrorValue = string | number | boolean;

/** A safe error shape that can cross a server-to-client boundary. */
export interface AppError {
  code: string;
  message: string;
  values: Record<string, ErrorValue>;
}

export type AppResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AppError };

export const success = <T>(data: T): AppResult<T> => ({ ok: true, data });
export const failure = <T = never>(error: AppError): AppResult<T> => ({ ok: false, error });

export class OpenRouterProviderError extends Error {
  constructor(
    public readonly appError: AppError,
    options?: ErrorOptions
  ) {
    super(appError.message, options);
    this.name = 'OpenRouterProviderError';
  }
}

const safeText = (value: unknown, maxLength = 120): string =>
  String(value ?? '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/(?:sk|or-v1)-[A-Za-z0-9_-]+/gi, '[redacted-key]')
    .slice(0, maxLength);

export function createAppError(
  code: string,
  message: string,
  values: Record<string, ErrorValue> = {}
): AppError {
  return { code, message, values };
}

export function getAiAppError(error: unknown): AppError {
  if (error instanceof OpenRouterProviderError) return error.appError;
  if (error instanceof Error && error.name === 'ZodError') return createAppError('AI-INVALID-INPUT', 'Invalid AI request data.');

  const message = error instanceof Error ? error.message : safeText(error);
  const normalized = message.toLowerCase();

  if (normalized.includes('openrouter_api_key')) {
    return createAppError('AI-CONFIG-MISSING', 'OpenRouter is not configured.', {
      variable: 'OPENROUTER_API_KEY',
    });
  }
  if (normalized.includes('timeout') || normalized.includes('timed out')) {
    return createAppError('AI-TIMEOUT', 'The AI request timed out.');
  }
  if (normalized.includes('premature close') || normalized.includes('fetch failed') || normalized.includes('econnreset')) {
    return createAppError('AI-TRANSPORT', 'The AI connection was interrupted.');
  }
  if (normalized.includes('no output') || normalized.includes('invalid output') || normalized.includes('json schema')) {
    return createAppError('AI-INVALID-RESPONSE', 'The model returned an invalid response format.');
  }
  return createAppError('AI-REQUEST-FAILED', 'The AI request could not be completed.');
}

export async function asAiResult<T>(callback: () => Promise<T>): Promise<AppResult<T>> {
  try {
    return success(await callback());
  } catch (error) {
    return failure(getAiAppError(error));
  }
}

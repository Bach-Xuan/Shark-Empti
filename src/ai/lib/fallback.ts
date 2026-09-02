const apiKey =
  process.env.OPENROUTER_API_KEY;

export function getApiKey(): string {
  if (!apiKey) {
    throw new Error(
      'OPENROUTER_API_KEY is not configured'
    );
  }

  return apiKey;
}

export async function executeWithFallback<T>(
  callback: (
    apiKey: string
  ) => Promise<T>
): Promise<T> {
  return callback(
    getApiKey()
  );
}
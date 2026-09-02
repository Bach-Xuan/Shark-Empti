export function getApiKey(): string {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      'OPENROUTER_API_KEY is missing. Add it to .env and restart the server.'
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

import { OPENROUTER_MODEL_PRIORITY } from '../src/ai/config/model';

const apiKey = process.env.OPENROUTER_API_KEY?.trim();

if (!apiKey) {
  throw new Error(
    'OPENROUTER_API_KEY is missing. Add it to .env before running this check.'
  );
}

type OpenRouterModelList = {
  data?: Array<{ id?: string; supported_parameters?: string[] }>;
};

async function main() {
  const response = await fetch('https://openrouter.ai/api/v1/models', {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `OpenRouter rejected the request (HTTP ${response.status}). Check OPENROUTER_API_KEY and network access.`
    );
  }

  const payload = (await response.json()) as OpenRouterModelList;
  const unavailable = OPENROUTER_MODEL_PRIORITY.filter(model => !payload.data?.some(({ id }) => id === model));
  if (unavailable.length) throw new Error(`OpenRouter is reachable, but these fallback models are unavailable: ${unavailable.join(', ')}.`);

  console.log(`OpenRouter is reachable and all fallback models are listed: ${OPENROUTER_MODEL_PRIORITY.join(' -> ')}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});

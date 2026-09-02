import { config } from 'dotenv';

config();

const apiKey = process.env.OPENROUTER_API_KEY?.trim();
const model =
  process.env.OPENROUTER_MODEL?.trim() ||
  'nvidia/nemotron-3.5-content-safety:free';

if (!apiKey) {
  throw new Error(
    'OPENROUTER_API_KEY is missing. Add it to .env before running this check.'
  );
}

type OpenRouterModelList = {
  data?: Array<{ id?: string }>;
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
  const modelAvailable = payload.data?.some(({ id }) => id === model) ?? false;

  if (!modelAvailable) {
    throw new Error(
      `OpenRouter is reachable, but the configured model "${model}" is unavailable. Set OPENROUTER_MODEL to an available model.`
    );
  }

  console.log(`OpenRouter is reachable and the configured model is available: ${model}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});

import { config } from 'dotenv';

config();

const apiKey = process.env.OPENROUTER_API_KEY?.trim();
const model =
  process.env.OPENROUTER_MODEL?.trim() ||
  'liquid/lfm-2.5-2.6b:free';

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
  const configuredModel = payload.data?.find(({ id }) => id === model);

  if (!configuredModel) {
    throw new Error(
      `OpenRouter is reachable, but the configured model "${model}" is unavailable. Set OPENROUTER_MODEL to an available model.`
    );
  }

  if (!configuredModel.supported_parameters?.includes('response_format')) {
    throw new Error(
      `The configured model "${model}" does not advertise response_format support. Choose a model that supports structured output.`
    );
  }

  console.log(`OpenRouter is reachable and the configured model supports structured output: ${model}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});

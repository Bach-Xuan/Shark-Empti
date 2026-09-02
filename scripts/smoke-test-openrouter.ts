import { config } from 'dotenv';
import { genkit, z } from 'genkit';
import { openAICompatible } from '@genkit-ai/compat-oai';

config();

const apiKey = process.env.OPENROUTER_API_KEY?.trim();
const model =
  process.env.OPENROUTER_MODEL?.trim() ||
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free';

if (!apiKey) {
  throw new Error(
    'OPENROUTER_API_KEY is missing. Add it to .env before running this smoke test.'
  );
}

async function main() {
  const ai = genkit({
    plugins: [
      openAICompatible({
        name: 'openai',
        apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        fetch: globalThis.fetch,
        maxRetries: 2,
        timeout: 60_000,
      }),
    ],
    model: `openai/${model}`,
  });

  const { output } = await ai.generate({
    prompt: 'Return valid JSON with exactly one boolean key named ok set to true.',
    output: {
      schema: z.object({ ok: z.boolean() }),
    },
  });

  if (!output?.ok) {
    throw new Error('The model did not return the expected structured output.');
  }

  console.log(`Genkit structured-output smoke test passed: ${model}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});

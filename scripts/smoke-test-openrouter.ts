import { config } from 'dotenv';
import { genkit, z } from 'genkit';
import { openAICompatible } from '@genkit-ai/compat-oai';

config();

const apiKey = process.env.OPENROUTER_API_KEY?.trim();
const model =
  process.env.OPENROUTER_MODEL?.trim() ||
  'liquid/lfm-2.5-2.6b:free';

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

  const questionSchema = z.object({
    questions: z.array(z.object({
      question: z.string(),
      options: z.array(z.string()),
      correct: z.string(),
      explanation: z.string(),
    })).length(1),
  });
  const question = await ai.generate({
    prompt: 'Create exactly one Grade 8 multiple-choice math question about linear equations with four options. Return JSON only.',
    output: {
      schema: questionSchema,
    },
  });

  if (!question.output || question.output.questions[0].options.length !== 4) {
    throw new Error('The model did not return the expected quiz schema.');
  }

  const chat = await ai.generate({
    prompt: 'Reply to a student asking how to improve at linear equations. Return JSON only.',
    output: { schema: z.object({ aiResponse: z.string().min(1) }) },
  });
  if (!chat.output?.aiResponse.trim()) throw new Error('The model did not return the expected chatbot schema.');

  console.log(`Genkit quiz and chatbot structured-output smoke test passed: ${model}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});

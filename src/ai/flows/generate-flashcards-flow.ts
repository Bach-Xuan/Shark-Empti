'use server';

/**
 * @fileOverview AI flow to generate conceptual flashcards.
 */

import { ai, getAiWithKey } from '@/ai/genkit';
import { z } from 'genkit';
import { executeWithFallback } from '@/ai/lib/fallback';
import {
  DEFAULT_GENERATION_CONFIG
}
from "@/ai/config/safety";

const GenerateFlashcardsInputSchema = z.object({
  topic: z.string(),
  numCards: z.number(),
  language: z.enum(['en', 'vi']),
});
export type GenerateFlashcardsInput = z.infer<typeof GenerateFlashcardsInputSchema>;

const FlashcardSchema = z.object({
  front: z.string().describe('Short question, cue, or concept prompt. Use LaTeX for math/science.'),
  back: z.string().describe('Concise explanation or answer. Use LaTeX for math/science.'),
});

const GenerateFlashcardsOutputSchema = z.object({
  cards: z.array(FlashcardSchema),
});
export type GenerateFlashcardsOutput = z.infer<typeof GenerateFlashcardsOutputSchema>;

const SYSTEM_PROMPT = `You are an expert educator Shark Guru. Create high-quality, conceptual flashcards.
Rules:
1. Focused: Each card must focus on ONE single idea or definition.
2. Academic: Prioritize theory, rules, and core concepts over trivia.
3. LaTeX: Use LaTeX ($...$ or $$...$$) for any mathematical or scientific notation.
4. Language: Strict compliance with the requested language.
5. Clarity: The 'front' should be a provocative prompt or question. The 'back' should be a clear, definitive explanation.`;

export async function generateFlashcards(input: GenerateFlashcardsInput): Promise<GenerateFlashcardsOutput> {
  return generateFlashcardsFlow(input);
}

const generateFlashcardsFlow = ai.defineFlow(
  {
    name: 'generateFlashcardsFlow',
    inputSchema: GenerateFlashcardsInputSchema,
    outputSchema: GenerateFlashcardsOutputSchema,
  },
  async (input) => {
    return executeWithFallback(async (apiKey) => {
      const tempAi = getAiWithKey(apiKey);
      const { output } = await tempAi.generate({
        system: SYSTEM_PROMPT,
        prompt: `Topic: "${input.topic}"
Count: ${input.numCards}
Language: ${input.language === 'vi' ? 'Vietnamese' : 'English'}`,
        output: { schema: GenerateFlashcardsOutputSchema },
        config: DEFAULT_GENERATION_CONFIG
      });
      if (!output) throw new Error('Failed to generate flashcards.');
      return output;
    });
  }
);

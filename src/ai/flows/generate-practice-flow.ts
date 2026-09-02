'use server';

/**
 * @fileOverview AI flow to generate practice questions based on past mistakes.
 */

import { ai, getAiWithKey } from '@/ai/genkit';
import { z } from 'genkit';
import { executeWithFallback } from '@/ai/lib/fallback';
import {
  DEFAULT_GENERATION_CONFIG
}
from "@/ai/config/safety";

const GeneratePracticeInputSchema = z.object({
  concept: z.string(),
  numQuestions: z.number(),
  language: z.enum(['en', 'vi']),
});
export type GeneratePracticeInput = z.infer<typeof GeneratePracticeInputSchema>;

const PracticeQuestionSchema = z.object({
  question: z.string().describe('New practice question testing the concept. Use LaTeX.'),
  type: z.enum(['Multiple Choice', 'Short Answer']),
  options: z.array(z.string()).optional().describe('4 unique options if MCQ.'),
  correct: z.string().describe('The correct answer.'),
  explanation: z.string().describe('Step-by-step logic. Use LaTeX.'),
});

const GeneratePracticeOutputSchema = z.object({
  questions: z.array(PracticeQuestionSchema),
});
export type GeneratePracticeOutput = z.infer<typeof GeneratePracticeOutputSchema>;

const SYSTEM_PROMPT = `You are Shark Guru. Your goal is to help students overcome mistakes in specific concepts.
Generate NEW practice questions that test the logic behind common errors in the target area.
Rules:
1. VARIATION: Do NOT repeat the same scenario. Change numbers, names, and contexts.
2. PEDAGOGY: The explanation should directly address the "why" to prevent future errors.
3. FORMAT: 50/50 mix of MCQ and Short Answer unless impossible.
4. LaTeX: Use LaTeX for ALL academic expressions.
5. NO TRIVIA: Test application and comprehension skills.`;

export async function generatePractice(input: GeneratePracticeInput): Promise<GeneratePracticeOutput> {
  return generatePracticeFlow(input);
}

const generatePracticeFlow = ai.defineFlow(
  {
    name: 'generatePracticeFlow',
    inputSchema: GeneratePracticeInputSchema,
    outputSchema: GeneratePracticeOutputSchema,
  },
  async (input) => {
    return executeWithFallback(async (apiKey) => {
      const tempAi = getAiWithKey(apiKey);
      const { output } = await tempAi.generate({
        system: SYSTEM_PROMPT,
        prompt: `Target Concept: "${input.concept}"
Question Count: ${input.numQuestions}
Language: ${input.language === 'vi' ? 'Vietnamese' : 'English'}`,
        output: { schema: GeneratePracticeOutputSchema },
        config: DEFAULT_GENERATION_CONFIG
      });
      if (!output) throw new Error('Failed to generate practice questions.');
      return output;
    });
  }
);

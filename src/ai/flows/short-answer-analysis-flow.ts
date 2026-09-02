'use server';

/**
 * @fileOverview A Genkit flow for evaluating short text answers with fallback support.
 */

import { ai, getAiWithKey } from '@/ai/genkit';
import { z } from 'genkit';
import { executeWithFallback } from '@/ai/lib/fallback';
import { AppResult, asAiResult } from '@/lib/app-error';
import {
  DEFAULT_GENERATION_CONFIG
}
from "@/ai/config/safety";

const ShortAnswerAnalysisInputSchema = z.object({
  userAnswer: z.string(),
  questionText: z.string(),
  correctAnswer: z.string(),
  language: z.enum(['en', 'vi']),
});
export type ShortAnswerAnalysisInput = z.infer<typeof ShortAnswerAnalysisInputSchema>;

const ShortAnswerAnalysisOutputSchema = z.object({
  isCorrect: z.boolean(),
  feedback: z.string(),
  confidence: z.number(),
});
export type ShortAnswerAnalysisOutput = z.infer<typeof ShortAnswerAnalysisOutputSchema>;

const SYSTEM_PROMPT = `You are Shark Guru evaluating a student's answer. Be flexible with phrasing but ensure conceptual correctness. Return feedback in the requested language.`;

export async function shortAnswerAnalysis(input: ShortAnswerAnalysisInput): Promise<AppResult<ShortAnswerAnalysisOutput>> {
  return asAiResult(() => shortAnswerAnalysisFlow(input));
}

const shortAnswerAnalysisFlow = ai.defineFlow(
  {
    name: 'shortAnswerAnalysisFlow',
    inputSchema: ShortAnswerAnalysisInputSchema,
    outputSchema: ShortAnswerAnalysisOutputSchema,
  },
  async (input) => {
    return executeWithFallback(async (apiKey) => {
      const tempAi = getAiWithKey(apiKey);
      const { output } = await tempAi.generate({
        system: SYSTEM_PROMPT,
        prompt: `Question: ${input.questionText}
Key: ${input.correctAnswer}
Student: ${input.userAnswer}
Language: ${input.language === 'vi' ? 'Vietnamese' : 'English'}`,
        output: { schema: ShortAnswerAnalysisOutputSchema },
        config: DEFAULT_GENERATION_CONFIG
      });
      if (!output) throw new Error('Analysis failed.');
      return output;
    });
  }
);

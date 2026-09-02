'use server';

/**
 * @fileOverview This file implements a Genkit flow to validate if a topic is academic and consistent with the subject.
 */

import { ai, getAiWithKey } from '@/ai/genkit';
import { z } from 'genkit';
import { executeWithFallback } from '@/ai/lib/fallback';
import {
  DEFAULT_GENERATION_CONFIG
}
from "@/ai/config/safety";

const AcademicValidationInputSchema = z.object({
  topic: z.string().describe('The topic to validate.'),
  subject: z.string().optional().describe('The selected subject.'),
  grade: z.string().optional().describe('The selected grade.'),
  language: z.enum(['en', 'vi']).describe('The language for the reason.'),
});
export type AcademicValidationInput = z.infer<typeof AcademicValidationInputSchema>;

const AcademicValidationOutputSchema = z.object({
  isValid: z.boolean().describe('Whether the configuration (subject, grade, topic) is valid for quiz generation.'),
  reason: z.string().optional().describe('Brief reason if invalid, in the requested language.'),
});
export type AcademicValidationOutput = z.infer<typeof AcademicValidationOutputSchema>;

const SYSTEM_PROMPT = `You are an academic advisor Shark Guru. Evaluate if the following quiz configuration is suitable and consistent.
  
Validation Rules:
1. Academic Check: The topic must be relevant to academic subjects (Science, Math, History, Literature, etc.).
2. Consistency Check: If a Subject is specified, the Topic must belong to that subject (e.g., Topic "Newton's Laws" is consistent with Subject "Physics", but not with "Literature").
3. Clarity Check: The topic must be specific enough to generate a quiz. If it's too vague (e.g., "Math" or "Fun things"), ask for more details.
4. Grade Context: Consider if the topic is generally appropriate for the specified grade.

Return a JSON object with "isValid" (boolean) and "reason" (string, explain in the requested language).`;

export async function validateAcademicTopic(input: AcademicValidationInput): Promise<AcademicValidationOutput> {
  return academicValidationFlow(input);
}

const academicValidationFlow = ai.defineFlow(
  {
    name: 'academicValidationFlow',
    inputSchema: AcademicValidationInputSchema,
    outputSchema: AcademicValidationOutputSchema,
  },
  async (input) => {
    return executeWithFallback(async (apiKey) => {
      const tempAi = getAiWithKey(apiKey);
      const { output } = await tempAi.generate({
        system: SYSTEM_PROMPT,
        prompt: `Topic: "${input.topic}"
Subject: "${input.subject || 'None'}"
Grade: "${input.grade || 'None'}"
Language for Reason: ${input.language === 'vi' ? 'Vietnamese' : 'English'}`,
        output: { schema: AcademicValidationOutputSchema },
        config: DEFAULT_GENERATION_CONFIG
      });
      if (!output) throw new Error('No output received from validation model.');
      return output;
    });
  }
);

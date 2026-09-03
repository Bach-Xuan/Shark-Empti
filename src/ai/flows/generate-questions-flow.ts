'use server';

/**
 * @fileOverview This file implements a Genkit flow to generate academic quiz questions with fallback support and LaTeX rendering.
 */

import { ai, getAiWithKey } from '@/ai/genkit';
import { z } from 'genkit';
import { executeWithFallback } from '@/ai/lib/fallback';
import { AppResult, asAiResult } from '@/lib/app-error';
import {
  DEFAULT_GENERATION_CONFIG
}
from "@/ai/config/safety";
import { LATEX_RULE, SHARK_GURU_ROLE, languageRule } from '@/ai/config/prompts';

const GenerateQuestionsInputSchema = z.object({
  subject: z.string().optional(),
  grade: z.string().optional(),
  topic: z.string(),
  excludeNotes: z.string().optional().describe('Concepts or sub-topics to exclude from the generation.'),
  type: z.string(),
  difficulty: z.string(),
  numQuestions: z.number(),
  language: z.enum(['en', 'vi']),
  arenaMode: z.boolean().optional(),
});
export type GenerateQuestionsInput = z.infer<typeof GenerateQuestionsInputSchema>;

const QuestionSchema = z.object({
  question: z.string().describe('The text of the question. Use LaTeX for math/science.'),
  section: z.string().describe('The specific section or sub-topic within the main topic that this question belongs to (e.g., for "Physics", a section could be "Kinematics").'),
  options: z.array(z.string()).optional().describe('Multiple choice options. Only for Multiple Choice or True/False types. Use LaTeX if needed.'),
  correct: z.string().describe('The correct answer. Use LaTeX if needed.'),
  explanation: z.string().describe('A brief explanation of why the answer is correct. Use LaTeX for math/science.'),
  type: z.string().describe('The type of question.'),
  difficulty: z.string().describe('The difficulty level.'),
});

const GenerateQuestionsOutputSchema = z.object({
  questions: z.array(QuestionSchema),
});
export type GenerateQuestionsOutput = z.infer<typeof GenerateQuestionsOutputSchema>;

const SYSTEM_PROMPT = `${SHARK_GURU_ROLE} Generate academic quiz questions strictly from the supplied configuration.

Mandatory Rules:
1. ${LATEX_RULE}
2. Chemistry Nomenclature: Use international IUPAC names (e.g., 'Aluminium', 'Sodium chloride') even in Vietnamese.
3. Context: For Vietnamese Grade level, align with the official Vietnamese National Curriculum.
4. Types: Ensure 'Multiple Choice' has 4 options, 'True/False' has exactly 2 options. 'Short Answer' has NO options.
5. Language Consistency: If the Subject is 'English', the question and options MUST be in English. Otherwise, use the requested language.
6. Vietnamese True/False: For 'True/False' questions in Vietnamese, the options MUST be exactly ["Đúng", "Sai"].
7. Uniqueness: Ensure all multiple-choice options for a single question are unique.
8. Tone: Academic, clear, and encouraging.
9. Exclusions: STRICTLY DO NOT generate questions related to any concepts or sub-topics mentioned in the "Exclude" list.
10. Sections: For every question, identify the specific sub-topic or section it belongs to within the main topic. Be concise (max 3-4 words).
11. Arena mode: when Arena Mode is true, every Short Answer must have one finite numeric answer only. The answer must use a dot decimal separator, contain no unit or prose, and the question must explicitly request only that number.`;

export async function generateQuestions(input: GenerateQuestionsInput): Promise<AppResult<GenerateQuestionsOutput>> {
  return asAiResult(() => generateQuestionsFlow(input));
}

const generateQuestionsFlow = ai.defineFlow(
  {
    name: 'generateQuestionsFlow',
    inputSchema: GenerateQuestionsInputSchema,
    outputSchema: GenerateQuestionsOutputSchema,
  },
  async (input) => {
    return executeWithFallback(async (apiKey) => {
      const tempAi = getAiWithKey(apiKey);
      const { output } = await tempAi.generate({
        system: SYSTEM_PROMPT,
        prompt: `${languageRule(input.language)}
Subject: ${input.subject || 'None'}
Grade: ${input.grade || 'None'}
Topic: ${input.topic}
Exclude (DO NOT INCLUDE): ${input.excludeNotes || 'None'}
Type: ${input.type}
Difficulty: ${input.difficulty}
Count: ${input.numQuestions}
Arena Mode: ${input.arenaMode ? 'true' : 'false'}`,
        output: { schema: GenerateQuestionsOutputSchema },
        config: DEFAULT_GENERATION_CONFIG
      });
      
      if (!output) throw new Error('No questions generated.');
      return output;
    });
  }
);

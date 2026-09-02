
'use server';

/**
 * @fileOverview This file implements a Genkit flow for bilingual quiz performance feedback.
 */

import { ai, getAiWithKey } from '@/ai/genkit';
import { z } from 'genkit';
import { executeWithFallback } from '@/ai/lib/fallback';
import { AppResult, asAiResult } from '@/lib/app-error';
import {
  DEFAULT_GENERATION_CONFIG
}
from "@/ai/config/safety";

const QuizResultSchema = z.object({
  question: z.string(),
  correct: z.string(),
  userAnswer: z.string(),
  isCorrect: z.boolean(),
  timeTakenSeconds: z.number(),
  explanation: z.string(),
  type: z.string(),
  difficulty: z.string(),
});

const LanguageAnalysisSchema = z.object({
  strengths: z.array(z.string()).describe('List of specific Highlights (Điểm nổi bật).'),
  weaknesses: z.array(z.string()).describe('List of specific Areas for Improvement (Điểm cần cải thiện).'),
  recommendations: z.array(z.string()).describe('List of actionable study recommendations.'),
});

const PersonalizedQuizFeedbackInputSchema = z.object({
  quizResults: z.array(QuizResultSchema),
  originalTopic: z.string().describe('The topic entered by the user.'),
});
export type PersonalizedQuizFeedbackInput = z.infer<typeof PersonalizedQuizFeedbackInputSchema>;

const PersonalizedQuizFeedbackOutputSchema = z.object({
  topicEn: z.string().describe('English translation of the topic.'),
  topicVi: z.string().describe('Vietnamese translation of the topic.'),
  en: LanguageAnalysisSchema.describe('Feedback in English.'),
  vi: LanguageAnalysisSchema.describe('Feedback in Vietnamese.'),
  errorCategories: z.record(z.string(), z.number()).describe('Count of errors by category.'),
  cognitiveMetrics: z.object({
    conceptMastery: z.number(),
    applicationSkill: z.number(),
    problemDecomposition: z.number(),
    logicalReasoning: z.number(),
    errorAwareness: z.number(),
    instructionFollowing: z.number(),
  }).describe('Scores from 0-100 for each cognitive dimension.'),
});
export type PersonalizedQuizFeedbackOutput = z.infer<typeof PersonalizedQuizFeedbackOutputSchema>;

const SYSTEM_PROMPT = `You are Shark Guru, a bilingual expert cognitive learning analyst.
Analyze the student's quiz results and provide feedback in BOTH English and Vietnamese.

CRITICAL REQUIREMENT: Use these refined criteria for analysis:

ERROR CATEGORIZATION RULES:
1. Misinterpretation (Hiểu sai đề):
   - Asked for "false", user chose "true".
   - Asked for "cause", user gave "result".
   - Asked for "unit", user gave only "number".
   - Ignored "except/not".
   - Answer is reasonable but for a DIFFERENT question.
2. Concept Error (Lỗi Khái niệm):
   - Fails on basic definitions, principles, or core formulas.
   - Mixes up two similar core concepts.
   - Incorrect core terminology.
3. Reasoning Error (Lỗi Tư duy):
   - Correct on base/theory questions but wrong on multi-step reasoning in the SAME topic.
   - Logical contradiction between different answers in the same session.
4. Careless Mistake (Lỗi Bất cẩn):
   - Missing negative sign, 1-digit deviation, unit mixup in short answer.
   - Wrong answer provided in < 4 seconds.

COGNITIVE SKILLS SCORING (0-100):
- Concept Mastery: + if correct on definitions/principles. - if Concept Error occurs.
- Application Skill: + if correct on application levels. - if fails application while concept is strong.
- Problem Decomposition: + if correct on multi-step processes.
- Logical Reasoning: + if correct on reasoning tags and consistent. - if Reasoning Error occurs.
- Error Awareness: - if same error type repeats. + if correcting a previous error pattern.
- Instruction Following: - if Misinterpretation occurs. + if no misinterpretation for many questions.

HIGHLIGHTS (DIỂM NỔI BẬT):
Label as Highlight ONLY if:
- Stable performance: 5+ correct in group AND accuracy >= 80%.
- No same main error repeats more than once.
- Core theory is majority correct.

AREAS FOR IMPROVEMENT (ĐIỂM CẦN CẢI THIỆN):
Label as Improvement ONLY if systematic error exists:
- 5+ questions in group AND (accuracy <= 50% OR main error repeats >= 3 times OR theory accuracy <= 60%).
- Or: Correct on basic but failing all reasoning questions in the same topic.

Output must be a valid JSON object matching the defined schema. Use LaTeX for math/science.`;

export async function personalizedQuizPerformanceFeedback(input: PersonalizedQuizFeedbackInput): Promise<AppResult<PersonalizedQuizFeedbackOutput>> {
  return asAiResult(() => personalizedQuizFeedbackFlow(input));
}

const personalizedQuizFeedbackFlow = ai.defineFlow(
  {
    name: 'personalizedQuizFeedbackFlow',
    inputSchema: PersonalizedQuizFeedbackInputSchema,
    outputSchema: PersonalizedQuizFeedbackOutputSchema,
  },
  async (input) => {
    return executeWithFallback(async (apiKey) => {
      const tempAi = getAiWithKey(apiKey);
      const { output } = await tempAi.generate({
        system: SYSTEM_PROMPT,
        prompt: `Results to Analyze: ${JSON.stringify(input.quizResults)}
Original Topic: "${input.originalTopic}"`,
        output: { schema: PersonalizedQuizFeedbackOutputSchema },
        config: DEFAULT_GENERATION_CONFIG
      });
      if (!output) throw new Error('Failed to generate bilingual analysis.');
      return output;
    });
  }
);

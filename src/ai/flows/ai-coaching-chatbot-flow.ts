
'use server';

/**
 * @fileOverview Genkit flow for the Shark Guru AI Coaching Chatbot with LaTeX support.
 */

import { ai, getAiWithKey } from '@/ai/genkit';
import { z } from 'genkit';
import { executeWithFallback } from '@/ai/lib/fallback';
import {
  DEFAULT_GENERATION_CONFIG
}
from "@/ai/config/safety";

const CognitiveMetricsSchema = z.object({
  conceptMastery: z.number().min(0).max(100),
  applicationSkill: z.number().min(0).max(100),
  problemDecomposition: z.number().min(0).max(100),
  logicalReasoning: z.number().min(0).max(100),
  errorAwareness: z.number().min(0).max(100),
  instructionFollowing: z.number().min(0).max(100),
});

const QuizSummarySchema = z.object({
  totalQuestions: z.number(),
  correctAnswers: z.number(),
  incorrectAnswers: z.number(),
  cognitiveMetrics: CognitiveMetricsSchema,
  errorAnalysis: z.record(z.string(), z.number()),
});

const ChatMessageSchema = z.object({
  role: z.enum(['user', 'model']),
  message: z.string(),
});

const AiCoachingChatbotInputSchema = z.object({
  userMessage: z.string(),
  preferredLanguage: z.enum(['en', 'vi']),
  isVietnamese: z.boolean().optional(),
  quizSummary: QuizSummarySchema,
  quizQuestions: z.array(z.object({
    questionText: z.string(),
    correctAnswer: z.string(),
    userAnswer: z.string(),
    isCorrect: z.boolean(),
    explanation: z.string(),
    errorCategory: z.string().optional(),
  })),
  chatHistory: z.array(ChatMessageSchema).optional(),
});

export type AiCoachingChatbotInput = z.infer<typeof AiCoachingChatbotInputSchema>;

const AiCoachingChatbotOutputSchema = z.object({
  aiResponse: z.string(),
});

export type AiCoachingChatbotOutput = z.infer<typeof AiCoachingChatbotOutputSchema>;

const SYSTEM_PROMPT = `You are Shark Guru 🦈 - a super friendly learning analysis expert! 

RESPONSE LANGUAGE: Must strictly follow the requested language.

PRIMARY TASKS:
- Use detailed analysis logic for errors: Misinterpretation (asked X chose Y), Concept Error (theory failure), Reasoning Error (logic gap), and Careless Mistake (fast/small deviation).
- Provide advice based on 6 core skills: Concept Mastery, Application, Problem Decomposition, Logical Reasoning, Error Awareness, and Instruction Following.
- Highlights (Điểm nổi bật): Stable patterns of 5+ correct answers, >=80% accuracy.
- Areas for Improvement (Điểm cần cải thiện): Systematic error patterns, repeated main errors.
- Always use LaTeX ($...$) for academic expressions.
- Always be friendly and encouraging (using 🦈, ✨, ✅).`;

export async function aiCoachingChatbotForQuizReview(input: AiCoachingChatbotInput): Promise<AiCoachingChatbotOutput> {
  return aiCoachingChatbotFlow(input);
}

const aiCoachingChatbotFlow = ai.defineFlow(
  {
    name: 'aiCoachingChatbotFlow',
    inputSchema: AiCoachingChatbotInputSchema,
    outputSchema: AiCoachingChatbotOutputSchema,
  },
  async (input) => {
    return executeWithFallback(async (apiKey) => {
      const tempAi = getAiWithKey(apiKey);
      const history = input.chatHistory?.map(h => ({
        role: h.role,
        content: [{ text: h.message }],
      })) || [];

      const { output } = await tempAi.generate({
        system: SYSTEM_PROMPT,
        history,
        prompt: `User Message: "${input.userMessage}"
Language: ${input.preferredLanguage === 'vi' ? 'Vietnamese' : 'English'}
Summary: Concept Mastery ${input.quizSummary.cognitiveMetrics.conceptMastery}%`,
        output: { schema: AiCoachingChatbotOutputSchema },
        config: DEFAULT_GENERATION_CONFIG
      });
      
      if (!output) throw new Error('No output received from Shark Guru.');
      return output;
    });
  }
);

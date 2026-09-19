import 'server-only';
import { buildAcademicValidationRequest,AcademicValidationInputSchema,AcademicValidationOutputSchema } from './flows/academic-validation-flow';
import { buildAiCoachingChatbotRequest,AiCoachingChatbotInputSchema,AiCoachingChatbotOutputSchema } from './flows/ai-coaching-chatbot-flow';
import { buildGenerateFlashcardsRequest,GenerateFlashcardsInputSchema,GenerateFlashcardsOutputSchema } from './flows/generate-flashcards-flow';
import { buildGeneratePracticeRequest,GeneratePracticeInputSchema,GeneratePracticeOutputSchema } from './flows/generate-practice-flow';
import { buildGenerateQuestionsRequest,GenerateQuestionsInputSchema,GenerateQuestionsOutputSchema } from './flows/generate-questions-flow';
import { buildPersonalizedQuizFeedbackRequest,PersonalizedQuizFeedbackInputSchema,PersonalizedQuizFeedbackOutputSchema } from './flows/personalized-quiz-feedback-flow';
import { buildShortAnswerAnalysisRequest,ShortAnswerAnalysisInputSchema,ShortAnswerAnalysisOutputSchema } from './flows/short-answer-analysis-flow';
import type { AiOperation } from './protocol';
import type { z } from 'zod';

export type AiMessage = { role: 'user' | 'assistant'; content: string };
export type BuiltAiRequest = { system: string; prompt: string; messages?: AiMessage[]; schema: z.ZodType<unknown> };
export type AiOperationDefinition = {
  inputSchema: z.ZodType<unknown>;
  outputSchema: z.ZodType<unknown>;
  buildRequest: (input: never) => Omit<BuiltAiRequest, 'schema'> & { schema?: z.ZodType<unknown> };
  costWeight: number;
  inputLimits: { maxSerializedBytes: number };
};

const registry = {
  'academic-validation': { inputSchema: AcademicValidationInputSchema, outputSchema: AcademicValidationOutputSchema, buildRequest: buildAcademicValidationRequest, costWeight: 1, inputLimits: { maxSerializedBytes: 8_192 } },
  'generate-questions': { inputSchema: GenerateQuestionsInputSchema, outputSchema: GenerateQuestionsOutputSchema, buildRequest: buildGenerateQuestionsRequest, costWeight: 3, inputLimits: { maxSerializedBytes: 32_768 } },
  'generate-flashcards': { inputSchema: GenerateFlashcardsInputSchema, outputSchema: GenerateFlashcardsOutputSchema, buildRequest: buildGenerateFlashcardsRequest, costWeight: 2, inputLimits: { maxSerializedBytes: 16_384 } },
  'generate-practice': { inputSchema: GeneratePracticeInputSchema, outputSchema: GeneratePracticeOutputSchema, buildRequest: buildGeneratePracticeRequest, costWeight: 2, inputLimits: { maxSerializedBytes: 16_384 } },
  'short-answer-analysis': { inputSchema: ShortAnswerAnalysisInputSchema, outputSchema: ShortAnswerAnalysisOutputSchema, buildRequest: buildShortAnswerAnalysisRequest, costWeight: 1, inputLimits: { maxSerializedBytes: 16_384 } },
  'personalized-quiz-feedback': { inputSchema: PersonalizedQuizFeedbackInputSchema, outputSchema: PersonalizedQuizFeedbackOutputSchema, buildRequest: buildPersonalizedQuizFeedbackRequest, costWeight: 4, inputLimits: { maxSerializedBytes: 131_072 } },
  'ai-coaching-chatbot': { inputSchema: AiCoachingChatbotInputSchema, outputSchema: AiCoachingChatbotOutputSchema, buildRequest: buildAiCoachingChatbotRequest, costWeight: 3, inputLimits: { maxSerializedBytes: 131_072 } },
} satisfies Record<AiOperation, AiOperationDefinition>;

export function getAiOperationDefinition(operation: AiOperation): AiOperationDefinition {
  return registry[operation] as AiOperationDefinition;
}

export function buildAiRequest(operation: AiOperation, input: unknown): BuiltAiRequest {
  const definition = getAiOperationDefinition(operation);
  const validated = definition.inputSchema.parse(input);
  const built = definition.buildRequest(validated as never);
  return { ...built, schema: built.schema ?? definition.outputSchema };
}

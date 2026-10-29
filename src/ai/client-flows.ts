'use client';
import { runAiOperation, type RunOptions } from './client';
import type { AcademicValidationInput,AcademicValidationOutput } from './flows/academic-validation-flow';
import type { AiCoachingChatbotInput,AiCoachingChatbotOutput } from './flows/ai-coaching-chatbot-flow';
import type { GenerateFlashcardsInput,GenerateFlashcardsOutput } from './flows/generate-flashcards-flow';
import type { GeneratePracticeInput,GeneratePracticeOutput } from './flows/generate-practice-flow';
import type { GenerateQuestionsInput,GenerateQuestionsOutput } from './flows/generate-questions-flow';
import type { PersonalizedQuizFeedbackInput,PersonalizedQuizFeedbackOutput } from './flows/personalized-quiz-feedback-flow';
import type { ShortAnswerAnalysisInput,ShortAnswerAnalysisOutput } from './flows/short-answer-analysis-flow';

export const validateAcademicTopic = (input: AcademicValidationInput, options?: RunOptions) => runAiOperation<AcademicValidationOutput>('academic-validation', input, options);
export const generateQuestions = (input: GenerateQuestionsInput, options?: RunOptions) => runAiOperation<GenerateQuestionsOutput>('generate-questions', input, options);
export const generateFlashcards = (input: GenerateFlashcardsInput, options?: RunOptions) => runAiOperation<GenerateFlashcardsOutput>('generate-flashcards', input, options);
export const generatePractice = (input: GeneratePracticeInput, options?: RunOptions) => runAiOperation<GeneratePracticeOutput>('generate-practice', input, options);
export const shortAnswerAnalysis = (input: ShortAnswerAnalysisInput, options?: RunOptions) => runAiOperation<ShortAnswerAnalysisOutput>('short-answer-analysis', input, options);
export const personalizedQuizPerformanceFeedback = (input: PersonalizedQuizFeedbackInput, options?: RunOptions) => runAiOperation<PersonalizedQuizFeedbackOutput>('personalized-quiz-feedback', input, options);
export const aiCoachingChatbotForQuizReview = (input: AiCoachingChatbotInput, options?: RunOptions) => runAiOperation<AiCoachingChatbotOutput>('ai-coaching-chatbot', input, options);

export type { AcademicValidationInput,AcademicValidationOutput,AiCoachingChatbotInput,AiCoachingChatbotOutput,GenerateFlashcardsInput,GenerateFlashcardsOutput,GeneratePracticeInput,GeneratePracticeOutput,GenerateQuestionsInput,GenerateQuestionsOutput,PersonalizedQuizFeedbackInput,PersonalizedQuizFeedbackOutput,ShortAnswerAnalysisInput,ShortAnswerAnalysisOutput };

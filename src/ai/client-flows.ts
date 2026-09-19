'use client';
import { runAiOperation } from './client';
import type { AcademicValidationInput,AcademicValidationOutput } from './flows/academic-validation-flow';
import type { AiCoachingChatbotInput,AiCoachingChatbotOutput } from './flows/ai-coaching-chatbot-flow';
import type { GenerateFlashcardsInput,GenerateFlashcardsOutput } from './flows/generate-flashcards-flow';
import type { GeneratePracticeInput,GeneratePracticeOutput } from './flows/generate-practice-flow';
import type { GenerateQuestionsInput,GenerateQuestionsOutput } from './flows/generate-questions-flow';
import type { PersonalizedQuizFeedbackInput,PersonalizedQuizFeedbackOutput } from './flows/personalized-quiz-feedback-flow';
import type { ShortAnswerAnalysisInput,ShortAnswerAnalysisOutput } from './flows/short-answer-analysis-flow';

export const validateAcademicTopic = (input: AcademicValidationInput) => runAiOperation<AcademicValidationOutput>('academic-validation', input);
export const generateQuestions = (input: GenerateQuestionsInput) => runAiOperation<GenerateQuestionsOutput>('generate-questions', input);
export const generateFlashcards = (input: GenerateFlashcardsInput) => runAiOperation<GenerateFlashcardsOutput>('generate-flashcards', input);
export const generatePractice = (input: GeneratePracticeInput) => runAiOperation<GeneratePracticeOutput>('generate-practice', input);
export const shortAnswerAnalysis = (input: ShortAnswerAnalysisInput) => runAiOperation<ShortAnswerAnalysisOutput>('short-answer-analysis', input);
export const personalizedQuizPerformanceFeedback = (input: PersonalizedQuizFeedbackInput) => runAiOperation<PersonalizedQuizFeedbackOutput>('personalized-quiz-feedback', input);
export const aiCoachingChatbotForQuizReview = (input: AiCoachingChatbotInput) => runAiOperation<AiCoachingChatbotOutput>('ai-coaching-chatbot', input);

export type { AcademicValidationInput,AcademicValidationOutput,AiCoachingChatbotInput,AiCoachingChatbotOutput,GenerateFlashcardsInput,GenerateFlashcardsOutput,GeneratePracticeInput,GeneratePracticeOutput,GenerateQuestionsInput,GenerateQuestionsOutput,PersonalizedQuizFeedbackInput,PersonalizedQuizFeedbackOutput,ShortAnswerAnalysisInput,ShortAnswerAnalysisOutput };

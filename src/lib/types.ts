
/**
 * @fileOverview Centralized type definitions for the application.
 */

import type { StoredDate } from './date-format';
import { TranslationSet } from './translations';

export type Language = 'en' | 'vi';

export interface QuizConfig {
  subject: string;
  grade: string;
  topic: string;
  topicEn?: string;
  topicVi?: string;
  type: string;
  difficulty: string;
  numQuestions: string;
  timeLimit?: string;
  excludeNotes?: string;
}

export interface CognitiveMetrics {
  conceptMastery: number;
  applicationSkill: number;
  problemDecomposition: number;
  logicalReasoning: number;
  errorAwareness: number;
  instructionFollowing: number;
}

export interface LanguageAnalysis {
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

export interface QuizAnalysis {
  en: LanguageAnalysis;
  vi: LanguageAnalysis;
  errorCategories: Record<string, number>;
  cognitiveMetrics: CognitiveMetrics;
}

export interface QuizResultItem {
  question: string;
  section?: string;
  options?: string[];
  correct: string;
  userAnswer: string;
  isCorrect: boolean;
  timeTakenSeconds: number;
  explanation: string;
  type: string;
  difficulty: string;
  errorCategory?: string | null;
  aiFeedback?: string | null;
}

export interface QuizHistoryItem {
  id?: string;
  quizResults: QuizResultItem[];
  totalTime: number;
  config: QuizConfig;
  analysis?: QuizAnalysis;
  date: string;
  lang: Language;
}

export type AppView = 'setup' | 'quiz' | 'result' | 'dashboard' | 'profile' | 'forum' | 'playground' | 'arena';

export interface BaseViewProps {
  t: TranslationSet;
  lang: Language;
}

export interface ArenaExam {
  id: string;
  title: string;
  config: QuizConfig;
  authorId: string;
  authorName: string;
  authorPhoto: string;
  createdAt: StoredDate;
  totalAttempts: number;
  questions: QuizResultItem[];
}

export interface Flashcard {
  front: string;
  back: string;
}

export interface PracticeQuestion {
  question: string;
  type: 'Multiple Choice' | 'Short Answer';
  options?: string[];
  correct: string;
  explanation: string;
}

export interface ForumPost {
  id: string;
  title: string;
  content: string;
  subject: string;
  authorId: string;
  authorName: string;
  authorPhoto: string;
  createdAt: StoredDate;
  updatedAt?: StoredDate;
  likesCount: number;
  commentsCount: number;
  likedBy?: string[];
}

export interface ForumComment {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorPhoto: string;
  createdAt: StoredDate;
  updatedAt?: StoredDate;
  likesCount: number;
  likedBy?: string[];
}

export interface ArenaAttempt {
  id: string;
  examId: string;
  userId: string;
  userName: string;
  userPhoto: string;
  score: number;
  duration: number;
  createdAt: StoredDate;
}

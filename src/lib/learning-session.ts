import type { QuizConfig,QuizHistoryItem,QuizQuestion,QuizAnalysis } from './types';
export type { QuizQuestion } from './types';
type SessionData = { config: QuizConfig; questions: QuizQuestion[] | null };
export type LearningSession =
  | { status: 'setup'; config: null; questions: null; results: null }
  | (SessionData & { status: 'loading' | 'quiz'; results: null })
  | (SessionData & { status: 'result'; results: QuizHistoryItem });
export type SessionAction =
  | { type: 'start'; config: QuizConfig; questions: QuizQuestion[] | null }
  | { type: 'ready'; questions: QuizQuestion[] }
  | { type: 'finish'; results: QuizHistoryItem }
  | { type: 'recover-analysis'; analysis: QuizAnalysis; topicEn: string; topicVi: string }
  | { type: 'reset' };
export const initialSession: LearningSession = { status: 'setup', config: null, questions: null, results: null };
export function learningSessionReducer(state: LearningSession, action: SessionAction): LearningSession {
  switch (action.type) {
    case 'start': return { status: action.questions ? 'quiz' : 'loading', config: action.config, questions: action.questions, results: null };
    case 'reset': return initialSession;
    case 'ready': return state.status === 'loading' ? { ...state, status: 'quiz', questions: action.questions } : state;
    case 'finish': return state.status === 'quiz' || state.status === 'loading' ? { ...state, status: 'result', results: action.results } : state;
    case 'recover-analysis': return state.status === 'result' ? { ...state, results: {
      ...state.results, analysis: action.analysis,
      config: { ...state.results.config, topicEn: action.topicEn, topicVi: action.topicVi },
    } } : state;
  }
}

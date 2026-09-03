import type { QuizConfig, QuizHistoryItem, QuizResultItem } from './types';
export type QuizQuestion = Pick<QuizResultItem, 'question' | 'section' | 'options' | 'correct' | 'explanation' | 'type' | 'difficulty'>;
type SessionData = { config: QuizConfig; questions: QuizQuestion[] | null };
export type LearningSession =
  | { status: 'setup'; config: null; questions: null; results: null }
  | (SessionData & { status: 'loading' | 'quiz'; results: null })
  | (SessionData & { status: 'result'; results: QuizHistoryItem })
  | (SessionData & { status: 'error'; results: null; code: string });
export type SessionAction =
  | { type: 'start'; config: QuizConfig; questions: QuizQuestion[] | null }
  | { type: 'ready'; questions: QuizQuestion[] }
  | { type: 'finish'; results: QuizHistoryItem }
  | { type: 'fail'; code: string }
  | { type: 'reset' };
export const initialSession: LearningSession = { status: 'setup', config: null, questions: null, results: null };
export function learningSessionReducer(state: LearningSession, action: SessionAction): LearningSession {
  switch (action.type) {
    case 'start': return { status: action.questions ? 'quiz' : 'loading', config: action.config, questions: action.questions, results: null };
    case 'reset': return initialSession;
    case 'ready': return state.status === 'loading' ? { ...state, status: 'quiz', questions: action.questions } : state;
    case 'finish': return state.status === 'quiz' || state.status === 'loading' ? { ...state, status: 'result', results: action.results } : state;
    case 'fail': return state.config ? { ...state, status: 'error', results: null, code: action.code } : state;
  }
}

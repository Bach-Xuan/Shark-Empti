'use client';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { writeLearningRecord, saveHistoryFeedback } from '@/lib/learning-client';
import { useRequestScope } from './use-request-scope';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { initialSession, learningSessionReducer, type QuizQuestion } from '@/lib/learning-session';
import type { Language, QuizAnalysis, QuizConfig, QuizHistoryItem } from '@/lib/types';
import type { PersonalizedQuizFeedbackOutput } from '@/ai/client-flows';
import { readDraft, writeDraft, removeDraft, parseWith, sessionDraftSchema } from '@/lib/learning-drafts';
/** Owns session transitions and persistence. A reset invalidates all pending saves.
 * Quiz owns generation/answer feedback UI; navigation owns only non-session sections. */
export function useLearningSession(user: Pick<User, 'uid' | 'getIdToken'> | null, lang: Language) {
  const writes = useRequestScope();
  const [session, dispatch] = useReducer(learningSessionReducer, initialSession);
  const [draftAvailable, setDraftAvailable] = useState(true);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [restoredCompletion, setRestoredCompletion] = useState<QuizHistoryItem | null>(null);
  const generation = useRef(0);
  const saveId = useRef<string | null>(null);
  const pendingPayload = useRef<QuizHistoryItem | null>(null);
  const renderedSaveId = draftId;
  const userId = user?.uid;

  useEffect(() => {
    if (!userId) return;
    const draft = readDraft(userId, 'quiz-session', parseWith(sessionDraftSchema));
    if (draft) {
      saveId.current = draft.id;
      setDraftId(draft.id);
      if ('completion' in draft) {
        pendingPayload.current = draft.completion;
        setRestoredCompletion(draft.completion);
      }
      dispatch({ type: 'start', config: draft.config, questions: draft.questions });
    }
  }, [userId]);

  useEffect(() => {
    if (!userId || session.status !== 'quiz' || !saveId.current) return;
    setDraftAvailable(writeDraft(userId, 'quiz-session', pendingPayload.current
      ? { id: saveId.current, completion: pendingPayload.current }
      : { id: saveId.current, config: session.config, questions: session.questions }));
  }, [userId, session]);

  useEffect(() => {
    const lifecycle = generation;
    return () => { lifecycle.current++; };
  }, []);

  const reset = useCallback(() => {
    writes.cancel();
    generation.current++;
    saveId.current = null;
    pendingPayload.current = null;
    setRestoredCompletion(null);
    setDraftId(null);
    if (userId) {
      removeDraft(userId, 'quiz-session');
      removeDraft(userId, 'quiz-progress');
    }
    dispatch({ type: 'reset' });
  }, [userId, writes]);

  const start = useCallback((config: QuizConfig, questions: QuizQuestion[] | null = null) => {
    writes.cancel();
    generation.current++;
    saveId.current = crypto.randomUUID();
    pendingPayload.current = null;
    setRestoredCompletion(null);
    setDraftId(saveId.current);
    if (userId) removeDraft(userId, 'quiz-progress');
    dispatch({ type: 'start', config, questions });
  }, [userId, writes]);

  const ready = useCallback((questions: QuizQuestion[]) => dispatch({ type: 'ready', questions }), []);

  const finish = useCallback(async (results: Omit<QuizHistoryItem, 'date' | 'lang'>, analysis?: QuizAnalysis): Promise<boolean> => {
    if (!user || !userId) return false;
    const epoch = generation.current;
    // Pick the write DTO explicitly: legacy/draft readers may supply IDs and metadata.
    // Freeze all fields, including locale/date, before the first uncertain network write.
    const combined: QuizHistoryItem = pendingPayload.current ??= JSON.parse(JSON.stringify({
      config: results.config, quizResults: results.quizResults, totalTime: results.totalTime,
      ...((analysis ?? results.analysis) ? { analysis: analysis ?? results.analysis } : {}),
      schemaVersion: 2, date: Date.now(), lang,
    }));
    const recordId = saveId.current ??= crypto.randomUUID();
    setDraftAvailable(writeDraft(userId, 'quiz-session', { id: recordId, completion: combined }));
    try {
      await writeLearningRecord(user, 'history', recordId, combined, writes.start());
      if (generation.current !== epoch) return false;
      removeDraft(userId, 'quiz-session');
      removeDraft(userId, 'quiz-progress');
      dispatch({ type: 'finish', results: combined });
      return true;
    } catch (cause) {
      if (generation.current === epoch) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `users/${userId}/history/${recordId}`, operation: 'create' }, cause));
      }
      return false;
    }
  }, [user, userId, lang, writes]);

  const recoverAnalysis = useCallback(async (feedback: PersonalizedQuizFeedbackOutput): Promise<boolean> => {
    if (!user || !userId || session.status !== 'result' || !renderedSaveId || saveId.current !== renderedSaveId) return false;
    const epoch = generation.current;
    const { topicEn, topicVi, ...analysis } = feedback;
    try {
      await saveHistoryFeedback(user, renderedSaveId, { analysis, topicEn, topicVi }, writes.start());
      if (generation.current !== epoch || saveId.current !== renderedSaveId) return false;
      dispatch({ type: 'recover-analysis', analysis, topicEn, topicVi });
      return true;
    } catch (cause) {
      if (generation.current === epoch) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `users/${userId}/history/${renderedSaveId}`, operation: 'update' }, cause));
      }
      return false;
    }
  }, [user, userId, session, renderedSaveId, writes]);

  return { session, reset, start, ready, finish, recoverAnalysis, draftId, draftAvailable, restoredCompletion };
}

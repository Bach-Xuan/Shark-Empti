'use client';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { doc, setDoc, type Firestore } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { initialSession, learningSessionReducer, type QuizQuestion } from '@/lib/learning-session';
import type { Language, QuizAnalysis, QuizConfig, QuizHistoryItem } from '@/lib/types';
import type { PersonalizedQuizFeedbackOutput } from '@/ai/client-flows';
import { readDraft, writeDraft, removeDraft, parseWith, sessionDraftSchema } from '@/lib/learning-drafts';
/** Owns session transitions and persistence. A reset invalidates all pending saves.
 * Quiz owns generation/answer feedback UI; navigation owns only non-session sections. */
export function useLearningSession(user: { uid: string } | null, db: Firestore, lang: Language) {
  const [session, dispatch] = useReducer(learningSessionReducer, initialSession);
  const [draftAvailable, setDraftAvailable] = useState(true);
  const [draftId, setDraftId] = useState<string | null>(null);
  const generation = useRef(0);
  const saveId = useRef<string | null>(null);
  const renderedSaveId = draftId;
  const userId = user?.uid;

  useEffect(() => {
    if (!userId) return;
    const draft = readDraft(userId, 'quiz-session', parseWith(sessionDraftSchema));
    if (draft) {
      saveId.current = draft.id;
      setDraftId(draft.id);
      dispatch({ type: 'start', config: draft.config, questions: draft.questions });
    }
  }, [userId]);

  useEffect(() => {
    if (!userId || session.status !== 'quiz' || !saveId.current) return;
    setDraftAvailable(writeDraft(userId, 'quiz-session', {
      id: saveId.current, config: session.config, questions: session.questions,
    }));
  }, [userId, session]);

  useEffect(() => {
    const lifecycle = generation;
    return () => { lifecycle.current++; };
  }, []);

  const reset = useCallback(() => {
    generation.current++;
    saveId.current = null;
    setDraftId(null);
    if (userId) {
      removeDraft(userId, 'quiz-session');
      removeDraft(userId, 'quiz-progress');
    }
    dispatch({ type: 'reset' });
  }, [userId]);

  const start = useCallback((config: QuizConfig, questions: QuizQuestion[] | null = null) => {
    generation.current++;
    saveId.current = crypto.randomUUID();
    setDraftId(saveId.current);
    if (userId) removeDraft(userId, 'quiz-progress');
    dispatch({ type: 'start', config, questions });
  }, [userId]);

  const ready = useCallback((questions: QuizQuestion[]) => dispatch({ type: 'ready', questions }), []);

  const finish = useCallback(async (results: Omit<QuizHistoryItem, 'date' | 'lang'>, analysis?: QuizAnalysis): Promise<boolean> => {
    if (!userId || !db) return false;
    const epoch = generation.current;
    const combined: QuizHistoryItem = {
      ...results, ...(analysis ? { analysis } : {}),
      schemaVersion: 2, date: new Date().toISOString(), lang,
    };
    const reference = doc(db, 'users', userId, 'history', saveId.current ??= crypto.randomUUID());
    try {
      // Firestore rejects undefined; optional fields are absent from the wire record.
      await setDoc(reference, JSON.parse(JSON.stringify({ ...combined, userId })));
      if (generation.current !== epoch) return false;
      removeDraft(userId, 'quiz-session');
      removeDraft(userId, 'quiz-progress');
      dispatch({ type: 'finish', results: combined });
      return true;
    } catch (cause) {
      if (generation.current === epoch) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: reference.path, operation: 'create' }, cause));
      }
      return false;
    }
  }, [userId, db, lang]);

  const recoverAnalysis = useCallback(async (feedback: PersonalizedQuizFeedbackOutput): Promise<boolean> => {
    if (!userId || !db || session.status !== 'result' || !renderedSaveId || saveId.current !== renderedSaveId) return false;
    const epoch = generation.current;
    const { topicEn, topicVi, ...analysis } = feedback;
    const reference = doc(db, 'users', userId, 'history', renderedSaveId);
    try {
      await setDoc(reference, JSON.parse(JSON.stringify({
        analysis, config: { ...session.results.config, topicEn, topicVi },
      })), { merge: true });
      if (generation.current !== epoch || saveId.current !== renderedSaveId) return false;
      dispatch({ type: 'recover-analysis', analysis, topicEn, topicVi });
      return true;
    } catch (cause) {
      if (generation.current === epoch) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: reference.path, operation: 'update' }, cause));
      }
      return false;
    }
  }, [userId, db, session, renderedSaveId]);

  return { session, reset, start, ready, finish, recoverAnalysis, draftId, draftAvailable };
}

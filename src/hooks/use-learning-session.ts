'use client';
import { useCallback, useEffect, useReducer, useRef } from 'react';
import { doc, setDoc, type Firestore } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { initialSession, learningSessionReducer, type QuizQuestion } from '@/lib/learning-session';
import type { Language, QuizAnalysis, QuizConfig, QuizHistoryItem } from '@/lib/types';
/** Owns session transitions and persistence. A reset invalidates all pending saves.
 * Quiz owns generation/answer feedback UI; navigation owns only non-session sections. */
export function useLearningSession(user: { uid: string } | null, db: Firestore, lang: Language) {
 const [session, dispatch] = useReducer(learningSessionReducer, initialSession);
 const generation = useRef(0), saveId = useRef<string | null>(null);
 useEffect(() => { const lifecycle = generation; return () => { lifecycle.current++; }; }, []);
 const reset = useCallback(() => { generation.current++; saveId.current = null; dispatch({ type: 'reset' }); }, []);
 const start = useCallback((config: QuizConfig, questions: QuizQuestion[] | null = null) => {
  generation.current++; saveId.current = crypto.randomUUID(); dispatch({ type: 'start', config, questions });
 }, []);
 const ready = useCallback((questions: QuizQuestion[]) => dispatch({ type: 'ready', questions }), []);
 const finish = useCallback(async (results: Omit<QuizHistoryItem, 'date' | 'lang'>, analysis?: QuizAnalysis): Promise<boolean> => {
  if (!user || !db) return false;
  const epoch = generation.current;
  const combined: QuizHistoryItem = { ...results, ...(analysis ? { analysis } : {}), schemaVersion: 2, date: new Date().toISOString(), lang };
  const reference = doc(db, 'users', user.uid, 'history', saveId.current ??= crypto.randomUUID());
  try {
   // Firestore rejects undefined; optional fields are absent from the wire record.
   await setDoc(reference, JSON.parse(JSON.stringify({ ...combined, userId: user.uid })));
   if (generation.current !== epoch) return false;
   dispatch({ type: 'finish', results: combined }); return true;
  } catch (cause) {
   if (generation.current === epoch) errorEmitter.emit('permission-error', new FirestorePermissionError({ path: reference.path, operation: 'create' }, cause));
   return false;
  }
 }, [user, db, lang]);
 return { session, reset, start, ready, finish };
}

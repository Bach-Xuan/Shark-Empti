
'use client';

import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { doc,onSnapshot,serverTimestamp,setDoc } from 'firebase/firestore';
import { useCallback,useEffect,useState } from 'react';
import { useUser } from '../auth/use-user';
import { useFirestore } from '../provider';

export function useUserNotes() {
  const { user } = useUser();
  const db = useFirestore();
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setNotes('');
    setLoading(true);
    if (!user || !db) {
      setLoading(false);
      return;
    }

    const notesRef = doc(db, 'users', user.uid, 'notes', 'main');
    let active = true;
    const unsubscribe = onSnapshot(
      notesRef,
      (docSnap) => {
        if (!active) return;
        const content: unknown = docSnap.exists() ? docSnap.data().content : '';
        setNotes(typeof content === 'string' ? content : '');
        setLoading(false);
      },
      async (cause) => {
        if (!active) return;
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: notesRef.path, operation: 'get' }, cause));
        setLoading(false);
      }
    );

    return () => { active = false; unsubscribe(); };
  }, [user, db]);

  const updateNotes = useCallback(async (newContent: string): Promise<boolean> => {
    if (!user || !db) return false;
    const notesRef = doc(db, 'users', user.uid, 'notes', 'main');

    return setDoc(notesRef, { content: newContent, updatedAt: serverTimestamp() }, { merge: true })
      .then(() => true)
      .catch(async (cause) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: notesRef.path,
          operation: 'write',
          requestResourceData: { content: newContent }
        }, cause));
        return false;
      });
  }, [user, db]);

  return { notes, updateNotes, loading };
}

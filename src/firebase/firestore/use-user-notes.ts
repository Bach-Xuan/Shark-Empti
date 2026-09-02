
'use client';

import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp, Firestore } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useUser } from '../auth/use-user';
import { useFirestore } from '../provider';

export function useUserNotes() {
  const { user } = useUser();
  const db = useFirestore();
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !db) {
      setLoading(false);
      return;
    }

    const notesRef = doc(db, 'users', user.uid, 'notes', 'main');
    const unsubscribe = onSnapshot(
      notesRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setNotes(docSnap.data().content || '');
        }
        setLoading(false);
      },
      async () => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: notesRef.path, operation: 'get' }));
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, db]);

  const updateNotes = useCallback((newContent: string) => {
    if (!user || !db) return;
    
    setNotes(newContent);
    const notesRef = doc(db, 'users', user.uid, 'notes', 'main');
    
    setDoc(notesRef, { content: newContent, updatedAt: serverTimestamp() }, { merge: true })
      .catch(async () => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ 
          path: notesRef.path, 
          operation: 'write', 
          requestResourceData: { content: newContent } 
        }));
      });
  }, [user, db]);

  return { notes, updateNotes, loading };
}

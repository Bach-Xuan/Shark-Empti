
'use client';

import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useUser } from '../auth/use-user';
import { useFirestore } from '../provider';
import { NOTES_MAX_LENGTH } from '@/lib/data-limits';

export function useUserNotes() {
  const { user } = useUser();
  const db = useFirestore();
  const uid = user?.uid;
  const [revision, setRevision] = useState(0);
  const [snapshot, setSnapshot] = useState<{ uid: string; db: typeof db; content: string; failed: boolean }>();
  const confirmed = useRef<{ uid: string; db: typeof db } | null>(null);
  const current = snapshot?.uid === uid && snapshot?.db === db ? snapshot : undefined;

  useEffect(() => {
    if (!uid || !db) return;
    const notesRef = doc(db, 'users', uid, 'notes', 'main');
    let active = true;
    const unsubscribe = onSnapshot(
      notesRef, { includeMetadataChanges: true },
      (docSnap) => {
        if (!active || docSnap.metadata.fromCache || docSnap.metadata.hasPendingWrites) return;
        const content: unknown = docSnap.exists() ? docSnap.data().content : '';
        confirmed.current = { uid, db };
        setSnapshot({ uid, db, content: typeof content === 'string' ? content : '', failed: false });
      },
      (cause) => {
        if (!active) return;
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: notesRef.path, operation: 'get' }, cause));
        confirmed.current = null;
        setSnapshot(last => ({ uid, db, content: last?.uid === uid && last.db === db ? last.content : '', failed: true }));
      }
    );

    return () => { active = false; confirmed.current = null; unsubscribe(); };
  }, [uid, db, revision]);

  const updateNotes = useCallback(async (newContent: string): Promise<boolean> => {
    if (!uid || !db || confirmed.current?.uid !== uid || confirmed.current.db !== db) return false;
    const notesRef = doc(db, 'users', uid, 'notes', 'main');

    const write = newContent.length > NOTES_MAX_LENGTH ? Promise.reject({ code: 'APP-INVALID-INPUT' })
      : setDoc(notesRef, { content: newContent, updatedAt: serverTimestamp() }, { merge: true });
    return write
      .then(() => true)
      .catch(async (cause) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: notesRef.path,
          operation: 'write',
          requestResourceData: { content: newContent }
        }, cause));
        return false;
      });
  }, [uid, db]);

  return { notes: current?.content ?? '', updateNotes, loading: !!uid && !!db && !current, ready: !!current && !current.failed,
    failed: current?.failed === true, retry: () => setRevision(value => value + 1) };
}

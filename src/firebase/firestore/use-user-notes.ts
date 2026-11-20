
'use client';

import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { doc, onSnapshot } from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useUser } from '../auth/use-user';
import { useFirestore } from '../provider';
import { NOTES_MAX_LENGTH } from '@/lib/data-limits';

import { readNoteVersion, saveNoteVersion, type SaveNote } from './note-version';

export function useUserNotes() {
  const { user } = useUser();
  const db = useFirestore();
  const uid = user?.uid;
  const [subscriptionAttempt, setSubscriptionAttempt] = useState(0);
  const [snapshot, setSnapshot] = useState<{ uid: string; db: typeof db; content: string; revision: number; failed: boolean }>();
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
        const version = readNoteVersion(docSnap.data());
        confirmed.current = { uid, db };
        setSnapshot({ uid, db, ...version, failed: false });
      },
      (cause) => {
        if (!active) return;
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: notesRef.path, operation: 'get' }, cause));
        confirmed.current = null;
        setSnapshot(last => ({ uid, db, revision: 0, content: last?.uid === uid && last.db === db ? last.content : '', failed: true }));
      }
    );

    return () => { active = false; confirmed.current = null; unsubscribe(); };
  }, [uid, db, subscriptionAttempt]);

  const updateNotes = useCallback<SaveNote>(async (newContent, base) => {
    if (!uid || !db || confirmed.current?.uid !== uid || confirmed.current.db !== db) return false;
    const notesRef = doc(db, 'users', uid, 'notes', 'main');

    const write = newContent.length > NOTES_MAX_LENGTH ? Promise.reject({ code: 'APP-INVALID-INPUT' })
      : saveNoteVersion(db, uid, newContent, base);
    return write
      .catch((cause) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: notesRef.path,
          operation: 'write',
          requestResourceData: { content: newContent }
        }, cause));
        return false;
      });
  }, [uid, db]);

  return { notesRevision: current?.revision ?? 0, notes: current?.content ?? '', updateNotes, loading: !!uid && !!db && !current, ready: !!current && !current.failed,
    failed: current?.failed === true, retry: () => setSubscriptionAttempt(value => value + 1) };
}

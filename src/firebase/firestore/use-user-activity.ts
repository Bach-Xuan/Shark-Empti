
'use client';

import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { doc,onSnapshot } from 'firebase/firestore';
import { recordActiveDay } from './record-active-day';
import { useCallback,useEffect,useMemo,useState } from 'react';
import { useUser } from '../auth/use-user';
import { useFirestore } from '../provider';

export function useUserActivity() {
  const { user } = useUser();
  const db = useFirestore();
  const [snapshot, setSnapshot] = useState<{ uid: string; days: Record<string, boolean>; loading: boolean } | null>(null);
  const activity = useMemo(() => snapshot?.uid === user?.uid ? snapshot?.days ?? {} : {}, [snapshot, user?.uid]);
  const loading = !!user && (snapshot?.uid !== user.uid || snapshot.loading);

  useEffect(() => {
    if (!user || !db) {
      return;
    }

    const activityRef = doc(db, 'users', user.uid, 'activity', 'main');
    let active = true;
    const unsubscribe = onSnapshot(
      activityRef,
      (docSnap) => {
        if (!active) return;
        setSnapshot({ uid: user.uid, days: docSnap.exists() ? docSnap.data().activeDays || {} : {}, loading: false });
      },
      async (cause) => {
        if (!active) return;
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: activityRef.path, operation: 'get' }, cause));
        setSnapshot({ uid: user.uid, days: {}, loading: false });
      }
    );

    return () => { active = false; unsubscribe(); };
  }, [user, db]);

  const trackToday = useCallback(() => {
    if (!user || !db) return;

    const now = new Date();
    const todayKey = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
    
    if (activity[todayKey]) return;

    const activityRef = doc(db, 'users', user.uid, 'activity', 'main');
    
    recordActiveDay(db, user.uid, todayKey).catch(async (cause) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ 
        path: activityRef.path, 
        operation: 'write'
      }, cause));
    });
  }, [user, db, activity]);

  return { activity, trackToday, loading };
}

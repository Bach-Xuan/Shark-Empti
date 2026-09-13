
'use client';

import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { doc,onSnapshot,serverTimestamp,setDoc } from 'firebase/firestore';
import { useCallback,useEffect,useState } from 'react';
import { useUser } from '../auth/use-user';
import { useFirestore } from '../provider';

export function useUserActivity() {
  const { user } = useUser();
  const db = useFirestore();
  const [activity, setActivity] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !db) {
      setLoading(false);
      return;
    }

    const activityRef = doc(db, 'users', user.uid, 'activity', 'main');
    const unsubscribe = onSnapshot(
      activityRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setActivity(docSnap.data().activeDays || {});
        } else {
          // If first time, we'll initialize on track
          setActivity({});
        }
        setLoading(false);
      },
      async () => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: activityRef.path, operation: 'get' }));
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, db]);

  const trackToday = useCallback(() => {
    if (!user || !db) return;

    const now = new Date();
    const todayKey = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
    
    if (activity[todayKey]) return;

    const activityRef = doc(db, 'users', user.uid, 'activity', 'main');
    const newActiveDays = { ...activity, [todayKey]: true };
    
    setDoc(activityRef, { 
      activeDays: newActiveDays, 
      updatedAt: serverTimestamp() 
    }, { merge: true }).catch(async () => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ 
        path: activityRef.path, 
        operation: 'write'
      }));
    });
  }, [user, db, activity]);

  return { activity, trackToday, loading };
}

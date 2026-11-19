'use client';
import { useFirestore,useUser } from '@/firebase';
import { readHistoryItem } from '@/lib/history-schema';
import { collection, orderBy, query } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { usePagedCollection } from './use-paged-collection';
type HistoryLoading = 'immediate' | 'idle' | 'off';

export function useHistory(mode: HistoryLoading = 'immediate') {
 const db = useFirestore(), { user } = useUser();
 const owner = user?.uid;
 const [warmOwner, setWarmOwner] = useState<string>();
 useEffect(() => {
   if (!owner || mode === 'off') {
     if (warmOwner !== undefined) setWarmOwner(undefined);
     return;
   }
   if (warmOwner === owner) return;
   const activate = () => setWarmOwner(owner);
   if (mode === 'immediate') { activate(); return; }
   if (typeof window.requestIdleCallback === 'function') {
     const idle = window.requestIdleCallback(activate, { timeout: 1500 });
     return () => window.cancelIdleCallback(idle);
   }
   const timer = window.setTimeout(activate, 250);
   return () => window.clearTimeout(timer);
 }, [mode, owner, warmOwner]);
 const uid = mode === 'immediate' || (mode === 'idle' && warmOwner === owner) ? owner : undefined;
 const source = useMemo(() => uid && db
   ? query(collection(db, 'users', uid, 'history'), orderBy('date', 'desc'))
   : null, [uid, db]);
 return usePagedCollection(source, readHistoryItem);
}

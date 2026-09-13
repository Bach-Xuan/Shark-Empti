'use client';
import { useFirestore,useUser } from '@/firebase';
import { readHistoryItem } from '@/lib/history-schema';
import { collection,orderBy,query } from 'firebase/firestore';
import { useMemo } from 'react';
import { usePagedCollection } from './use-paged-collection';
export function useHistory() {
 const db = useFirestore(), { user } = useUser();
 const uid = user?.uid;
 const source = useMemo(() => uid && db ? query(collection(db, 'users', uid, 'history'), orderBy('date', 'desc')) : null, [db, uid]);
 return usePagedCollection(source, readHistoryItem);
}

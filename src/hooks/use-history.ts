'use client';
import { useFirestore,useUser } from '@/firebase';
import { readHistoryItem } from '@/lib/history-schema';
import { collection, orderBy, query, Timestamp, where } from 'firebase/firestore';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PAGE_SIZE, usePagedCollection } from './use-paged-collection';
export function useHistory() {
 const db = useFirestore(), { user } = useUser();
 const uid = user?.uid;
 const sources = useMemo(() => {
   if (!uid || !db) return { current: null, legacy: null };
   const history = collection(db, 'users', uid, 'history');
   // Type-specific queries avoid Firestore's mixed-type sort order. Each stream
   // remains bounded while legacy ISO records are being converted.
   return {
     current: query(history, where('date', '<=', Timestamp.fromMillis(253_402_300_799_999)), orderBy('date', 'desc')),
     legacy: query(history, where('date', '>=', ''), orderBy('date', 'desc')),
   };
 }, [db, uid]);
 const current = usePagedCollection(sources.current, readHistoryItem);
 const legacy = usePagedCollection(sources.legacy, readHistoryItem);
 const versions = `${current.firstPageVersion}:${legacy.firstPageVersion}`;
 const [visible, setVisible] = useState({ uid, versions, count: PAGE_SIZE });
 const scope = useRef(0);
 useLayoutEffect(() => {
   const lifecycle = scope;
   lifecycle.current++;
   return () => { lifecycle.current++; };
 }, [uid]);
 const pending = useRef<number | null>(null);
 const count = visible.uid === uid && visible.versions === versions ? visible.count : PAGE_SIZE;
 const combined = useMemo(() => [...new Map([...current.items, ...legacy.items].map(item => [item.id, item])).values()]
   .sort((a, b) => b.date - a.date || ((a.id ?? '') < (b.id ?? '') ? 1 : (a.id ?? '') > (b.id ?? '') ? -1 : 0)), [current.items, legacy.items]);
 const error = current.error ?? legacy.error;
 const loadMore = async () => {
   if (pending.current === scope.current || current.loading || legacy.loading || error) return;
   const requestScope = scope.current;
   pending.current = requestScope;
   try {
     // Each stream contributes a page before exposing the next merged prefix.
     await Promise.all([current.loadMore(), legacy.loadMore()]);
     if (scope.current === requestScope) setVisible({ uid, versions, count: count + PAGE_SIZE });
   } finally { if (pending.current === requestScope) pending.current = null; }
 };
 return {
   items: error ? [] : combined.slice(0, count), loading: current.loading || legacy.loading,
   hasMore: !error && (combined.length > count || current.hasMore || legacy.hasMore), loadMore,
   error, retry: () => { current.retry(); legacy.retry(); setVisible({ uid, versions, count: PAGE_SIZE }); },
   invalidRecords: current.invalidRecords + legacy.invalidRecords,
 };
}

'use client';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { getDocs,limit,onSnapshot,query,startAfter,type DocumentData,type Query,type QueryDocumentSnapshot } from 'firebase/firestore';
import { useCallback,useEffect,useRef,useState } from 'react';
export const PAGE_SIZE = 50;
/** One live first page; older pages are fetched only on demand. Changes to the
 * first page invalidate older cursors, avoiding gaps after insertion/reordering. */
export function usePagedCollection<T>(source: Query<DocumentData> | null, read: (id: string, data: DocumentData) => T | null) {
 const reader = useRef(read);
 useEffect(() => { reader.current = read; }, [read]);
 const epoch = useRef(0), busy = useRef(false);
 const seenIds = useRef(new Set<string>());
 const cursor = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
 const [items, setItems] = useState<T[]>([]);
 const [loading, setLoading] = useState(true), [hasMore, setHasMore] = useState(false);
 const report = useCallback((cause: unknown) => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'paged-collection', operation: 'list' }, cause)), []);
 const decode = useCallback((docs: QueryDocumentSnapshot<DocumentData>[]) => docs.flatMap(doc => {
  try {
   const item = reader.current(doc.id, doc.data());
   if (item !== null) return [item];
  } catch { /* One malformed record must not abort the rest of a page. */ }
  report({ code: 'data-loss' }); return [];
 }), [report]);
 useEffect(() => {
  const lifecycle = epoch;
  const generation = ++lifecycle.current;
  busy.current = false; cursor.current = null; seenIds.current.clear(); setItems([]); setHasMore(false); setLoading(!!source);
  if (!source) return;
  const unsubscribe = onSnapshot(query(source, limit(PAGE_SIZE)), snapshot => {
   if (generation !== epoch.current) return;
   cursor.current = snapshot.docs.at(-1) ?? null;
   seenIds.current = new Set(snapshot.docs.map(doc => doc.id));
   setItems(decode(snapshot.docs)); setHasMore(snapshot.size === PAGE_SIZE); setLoading(false);
  }, cause => { if (generation === epoch.current) { report(cause); setItems([]); setHasMore(false); cursor.current = null; setLoading(false); } });
  return () => { lifecycle.current++; unsubscribe(); };
 }, [source, decode, report]);
 const loadMore = useCallback(async () => {
  if (!source || !cursor.current || busy.current || !hasMore) return;
  const generation = epoch.current, anchor = cursor.current;
  busy.current = true; setLoading(true);
  try {
   const snapshot = await getDocs(query(source, startAfter(anchor), limit(PAGE_SIZE)));
   // First-page changes invalidate an in-flight continuation as well.
   if (generation !== epoch.current || cursor.current !== anchor) return;
   cursor.current = snapshot.docs.at(-1) ?? anchor;
   const unseen = snapshot.docs.filter(doc => !seenIds.current.has(doc.id));
   unseen.forEach(doc => seenIds.current.add(doc.id));
   const additions = decode(unseen);
   setItems(previous => [...previous, ...additions]);
   setHasMore(snapshot.size === PAGE_SIZE);
  } catch (cause) { if (generation === epoch.current) report(cause); }
  finally { if (generation === epoch.current) { busy.current = false; setLoading(false); } }
 }, [source, hasMore, decode, report]);
 return { items, loading, hasMore, loadMore };
}

'use client';
import { useEffect, useState } from 'react';
import { collection, documentId, onSnapshot, query, where, type Firestore } from 'firebase/firestore';
import { FORUM_REACTIONS_COLLECTION, forumReactionId, ownForumReactionSchema, type ForumReactionTarget } from '@/lib/community-privacy';

const logicalKey = (target: ForumReactionTarget) => JSON.stringify([target.postId, target.commentId ?? null]);
type ReactionState = { scope: string; loading: boolean; error: boolean; liked: Set<string> };

/** Only own records are read. Every SDK query is bounded to 30 explicit keys;
 * changing owner/targets immediately invalidates stale values and callbacks. */
export function useForumReactions(db: Firestore | null, uid: string | undefined, targets: readonly ForumReactionTarget[]) {
  const signature = JSON.stringify(targets);
  const [revision, setRevision] = useState(0);
  const scope = JSON.stringify([uid ?? null, signature, revision]);
  const [state, setState] = useState<ReactionState>({ scope: '', loading: false, error: false, liked: new Set() });
  useEffect(() => {
    let disposed = false, failed = false;
    const unsubscribers: (() => void)[] = [];
    const selected: ForumReactionTarget[] = JSON.parse(signature);
    if (!db || !uid || selected.length === 0) return;
    const fail = () => {
      if (disposed || failed) return;
      failed = true; clearTimeout(timer);
      unsubscribers.splice(0).forEach(unsubscribe => unsubscribe());
      setState({ scope, loading: false, error: true, liked: new Set() });
    };
    let timer: ReturnType<typeof setTimeout> | undefined = setTimeout(fail, 15_000);
    void (async () => {
      const keys = await Promise.all(selected.map(async target => ({ id: await forumReactionId(target), target })));
      if (disposed || failed) return;
      const byId = new Map(keys.map(item => [item.id, item.target])), liked = new Set<string>(), ready = new Set<number>();
      const ids = [...byId.keys()], chunks = Array.from({ length: Math.ceil(ids.length / 30) }, (_, index) => ids.slice(index * 30, index * 30 + 30));
      chunks.forEach((chunk, index) => {
        if (disposed || failed) return;
        const source = query(collection(db, 'users', uid, FORUM_REACTIONS_COLLECTION), where(documentId(), 'in', chunk));
        const unsubscribe = onSnapshot(source, { includeMetadataChanges: true }, snapshot => {
          if (disposed || failed) return;
          if (snapshot.metadata.fromCache) {
            ready.delete(index);
            if (!timer) timer = setTimeout(fail, 15_000);
            setState({ scope, loading: true, error: false, liked: new Set(liked) });
            return;
          }
          const next: string[] = [];
          for (const document of snapshot.docs) {
            const target = byId.get(document.id), parsed = ownForumReactionSchema.safeParse(document.data());
            if (!target || !parsed.success || parsed.data.postId !== target.postId || parsed.data.commentId !== target.commentId) { fail(); return; }
            next.push(logicalKey(target));
          }
          chunk.forEach(id => liked.delete(logicalKey(byId.get(id)!)));
          next.forEach(key => liked.add(key)); ready.add(index);
          if (ready.size === chunks.length) { clearTimeout(timer); timer = undefined; setState({ scope, loading: false, error: false, liked: new Set(liked) }); }
        }, fail);
        if (disposed || failed) unsubscribe(); else unsubscribers.push(unsubscribe);
      });
    })().catch(fail);
    return () => { disposed = true; clearTimeout(timer); unsubscribers.splice(0).forEach(unsubscribe => unsubscribe()); };
  }, [db, uid, signature, scope]);
  const selected = !!uid && targets.length > 0;
  const current = state.scope === scope ? state : null;
  return {
    loading: selected && !!db && (!current || current.loading), error: selected && (!db || (current?.error ?? false)),
    isLiked: (target: ForumReactionTarget) => selected && !!current?.liked.has(logicalKey(target)),
    retry: () => setRevision(value => value + 1),
  };
}

import { doc, getDocFromServer, runTransaction, serverTimestamp, type Firestore } from 'firebase/firestore';

export type NoteVersion = { content: string; revision: number };
export type SaveNote = (content: string, base: NoteVersion) => Promise<boolean | NoteVersion>;

export function readNoteVersion(data?: Record<string, unknown>): NoteVersion {
  return {
    content: typeof data?.content === 'string' ? data.content : '',
    revision: typeof data?.revision === 'number' ? data.revision : 0,
  };
}

export function saveNoteVersion(db: Firestore, uid: string, content: string, base: NoteVersion) {
  const ref = doc(db, 'users', uid, 'notes', 'main');
  const differsFromBase = (current: NoteVersion) => current.revision !== base.revision || current.content !== base.content;
  return runTransaction(db, async transaction => {
    const current = readNoteVersion((await transaction.get(ref)).data());
    if (differsFromBase(current)) return current;
    transaction.set(ref, { content, revision: base.revision + 1, updatedAt: serverTimestamp() }, { merge: true });
    return true as const;
  }).catch(async (error: unknown) => {
    // Rules may reject a competing commit before the SDK retries the transaction.
    if (typeof error === 'object' && error && 'code' in error && error.code === 'permission-denied') {
      const latest = readNoteVersion((await getDocFromServer(ref)).data());
      if (differsFromBase(latest)) return latest;
    }
    throw error;
  });
}

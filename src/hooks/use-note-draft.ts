import { useState } from 'react';
import type { NoteVersion, SaveNote } from '@/firebase/firestore/note-version';

export function useNoteDraft(content: string, revision: number, save: SaveNote) {
  const [draft, setDraft] = useState<{ content: string; base: NoteVersion }>();
  const [conflict, setConflict] = useState<NoteVersion>();
  const base = draft?.base ?? { content, revision };
  const draftContent = draft?.content ?? content;
  const latest = conflict && conflict.revision >= revision ? conflict : { content, revision };

  function reset() {
    setDraft(undefined);
    setConflict(undefined);
  }

  async function submit() {
    const result = await save(draftContent, conflict ?? base);
    if (typeof result === 'object') setConflict(result);
    return result === true;
  }

  return {
    content: draftContent, conflict, submit, reset,
    edit: (value: string) => setDraft({ content: value, base }),
    reload: () => { setDraft({ content: latest.content, base: latest }); setConflict(undefined); },
  };
}

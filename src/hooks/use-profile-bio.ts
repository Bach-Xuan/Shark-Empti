'use client';
import { useEffect, useRef, useState } from 'react';

/** A biography draft belongs to one mounted account session. */
export function useProfileBio(uid: string | undefined, remoteBio: string) {
  const [bio, setBio] = useState(remoteBio);
  const [draftOwner, setDraftOwner] = useState(uid);
  const [isSaving, setSaving] = useState(false);
  const dirty = useRef(false);
  const session = useRef(0);
  const saving = useRef(false);
  const acknowledged = useRef<string | null>(null);
  useEffect(() => {
    const lifecycle = session;
    lifecycle.current++;
    dirty.current = false;
    acknowledged.current = null;
    saving.current = false;
    setBio('');
    setDraftOwner(uid);
    setSaving(false);
    return () => { lifecycle.current++; };
  }, [uid]);
  useEffect(() => {
    if (acknowledged.current === remoteBio) { acknowledged.current = null; dirty.current = false; }
    if (!dirty.current) setBio(remoteBio);
  }, [uid, remoteBio, isSaving]);
  function edit(value: string) { acknowledged.current = null; dirty.current = true; setBio(value); }
  async function save(write: (value: string) => Promise<unknown>, success: () => void, failure: (error: unknown) => void) {
    if (!uid || saving.current) return;
    const owner = session.current;
    saving.current = true;
    setSaving(true);
    try {
      await write(bio);
      if (session.current !== owner) return;
      // Keep the acknowledged draft until the subscription catches up.
      acknowledged.current = bio;
      dirty.current = remoteBio !== bio;
      success();
    } catch (error) {
      if (session.current === owner) failure(error);
    } finally {
      if (session.current === owner) { saving.current = false; setSaving(false); }
    }
  }
  return { bio: draftOwner === uid ? bio : remoteBio, edit, isSaving: draftOwner === uid && isSaving, save };
}

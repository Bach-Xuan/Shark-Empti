'use client';

import {
useEffect,
useMemo,
useState
} from 'react';

import {
doc,
DocumentData,
DocumentReference,
onSnapshot
} from 'firebase/firestore';

import { useFirestore } from '../provider';

export function useDoc<
  T extends DocumentData = DocumentData
>(
  path: string | null
) {
  const firestore =
    useFirestore();

  const [data, setData] =
    useState<T | null>(null);

  const [loading, setLoading] =
    useState(Boolean(path));

  const [error, setError] =
    useState<Error | null>(
      null
    );
  const [ownerPath, setOwnerPath] = useState(path);

  const docRef = useMemo(() => {
    if (
      !path ||
      !firestore
    ) {
      return null;
    }

    return doc(
      firestore,
      path
    ) as DocumentReference<T>;

  }, [
    path,
    firestore
  ]);

  useEffect(() => {
    setOwnerPath(path);
    setError(null);
    setData(null);
    let active = true;

    if (!docRef) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = onSnapshot(
      docRef,

      (snapshot) => {
        if (!active) return;
        setData(
          snapshot.exists()
            ? snapshot.data()
            : null
        );

        setLoading(false);
      },

      (snapshotError) => {
        if (!active) return;
        setError(
          snapshotError
        );

        setLoading(false);
      }
    );
    return () => { active = false; unsubscribe(); };

  }, [docRef, path]);

  return {
    data: ownerPath === path ? data : null,
    loading: ownerPath === path ? loading : Boolean(path),
    error: ownerPath === path ? error : null,
    docRef
  };
}

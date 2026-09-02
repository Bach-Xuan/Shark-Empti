'use client';

import {
  useEffect,
  useMemo,
  useState
} from 'react';

import {
  doc,
  onSnapshot,
  DocumentReference,
  DocumentData
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
    setError(null);

    if (!docRef) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    return onSnapshot(
      docRef,

      (snapshot) => {
        setData(
          snapshot.exists()
            ? snapshot.data()
            : null
        );

        setLoading(false);
      },

      (snapshotError) => {
        setError(
          snapshotError
        );

        setLoading(false);
      }
    );

  }, [docRef]);

  return {
    data,
    loading,
    error,
    docRef
  };
}
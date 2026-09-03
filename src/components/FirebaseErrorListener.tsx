
'use client';

import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { showErrorToast } from '@/lib/error-toast';
import { useEffect } from 'react';
import { useAppPreferences } from './app-preferences';

/**
 * Turns Firebase failures into the application's standard toast notification.
 * The raw error remains in the console for developers, but is never thrown into
 * the user-facing Next.js overlay.
 */
export function FirebaseErrorListener() {
  const { lang } = useAppPreferences();
  useEffect(() => {
    const unsubscribe = errorEmitter.on('permission-error', (error) => {
      const context = error instanceof FirestorePermissionError
        ? error.context
        : { path: 'unknown', operation: 'unknown' };
      const code = error instanceof FirestorePermissionError ? error.code : 'FIRESTORE-REQUEST-FAILED';
      console.error('Firestore operation failed', code, context.operation);
      showErrorToast({
        code,
        message: 'The operation could not be completed.',
        values: {
          path: context.path || 'unknown',
          operation: context.operation || 'unknown',
        },
      }, lang);
    });

    return unsubscribe;
  }, [lang]);

  return null;
}

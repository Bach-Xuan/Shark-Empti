
'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { showErrorToast } from '@/lib/error-toast';

/**
 * Turns Firebase failures into the application's standard toast notification.
 * The raw error remains in the console for developers, but is never thrown into
 * the user-facing Next.js overlay.
 */
export function FirebaseErrorListener() {
  useEffect(() => {
    const unsubscribe = errorEmitter.on('permission-error', (error) => {
      const context = error instanceof FirestorePermissionError
        ? error.context
        : { path: 'unknown', operation: 'unknown' };
      console.error('Firebase permission error', error);
      showErrorToast({
        code: 'FIRESTORE-PERMISSION-DENIED',
        message: 'Firebase denied this request.',
        values: {
          path: context.path || 'unknown',
          operation: context.operation || 'unknown',
        },
      });
    });

    return unsubscribe;
  }, []);

  return null;
}

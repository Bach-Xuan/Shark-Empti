
'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';

/**
 * A component that listens for Firestore permission errors and throws them.
 * This triggers the Next.js error overlay during development, providing
 * rich context for debugging Security Rules.
 */
export function FirebaseErrorListener() {
  useEffect(() => {
    const unsubscribe = errorEmitter.on('permission-error', (error) => {
      // Throw the error to be caught by the Next.js development overlay.
      // This provides the rich context needed for agentive error fixing.
      throw error;
    });

    return unsubscribe;
  }, []);

  return null;
}

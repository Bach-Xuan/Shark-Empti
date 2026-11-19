'use client';
import { useAppPreferences } from '@/components/app-preferences';
import { preloadLearnerModules, useAuth } from '@/firebase/auth-provider';
import { showErrorToast } from '@/lib/error-toast';
import { GoogleAuthProvider,signInWithPopup } from 'firebase/auth';
import { useCallback,useRef,useState } from 'react';
export function useGoogleSignIn() {
  const auth = useAuth();
  const { lang } = useAppPreferences();
  const pending = useRef(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const handleGoogleSignIn = useCallback(async () => {
    if (pending.current) return;
    pending.current = true; setIsSigningIn(true);
    try {
      const popup = signInWithPopup(auth, new GoogleAuthProvider());
      void preloadLearnerModules();
      await popup;
      // The account-scoped provider owns bootstrap and exposes ready Auth only
      // after repair succeeds, including restored sessions and popup remounts.
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
      if (!['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(code)) showErrorToast({ code: code === 'auth/network-request-failed' ? 'APP-NETWORK' : 'AUTH-SIGN-IN-FAILED', message: '', values: {} }, lang);
    } finally { pending.current = false; setIsSigningIn(false); }
  }, [auth, lang]);
  return { handleGoogleSignIn, isSigningIn };
}

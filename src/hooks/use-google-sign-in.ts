'use client';
import { useAppPreferences } from '@/components/app-preferences';
import { useAuth,useFirestore } from '@/firebase';
import { showErrorToast } from '@/lib/error-toast';
import { GoogleAuthProvider,signInWithPopup } from 'firebase/auth';
import { doc,runTransaction,serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useCallback,useRef,useState } from 'react';
export function useGoogleSignIn() {
  const auth = useAuth(); const db = useFirestore(); const router = useRouter();
  const { lang } = useAppPreferences();
  const pending = useRef(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const handleGoogleSignIn = useCallback(async () => {
    if (pending.current) return;
    pending.current = true; setIsSigningIn(true);
    try {
      const { user } = await signInWithPopup(auth, new GoogleAuthProvider());
      const ref = doc(db, 'users', user.uid);
      await runTransaction(db, async transaction => {
        const current = await transaction.get(ref);
        transaction.set(ref, { displayName: user.displayName || 'Learner', email: user.email, photoURL: user.photoURL, updatedAt: serverTimestamp(), ...(!current.exists() ? { createdAt: serverTimestamp() } : {}) }, { merge: true });
      });
      router.push('/');
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
      if (!['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(code)) showErrorToast({ code: code === 'auth/network-request-failed' ? 'APP-NETWORK' : 'AUTH-SIGN-IN-FAILED', message: '', values: {} }, lang);
    } finally { pending.current = false; setIsSigningIn(false); }
  }, [auth, db, lang, router]);
  return { handleGoogleSignIn, isSigningIn };
}

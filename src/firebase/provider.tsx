
'use client';

import { FirebaseErrorListener } from '@/components/firebase-error-listener';
import { FirebaseApp } from 'firebase/app';
import { Auth,onAuthStateChanged,signOut,type User } from 'firebase/auth';
import Link from 'next/link';
import { Firestore } from 'firebase/firestore';
import React,{ createContext,useContext,useEffect,useMemo,useState,useRef } from 'react';
import { ensureLearnerProfile } from './profile-bootstrap';
import { useAppPreferences } from '@/components/app-preferences';
import { ServiceConsent } from '@/components/service-consent';
import { RouteSkeleton } from '@/components/route-skeleton';
import { publicMessages } from '@/lib/i18n/public';
import { pruneDraftsForOwner } from '@/lib/draft-storage';

interface FirebaseContextProps {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
}

const FirebaseContext = createContext<FirebaseContextProps | undefined>(undefined);
const AuthStateContext = createContext<{ user: User | null; loading: boolean }>({ user: null, loading: true });
export const useAuthState = () => useContext(AuthStateContext);

export const FirebaseProvider: React.FC<{
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
  children: React.ReactNode;
}> = ({ firebaseApp, firestore, auth, children }) => {
  const [state, setState] = useState<{ user: User | null; loading: boolean; profileError: boolean }>({ user: null, loading: true, profileError: false });
  const [repair, setRepair] = useState(0);
  const [authStalled, setAuthStalled] = useState(false);
  const epoch = useRef(0);
  const { lang } = useAppPreferences();
  useEffect(() => {
    const lifecycle = epoch;
    let profileTimer: ReturnType<typeof setTimeout> | undefined;
    setAuthStalled(false);
    const authTimer = setTimeout(() => setAuthStalled(true), 15000);
    const unsubscribe = onAuthStateChanged(auth, user => {
      clearTimeout(authTimer); setAuthStalled(false);
      clearTimeout(profileTimer);
      pruneDraftsForOwner(user?.uid ?? null);
      const current = ++epoch.current;
      setState({ user, loading: Boolean(user), profileError: false });
      if (!user) return;
      const timer = setTimeout(() => { if (current === epoch.current) setState({ user, loading: false, profileError: true }); }, 15000);
      profileTimer = timer;
      void ensureLearnerProfile(firestore, user).finally(() => clearTimeout(timer)).then(
        () => { if (current === epoch.current) setState({ user, loading: false, profileError: false }); },
        () => { if (current === epoch.current) setState({ user, loading: false, profileError: true }); },
      );
    }, () => { clearTimeout(authTimer); setAuthStalled(true); epoch.current++; setState({ user: null, loading: false, profileError: false }); });
    return () => { clearTimeout(authTimer); clearTimeout(profileTimer); lifecycle.current++; unsubscribe(); };
  }, [auth, firestore, repair]);
  const services = useMemo(() => ({ firebaseApp, firestore, auth }), [firebaseApp, firestore, auth]);
  return (
    <FirebaseContext.Provider value={services}>
      <AuthStateContext.Provider value={state}>
      <FirebaseErrorListener />
      <React.Fragment key={state.user?.uid ?? 'anonymous'}>
        {authStalled ? <main className="mx-auto grid min-h-[65vh] max-w-2xl content-center gap-5 p-5"><p role="alert">{publicMessages[lang].stalled}</p><button className="service-link border-2" onClick={() => setRepair(value => value + 1)}>{publicMessages[lang].retry}</button></main> : state.user && state.loading ? <RouteSkeleton view="setup" /> : state.user && state.profileError ? (
          <main className="min-h-screen grid place-content-center gap-4 p-6 text-center" aria-busy={state.loading}>
            <h1 className="text-xl font-bold">{lang === 'vi' ? 'Chuẩn bị tài khoản học tập' : 'Preparing your learning account'}</h1>
            <p role="status">{state.profileError
              ? (lang === 'vi' ? 'Đã đăng nhập nhưng chưa thể chuẩn bị hồ sơ. Phiên đăng nhập vẫn được giữ; hãy thử lại.' : 'You are signed in, but your profile could not be prepared. Your session is preserved; please retry.')
              : (lang === 'vi' ? 'Đang kiểm tra hồ sơ của bạn…' : 'Checking your profile…')}</p>
            {state.profileError && <button type="button" className="rounded-xl border-2 p-3 font-bold" onClick={() => setRepair(value => value + 1)}>{lang === 'vi' ? 'Thử lại' : 'Retry'}</button>}
            <button type="button" className="service-link border-2" onClick={() => { void signOut(auth).catch(() => setRepair(value => value + 1)); }}>{publicMessages[lang].signOut}</button>
            <Link className="service-link border-2" href="/account/status">{publicMessages[lang].receipt}</Link>
          </main>
        ) : state.user ? <ServiceConsent uid={state.user.uid} firestore={firestore}>{children}</ServiceConsent> : children}
      </React.Fragment>
      </AuthStateContext.Provider>
    </FirebaseContext.Provider>
  );
};

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (!context) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
};

export const useFirebaseApp = () => useFirebase().firebaseApp;
export const useFirestore = () => useFirebase().firestore;
export const useAuth = () => useFirebase().auth;

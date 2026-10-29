
'use client';

import { FirebaseErrorListener } from '@/components/firebase-error-listener';
import { FirebaseApp } from 'firebase/app';
import { Auth,onAuthStateChanged,type User } from 'firebase/auth';
import { Firestore } from 'firebase/firestore';
import React,{ createContext,useContext,useEffect,useMemo,useState,useRef } from 'react';
import { ensureLearnerProfile } from './profile-bootstrap';
import { useAppPreferences } from '@/components/app-preferences';
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
  const epoch = useRef(0);
  const { lang } = useAppPreferences();
  useEffect(() => {
    const lifecycle = epoch;
    const unsubscribe = onAuthStateChanged(auth, user => {
      pruneDraftsForOwner(user?.uid ?? null);
      const current = ++epoch.current;
      setState({ user, loading: Boolean(user), profileError: false });
      if (!user) return;
      void ensureLearnerProfile(firestore, user).then(
        () => { if (current === epoch.current) setState({ user, loading: false, profileError: false }); },
        () => { if (current === epoch.current) setState({ user, loading: false, profileError: true }); },
      );
    }, () => { epoch.current++; setState({ user: null, loading: false, profileError: false }); });
    return () => { lifecycle.current++; unsubscribe(); };
  }, [auth, firestore, repair]);
  const services = useMemo(() => ({ firebaseApp, firestore, auth }), [firebaseApp, firestore, auth]);
  return (
    <FirebaseContext.Provider value={services}>
      <AuthStateContext.Provider value={state}>
      <FirebaseErrorListener />
      <React.Fragment key={state.user?.uid ?? 'anonymous'}>
        {state.user && (state.loading || state.profileError) ? (
          <main className="min-h-screen grid place-content-center gap-4 p-6 text-center" aria-busy={state.loading}>
            <h1 className="text-xl font-bold">{lang === 'vi' ? 'Chuẩn bị tài khoản học tập' : 'Preparing your learning account'}</h1>
            <p role="status">{state.profileError
              ? (lang === 'vi' ? 'Đã đăng nhập nhưng chưa thể chuẩn bị hồ sơ. Phiên đăng nhập vẫn được giữ; hãy thử lại.' : 'You are signed in, but your profile could not be prepared. Your session is preserved; please retry.')
              : (lang === 'vi' ? 'Đang kiểm tra hồ sơ của bạn…' : 'Checking your profile…')}</p>
            {state.profileError && <button type="button" className="rounded-xl border-2 p-3 font-bold" onClick={() => setRepair(value => value + 1)}>{lang === 'vi' ? 'Thử lại' : 'Retry'}</button>}
          </main>
        ) : children}
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

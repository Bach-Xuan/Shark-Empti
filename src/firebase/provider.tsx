
'use client';

import { FirebaseErrorListener } from '@/components/firebase-error-listener';
import { FirebaseApp } from 'firebase/app';
import { Auth,onAuthStateChanged,type User } from 'firebase/auth';
import { Firestore } from 'firebase/firestore';
import React,{ createContext,useContext,useEffect,useMemo,useState } from 'react';

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
  const [state, setState] = useState<{ user: User | null; loading: boolean }>({ user: null, loading: true });
  useEffect(() => onAuthStateChanged(auth, user => setState({ user, loading: false }), () => setState({ user: null, loading: false })), [auth]);
  const services = useMemo(() => ({ firebaseApp, firestore, auth }), [firebaseApp, firestore, auth]);
  return (
    <FirebaseContext.Provider value={services}>
      <AuthStateContext.Provider value={state}>
      <FirebaseErrorListener />
      <React.Fragment key={state.user?.uid ?? 'anonymous'}>{children}</React.Fragment>
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

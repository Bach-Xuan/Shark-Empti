
'use client';

import React,{ useMemo } from 'react';
import { initializeFirebase } from './index';
import { FirebaseProvider } from './provider';

export const FirebaseClientProvider: React.FC<{ children: React.ReactNode; requireServiceConsent?: boolean }> = ({ children, requireServiceConsent }) => {
  const { firebaseApp, firestore, auth } = useMemo(() => initializeFirebase(), []);

  return (
    <FirebaseProvider firebaseApp={firebaseApp} firestore={firestore} auth={auth} requireServiceConsent={requireServiceConsent}>
      {children}
    </FirebaseProvider>
  );
};

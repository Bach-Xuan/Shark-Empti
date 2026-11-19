
'use client';

import React,{ useMemo } from 'react';
import { initializeFirebaseAuth } from './auth-client';
import { FirebaseProvider } from './auth-provider';

export const FirebaseClientProvider: React.FC<{ children: React.ReactNode; requireServiceConsent?: boolean }> = ({ children, requireServiceConsent }) => {
  const { firebaseApp, auth } = useMemo(() => initializeFirebaseAuth(), []);

  return (
    <FirebaseProvider firebaseApp={firebaseApp} auth={auth} requireServiceConsent={requireServiceConsent}>
      {children}
    </FirebaseProvider>
  );
};

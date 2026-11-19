'use client';

import { useMemo } from 'react';
import { useAuthServices } from './auth-provider';
import { initializeClientFirestore } from './firestore-client';

export { FirebaseProvider, useAuth, useAuthState, useFirebaseApp } from './auth-provider';

export function useFirebase() {
  const services = useAuthServices();
  return useMemo(() => ({
    ...services, firestore: services.firestore ?? initializeClientFirestore(services.firebaseApp),
  }), [services]);
}

export const useFirestore = () => useFirebase().firestore;

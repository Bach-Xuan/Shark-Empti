const getEnv = (
  value: string | undefined
) => value ?? "";

export const firebaseConfig = {
  apiKey: getEnv(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  ),

  authDomain: getEnv(
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
  ),

  projectId: getEnv(
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  ),

  storageBucket: getEnv(
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  ),

  messagingSenderId: getEnv(
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
  ),

  appId: getEnv(
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID
  )
};

/** Validate at application initialization, without forcing Firebase onto public pages. */
export function assertFirebaseConfig(config: typeof firebaseConfig = firebaseConfig): void {
  const missing = Object.entries(config).filter(([, value]) => typeof value !== 'string' || !value.trim()).map(([name]) => name);
  if (missing.length) throw new Error('Firebase Web configuration is missing required fields: ' + missing.join(', '));
}

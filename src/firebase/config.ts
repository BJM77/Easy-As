import type { FirebaseOptions } from "firebase/app";

const requiredFirebaseVars = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
] as const;

const hasCoreFirebaseFields = (config: Partial<FirebaseOptions>): config is FirebaseOptions => {
  return !!(
    config.apiKey &&
    config.authDomain &&
    config.projectId &&
    config.storageBucket &&
    config.messagingSenderId &&
    config.appId
  );
};

export const getFirebaseConfig = (): FirebaseOptions => {
  if (typeof window !== 'undefined') {
    try {
      const storedConfig = localStorage.getItem('firebase_config_override');
      if (storedConfig) {
        const parsed = JSON.parse(storedConfig) as Partial<FirebaseOptions>;
        if (hasCoreFirebaseFields(parsed)) return parsed;
      }
    } catch {
      // Ignore malformed local overrides and continue to environment variables.
    }
  }

  const configStr = process.env.NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG;
  if (configStr) {
    try {
      const parsed = JSON.parse(configStr) as Partial<FirebaseOptions>;
      if (hasCoreFirebaseFields(parsed)) return parsed;
    } catch {
      throw new Error('Invalid NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG JSON format.');
    }
  }

  const configFromVars: Partial<FirebaseOptions> = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };

  if (hasCoreFirebaseFields(configFromVars)) {
    return configFromVars;
  }

  const missingVars = requiredFirebaseVars.filter((name) => !process.env[name]);
  if (typeof window === 'undefined') {
    return configFromVars as FirebaseOptions;
  }

  throw new Error(
    `Missing Firebase web configuration. Set NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG or these variables: ${missingVars.join(', ')}.`
  );
};

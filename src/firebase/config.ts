import type { FirebaseOptions } from "firebase/app";

/**
 * Robust Firebase configuration resolver. (Production v51.0.0)
 * 1. Checks for a local storage override (Developer mode).
 * 2. Attempts to parse the combined JSON string (Standard).
 * 3. Falls back to individual environment variables (Resilient).
 * 4. Finally uses hardcoded defaults for the current project.
 */
const getFirebaseConfig = (): FirebaseOptions => {
  const defaultConfig: FirebaseOptions = {
    apiKey: "AIzaSyCAVREQPuPN49-kAHGlZFuGEuNoppZeZOo",
    authDomain: "studio-7521332906-59af2.firebaseapp.com",
    projectId: "studio-7521332906-59af2",
    storageBucket: "studio-7521332906-59af2.firebasestorage.app",
    messagingSenderId: "1071384403415",
    appId: "1:1071384403415:web:b1431206b85cc356033f92",
  };
  
  if (typeof window === 'undefined') {
    return defaultConfig;
  }

  try {
    // 1. Check for manual override in LocalStorage (Developer Debugging)
    const storedConfig = localStorage.getItem('firebase_config_override');
    if (storedConfig) {
      return JSON.parse(storedConfig);
    }
    
    // 2. Try the combined JSON configuration string
    const configStr = process.env.NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG;
    if (configStr) {
      const parsed = JSON.parse(configStr);
      if (parsed.apiKey) return parsed;
    }

    // 3. Fallback to individual environment variables
    if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      return {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      };
    }

    return defaultConfig;
  } catch (error) {
    return defaultConfig;
  }
};

export const firebaseConfig = getFirebaseConfig();

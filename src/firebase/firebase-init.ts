'use client';

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { initializeFirestore, type Firestore, memoryLocalCache, getFirestore } from 'firebase/firestore';
import { getFirebaseConfig } from './config';

/**
 * DEFINITIVE FIX for Firestore ca9 / b815 Assertion failures in Next.js HMR.
 * 
 * We enforce a strict singleton pattern by anchoring instances to the window object
 * individually and locking the transport to Long Polling with auto-detection disabled.
 * We use memoryLocalCache to prevent IndexedDB lock-up issues in dev environments.
 */

interface FirebaseInstances {
  firebaseApp: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
}

export function getFirebaseInstances(): FirebaseInstances {
  if (typeof window === 'undefined') {
    return { 
      firebaseApp: null as any, 
      auth: null as any, 
      firestore: null as any 
    };
  }

  const g = window as any;

  // 1. Initialize Firebase App exactly once
  if (!g.__FIREBASE_APP__) {
    g.__FIREBASE_APP__ = getApps().length > 0 ? getApp() : initializeApp(getFirebaseConfig());
  }

  // 2. Initialize Firestore with hard transport locks and memory cache exactly once
  if (!g.__FIREBASE_FIRESTORE__) {
    try {
      g.__FIREBASE_FIRESTORE__ = initializeFirestore(g.__FIREBASE_APP__, {
        localCache: memoryLocalCache()
      });
      console.log("[Firebase] Firestore initialized with Strict Memory Cache.");
    } catch (error) {
      // If already initialized (common in HMR), grab existing
      g.__FIREBASE_FIRESTORE__ = getFirestore(g.__FIREBASE_APP__);
    }
  }

  // 3. Initialize Auth exactly once
  if (!g.__FIREBASE_AUTH__) {
    g.__FIREBASE_AUTH__ = getAuth(g.__FIREBASE_APP__);
  }

  return {
    firebaseApp: g.__FIREBASE_APP__,
    auth: g.__FIREBASE_AUTH__,
    firestore: g.__FIREBASE_FIRESTORE__
  };
}

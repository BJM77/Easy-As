'use client';

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { initializeFirestore, type Firestore, memoryLocalCache, getFirestore } from 'firebase/firestore';
import { firebaseConfig } from './config';

/**
 * RELIABILITY LOCK (v55.5.0)
 * 
 * 1. Proxy Hardening: Forced experimentalForceLongPolling to true. This is the 
 *    required bypass for cloud workstation proxies that drop WebSocket streams.
 * 2. Auto-Detection Disable: explicitly disable auto-detection to prevent 
 *    intermittent fallback loops during hot-reloads.
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

  if (!g.__FIREBASE_APP__) {
    g.__FIREBASE_APP__ = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  }

  if (!g.__FIREBASE_FIRESTORE__) {
    try {
      // DEFINITIVE FIX: Force Long Polling for proxy compatibility
      g.__FIREBASE_FIRESTORE__ = initializeFirestore(g.__FIREBASE_APP__, {
        localCache: memoryLocalCache(),
        experimentalForceLongPolling: true,
        experimentalAutoDetectLongPolling: false
      });
      console.log("[Firebase] Firestore initialized with Persistent Long Polling.");
    } catch (error) {
      g.__FIREBASE_FIRESTORE__ = getFirestore(g.__FIREBASE_APP__);
    }
  }

  if (!g.__FIREBASE_AUTH__) {
    g.__FIREBASE_AUTH__ = getAuth(g.__FIREBASE_APP__);
  }

  return {
    firebaseApp: g.__FIREBASE_APP__,
    auth: g.__FIREBASE_AUTH__,
    firestore: g.__FIREBASE_FIRESTORE__
  };
}
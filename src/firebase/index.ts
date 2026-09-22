
'use client';

import React from 'react';
import { getFirebaseInstances } from './firebase-init';

// Re-export hooks and providers from their specific source files
export { useCollection } from './firestore/use-collection';
export { useDoc } from './firestore/use-doc';
export { useAuth, AuthProvider } from './auth/use-user';
export { 
  setDocumentNonBlocking, 
  addDocumentNonBlocking, 
  updateDocumentNonBlocking, 
  deleteDocumentNonBlocking 
} from './non-blocking-updates';

/**
 * GUIDELINE COMPLIANCE: Exports an initializeFirebase() function that 
 * returns an object containing the FirebaseApp, Firestore, and Auth instances.
 */
export const initializeFirebase = () => getFirebaseInstances();

// Export instance getters for convenience within hooks and components
export const useFirebaseApp = () => getFirebaseInstances().firebaseApp;
export const useAuthInstance = () => getFirebaseInstances().auth;
export const useFirestore = () => getFirebaseInstances().firestore;

/**
 * Utility for memoizing Firestore queries and references to prevent infinite loops.
 * This is crucial when used with useCollection or useDoc to stabilize the reference
 * across re-renders while allowing it to react to dependency changes.
 */
export function useMemoFirebase<T>(factory: () => T, deps: React.DependencyList | undefined): T {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const memoized = React.useMemo(factory, deps);
    if(memoized) {
      (memoized as any).__memo = true;
    }
    return memoized;
}

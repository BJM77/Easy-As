
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * An invisible component that listens for globally emitted 'permission-error' events.
 * Intelligently handles redirects while ignoring transient errors during identity sync.
 */
export function FirebaseErrorListener() {
  const router = useRouter();

  useEffect(() => {
    const handlePermissionError = (error: FirestorePermissionError) => {
      const path = error.request.path;
      
      // CRITICAL: Ignore permission errors for core collections during the background token sync phase.
      // This prevents redirect loops when the Firestore listener triggers before the JWT token is refreshed.
      const transientCollections = [
        '/users',
        '/companies',
        '/companyRates',
        '/ai_quotes',
        '/problems',
        '/problem_log',
        '/leads',
        '/vipContacts',
        '/deliveryRuns',
        '/invitations',
        '/quote_logs' // Added to suppression to allow background auditing to fail silently during sync
      ];

      const isTransient = transientCollections.some(slug => path.includes(slug));

      if (isTransient) {
        console.log("[Security] Suppressed transient sync error for path:", path);
        return;
      }

      console.warn("[Security] Denied access to:", path);
      // Redirect to login with a special state to show the access recovery UI
      router.push(`/login?reason=unauthorized&path=${encodeURIComponent(path)}`);
    };

    errorEmitter.on('permission-error', handlePermissionError);

    return () => {
      errorEmitter.off('permission-error', handlePermissionError);
    };
  }, [router]);

  return null;
}

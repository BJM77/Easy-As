
'use client';

import { useState, useEffect } from 'react';
import { Query, getCountFromServer, FirestoreError } from 'firebase/firestore';

export interface UseCountResult {
  count: number | null;
  isLoading: boolean;
  error: FirestoreError | Error | null;
}

/**
 * High-performance hook to get the count of documents in a collection or query.
 * Uses server-side aggregation to minimize data transfer.
 */
export function useCount(
  memoizedQuery: (Query & { __memo?: boolean }) | null | undefined
): UseCountResult {
  const [count, setCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  useEffect(() => {
    if (!memoizedQuery) {
      setCount(null);
      setIsLoading(false);
      return;
    }

    if (memoizedQuery && !memoizedQuery.__memo && process.env.NODE_ENV === 'development') {
        console.warn('A query passed to useCount was not properly memoized using useMemoFirebase.');
    }

    const fetchCount = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const snapshot = await getCountFromServer(memoizedQuery);
        setCount(snapshot.data().count);
      } catch (err: any) {
        setError(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCount();
  }, [memoizedQuery]);

  return { count, isLoading, error };
}

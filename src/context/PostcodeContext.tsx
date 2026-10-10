"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import type { PostcodeData } from '@/lib/types';

interface PostcodeContextType {
  postcodes: PostcodeData[];
  isLoading: boolean;
  error: string | null;
  findLocationByPostcode: (postcode: string) => PostcodeData[];
  lookupSuburbs: (query: string) => PostcodeData[];
}

const PostcodeContext = createContext<PostcodeContextType | undefined>(undefined);

let globalPostcodesCache: PostcodeData[] | null = null;
let fetchPromise: Promise<PostcodeData[]> | null = null;

async function fetchPostcodesOnce(): Promise<PostcodeData[]> {
  if (globalPostcodesCache) return globalPostcodesCache;
  if (!fetchPromise) {
    fetchPromise = fetch('/api/postcodes')
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load postcodes: ${res.statusText}`);
        return res.json();
      })
      .then((data: PostcodeData[]) => {
        globalPostcodesCache = data;
        return data;
      })
      .catch((err) => {
        fetchPromise = null;
        throw err;
      });
  }
  return fetchPromise;
}

export function PostcodeProvider({ children }: { children: ReactNode }) {
  const [postcodes, setPostcodes] = useState<PostcodeData[]>(globalPostcodesCache || []);
  const [isLoading, setIsLoading] = useState<boolean>(!globalPostcodesCache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (globalPostcodesCache) {
      setPostcodes(globalPostcodesCache);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    fetchPostcodesOnce()
      .then((data) => {
        if (isMounted) {
          setPostcodes(data);
          setIsLoading(false);
        }
      })
      .catch((err: any) => {
        if (isMounted) {
          setError(err?.message || 'Error loading postcodes');
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const postcodeIndex = useMemo(() => {
    const map = new Map<string, PostcodeData[]>();
    for (const item of postcodes) {
      if (!item?.postcode) continue;
      const pc = String(item.postcode).trim();
      const existing = map.get(pc) || [];
      existing.push(item);
      map.set(pc, existing);
    }
    return map;
  }, [postcodes]);

  const findLocationByPostcode = useMemo(() => {
    return (postcode: string): PostcodeData[] => {
      if (!postcode) return [];
      return postcodeIndex.get(String(postcode).trim()) || [];
    };
  }, [postcodeIndex]);

  const lookupSuburbs = useMemo(() => {
    return (query: string): PostcodeData[] => {
      if (!query || query.length < 2) return [];
      const q = query.toLowerCase().trim();
      return postcodes.filter(
        (p) =>
          p.suburb?.toLowerCase().includes(q) ||
          String(p.postcode).includes(q) ||
          p.state?.toLowerCase().includes(q)
      ).slice(0, 30);
    };
  }, [postcodes]);

  const value = useMemo(
    () => ({
      postcodes,
      isLoading,
      error,
      findLocationByPostcode,
      lookupSuburbs,
    }),
    [postcodes, isLoading, error, findLocationByPostcode, lookupSuburbs]
  );

  return <PostcodeContext.Provider value={value}>{children}</PostcodeContext.Provider>;
}

export function usePostcodes(): PostcodeContextType {
  const context = useContext(PostcodeContext);
  if (!context) {
    throw new Error('usePostcodes must be used within a PostcodeProvider');
  }
  return context;
}

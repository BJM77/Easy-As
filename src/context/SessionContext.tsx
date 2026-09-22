
"use client";

import type { ReactNode, Dispatch, SetStateAction } from 'react';
import React, { createContext, useContext, useState, useCallback } from 'react';

interface SessionContextType {
  sessionTokens: number;
  addTokens: (count: number) => void;
  resetTokens: () => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [sessionTokens, setSessionTokens] = useState(0);

  const addTokens = useCallback((count: number) => {
    setSessionTokens(prev => prev + count);
  }, []);

  const resetTokens = useCallback(() => {
    setSessionTokens(0);
  }, []);

  return (
    <SessionContext.Provider value={{ sessionTokens, addTokens, resetTokens }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = (): SessionContextType => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};

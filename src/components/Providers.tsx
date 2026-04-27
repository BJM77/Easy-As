
'use client';

import React from 'react';
import { AuthProvider } from '@/firebase';
import { SettingsProvider } from '@/context/SettingsContext';
import { RateOverrideProvider } from '@/context/RateOverrideContext';
import { SessionProvider } from '@/context/SessionContext';
import { CompanyThemeProvider } from '@/components/CompanyThemeProvider';
import AppHeader from '@/components/AppHeader';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import { Toaster } from "@/components/ui/toaster";

/**
 * Centralized Client Providers Component.
 * Envelops the application in necessary contexts while maintaining 
 * a single fragment-wrapped child list to prevent React "key" warnings.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <React.Fragment>
        <CompanyThemeProvider />
        <SettingsProvider>
          <RateOverrideProvider>
            <SessionProvider>
              <AppHeader />
              <main className="flex-grow container mx-auto px-4 py-8">
                {children}
                <React.Suspense fallback={null}>
                  <FirebaseErrorListener />
                </React.Suspense>
              </main>
              <Toaster />
            </SessionProvider>
          </RateOverrideProvider>
        </SettingsProvider>
      </React.Fragment>
    </AuthProvider>
  );
}

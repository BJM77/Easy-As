
import React from 'react';
import './globals.css';
import { Inter, Outfit } from 'next/font/google';
import { cn } from '@/lib/utils';
import { Providers } from '@/components/Providers';
import type { Metadata, Viewport } from 'next';

const fontInter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const fontOutfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#002E5D',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'LedgerLight | Secure Freight Intelligence',
  description: 'Enterprise multi-modal freight intelligence and calculation platform.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body 
        className={cn(
          "min-h-screen bg-background font-body antialiased flex flex-col",
          fontInter.variable,
          fontOutfit.variable
        )}
        suppressHydrationWarning={true}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}

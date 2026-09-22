
import React from 'react';
import './globals.css';
import { Oswald } from 'next/font/google';
import { cn } from '@/lib/utils';
import { Providers } from '@/components/Providers';
import type { Metadata, Viewport } from 'next';

const oswald = Oswald({
  subsets: ['latin'],
  variable: '--font-oswald',
});

export const viewport: Viewport = {
  themeColor: '#002E5D',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'FreightAssist.Online | Secure Freight Intelligence',
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
          oswald.variable
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

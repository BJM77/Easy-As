
'use client';

import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, RefreshCcw, Home } from 'lucide-react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Unhandled Application Error:', error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[70vh] p-4">
      <Card className="max-w-md w-full shadow-lg border-destructive/20">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="h-10 w-10 text-destructive" />
          </div>
          <CardTitle className="text-2xl font-bold">Something went wrong</CardTitle>
          <CardDescription>
            An unexpected error occurred in the application. We've been notified and are looking into it.
          </CardDescription>
        </CardHeader>
        <CardContent className="bg-muted/30 p-4 rounded-md mx-6 mb-6">
          <p className="text-xs font-mono text-muted-foreground break-all overflow-hidden">
            {error.message || 'Unknown system error'}
          </p>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row gap-3">
          <Button onClick={reset} className="w-full sm:w-auto flex-1">
            <RefreshCcw className="mr-2 h-4 w-4" /> Try Again
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto flex-1">
            <Link href="/">
              <Home className="mr-2 h-4 w-4" /> Go Home
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

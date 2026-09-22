"use client";

import React, { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { XCircle, ArrowLeft, Loader2 } from 'lucide-react';

function PaymentCancelContent() {
  const router = useRouter();

  return (
    <div className="flex items-center justify-center min-h-[80vh] p-4">
      <Card className="max-w-md w-full text-center py-8 border-destructive/20">
        <CardHeader>
          <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
            <XCircle className="h-10 w-10 text-destructive" />
          </div>
          <CardTitle className="text-2xl text-destructive">Payment Cancelled</CardTitle>
          <CardDescription>
            The checkout process was cancelled. No charges were made to your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            You can return to the registration page to try again or choose a different payment method when available.
          </p>
        </CardContent>
        <CardFooter>
          <Button onClick={() => router.push('/register')} variant="outline" className="w-full">
            <ArrowLeft className="mr-2 h-4 w-4" /> Return to Register
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function PaymentCancelPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>}>
      <PaymentCancelContent />
    </Suspense>
  );
}

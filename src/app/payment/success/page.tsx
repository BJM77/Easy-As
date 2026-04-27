"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2, PartyPopper } from 'lucide-react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import ReactConfetti from 'react-confetti';

function PaymentSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const firestore = useFirestore();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('Verifying your payment...');

  useEffect(() => {
    const verifyPayment = async () => {
      const userId = searchParams.get('userId');
      const sessionId = searchParams.get('session_id');

      if (!userId || !sessionId) {
        setStatus('error');
        setMessage('Missing payment verification details.');
        return;
      }

      try {
        const userRef = doc(firestore, 'users', userId);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          throw new Error('User record not found.');
        }

        const userData = userSnap.data();
        const companyId = userData.companyId;

        // 1. Update Company Status
        const companyRef = doc(firestore, 'companies', companyId);
        await updateDoc(companyRef, {
          subscriptionStatus: 'active',
          stripeSessionId: sessionId,
        });

        // 2. Update User Profile & Grant Initial Tokens
        await updateDoc(userRef, {
          subscriptionStatus: 'active',
          tokens: 50000, // Grant welcome tokens upon payment success
        });

        setStatus('success');
        setMessage('Your subscription is now active! We have credited 50,000 tokens to your account.');
      } catch (error: any) {
        console.error('Payment verification error:', error);
        setStatus('error');
        setMessage(error.message || 'Failed to activate your account.');
      }
    };

    if (firestore) {
      verifyPayment();
    }
  }, [firestore, searchParams]);

  return (
    <div className="flex items-center justify-center min-h-[80vh] p-4">
      {status === 'success' && <ReactConfetti width={typeof window !== 'undefined' ? window.innerWidth : 1000} height={typeof window !== 'undefined' ? window.innerHeight : 1000} />}
      <Card className="max-w-md w-full text-center py-8">
        <CardHeader>
          <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-4">
            {status === 'verifying' ? <Loader2 className="h-10 w-10 text-primary animate-spin" /> : <CheckCircle2 className="h-10 w-10 text-green-600" />}
          </div>
          <CardTitle className="text-2xl">
            {status === 'verifying' ? 'Verifying Payment' : 'Subscription Active!'}
          </CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent>
          {status === 'success' && (
            <div className="space-y-4">
              <div className="p-4 bg-primary/5 rounded-lg border border-primary/20 flex items-center gap-3 text-left">
                <PartyPopper className="h-8 w-8 text-primary" />
                <p className="text-sm">You now have full access to all BD Assist tools and AI features.</p>
              </div>
              <Button onClick={() => router.push('/')} className="w-full">
                Go to Dashboard
              </Button>
            </div>
          )}
          {status === 'error' && (
            <Button onClick={() => router.push('/register')} variant="outline" className="w-full">
              Back to Registration
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>}>
      <PaymentSuccessContent />
    </Suspense>
  );
}

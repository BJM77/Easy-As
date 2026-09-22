"use client";

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Building2, ShieldCheck, CreditCard } from 'lucide-react';
import Link from 'next/link';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc } from 'firebase/firestore';
import { useAuth, useFirestore, setDocumentNonBlocking, initializeFirebase } from '@/firebase';
import { Separator } from '@/components/ui/separator';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  companyName: z.string().min(2, 'Company name is required.'),
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters long.'),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

const SUBSCRIPTION_FEE = 9.95;
const MONTHLY_TOKENS = 100000;

export default function RegisterPageContent() {
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [registrationData, setRegistrationData] = useState<RegisterFormValues | null>(null);
  const [proRataInfo, setProRataInfo] = useState<{ charge: string; tokens: number }>({ charge: '0.00', tokens: 0 });
  
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading } = useAuth();
  const firestore = useFirestore();
  const { auth } = initializeFirebase();

  useEffect(() => {
    // Calculate pro-rata only on the client to avoid hydration mismatch
    const dayOfMonth = new Date().getDate();
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const percentage = Math.max(0.20, (daysInMonth - dayOfMonth + 1) / daysInMonth);
    const charge = SUBSCRIPTION_FEE * percentage;
    const tokens = Math.floor(MONTHLY_TOKENS * percentage);
    setProRataInfo({ charge: charge.toFixed(2), tokens });
  }, []);

  useEffect(() => {
    if (!loading && user) {
      router.push('/');
    }
  }, [user, loading, router]);

  const handleNextStep = async (data: RegisterFormValues) => {
    setRegistrationData(data);
    setStep(2);
  };
  
  const handleProceedToPayment = async () => {
    if (!registrationData || !firestore || !auth) {
      toast({ title: 'Error', description: 'System not ready or data missing.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, registrationData.email, registrationData.password);
      const newUser = userCredential.user;
      
      await updateProfile(newUser, { displayName: registrationData.name });
      
      const companyId = registrationData.companyName.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Math.random().toString(36).substring(2, 7);
      
      const companyDocRef = doc(firestore, 'companies', companyId);
      const companyData = {
        id: companyId,
        name: registrationData.companyName,
        subscriptionStatus: 'inactive',
        settings: {
          logoText: registrationData.companyName,
          primaryColor: '#616161',
          accentColor: '#ffa857',
          topMenuColor: '#ffffff',
          hoverColor: '#3d3d3d',
          markup: 0
        },
        enabledFeatures: {
          'standard-spend-bands': false,
          'admin-menu': false,
          'manage-surcharges': false,
          'pdf-extractor': false,
          'core-rate-uploader': false,
          'about-tge': false,
        },
        createdAt: new Date().toISOString()
      };
      setDocumentNonBlocking(companyDocRef, companyData, { merge: false });

      const userDocRef = doc(firestore, 'users', newUser.uid);
      const userProfileData = {
        id: newUser.uid,
        name: registrationData.name,
        email: registrationData.email,
        role: 'admin',
        companyId: companyId,
        subscriptionStatus: 'inactive',
        tokens: 0,
        createdAt: new Date().toISOString(),
      };
      setDocumentNonBlocking(userDocRef, userProfileData, { merge: false });

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: newUser.uid,
          email: registrationData.email,
          companyName: registrationData.companyName,
          planName: 'Monthly Starter',
        }),
      });

      const { url, error } = await response.json();
      if (error) throw new Error(error);

      window.location.href = url;

    } catch (error: any) {
      console.error("Payment redirect error:", error);
      toast({ 
        title: 'Payment Error', 
        description: error.message || 'Could not initiate payment portal.', 
        variant: 'destructive'
      });
      setIsLoading(false);
    }
  };
  
  if (loading || user) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-16 w-16 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-10rem)] p-4">
      <Card className="w-full max-w-lg shadow-xl">
        {step === 1 && (
            <>
                <CardHeader className="text-center">
                  <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-2xl font-bold font-headline">Create Organization</CardTitle>
                  <CardDescription>Start your 14-day trial or subscribe to activate your tools.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={form.handleSubmit(handleNextStep)} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="companyName">Company Name</Label>
                            <Input id="companyName" {...form.register('companyName')} placeholder="Your Business" />
                            {form.formState.errors.companyName && <p className="text-xs text-destructive">{form.formState.errors.companyName.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="name">Full Name</Label>
                            <Input id="name" {...form.register('name')} placeholder="Jane Doe" />
                            {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
                        </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Work Email</Label>
                      <Input id="email" type="email" placeholder="jane@company.com" {...form.register('email')} />
                      {form.formState.errors.email && <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input id="password" type="password" {...form.register('password')} />
                      {form.formState.errors.password && <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>}
                    </div>
                    <Button type="submit" className="w-full h-11 text-lg">
                      Review Subscription
                    </Button>
                  </form>
                  <div className="mt-6 text-center text-sm text-muted-foreground">
                    Already have an account?{' '}
                    <Link href="/login" className="text-primary font-semibold hover:underline">
                      Log in
                    </Link>
                  </div>
                </CardContent>
            </>
        )}
        {step === 2 && (
             <>
                <CardHeader className="text-center">
                  <div className="mx-auto w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mb-2">
                    <ShieldCheck className="h-6 w-6 text-accent" />
                  </div>
                  <CardTitle className="text-2xl font-bold font-headline">Review & Pay</CardTitle>
                  <CardDescription>Finalize your organization setup.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="p-4 bg-muted/50 rounded-lg border space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">Organization:</span>
                            <span className="font-bold">{registrationData?.companyName}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between items-center text-sm">
                            <span>Monthly Subscription:</span>
                            <span>$9.95</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span>AI Credit (Monthly):</span>
                            <span>100,000 Tokens</span>
                        </div>
                        <Separator />
                        <div className="pt-2">
                            <div className="flex justify-between items-baseline mb-1">
                                <span className="text-sm font-semibold">Initial Pro-Rata Charge:</span>
                                <span className="text-2xl font-bold text-primary">${proRataInfo.charge}</span>
                            </div>
                            <p className="text-[10px] text-center text-muted-foreground italic">Calculated based on the remaining days in this month.</p>
                        </div>
                    </div>
                    
                    <div className="space-y-3">
                        <Button onClick={handleProceedToPayment} className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold" disabled={isLoading}>
                           {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : (
                             <>
                                <CreditCard className="mr-2 h-5 w-5" />
                                Proceed to Stripe Payment
                             </>
                           )}
                        </Button>
                        <p className="text-[10px] text-center text-muted-foreground px-4">
                            Payments are handled securely by Stripe. You can cancel your subscription at any time.
                        </p>
                    </div>
                    
                    <Button variant="ghost" onClick={() => setStep(1)} className="w-full h-8 text-xs" disabled={isLoading}>Go Back</Button>
                </CardContent>
            </>
        )}
      </Card>
    </div>
  );
}
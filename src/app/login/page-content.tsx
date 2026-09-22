"use client";

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth, useFirestore, initializeFirebase } from '@/firebase';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Loader2, LogIn, Package, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters long.'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPageContent() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user, loading } = useAuth();
  const firestore = useFirestore();
  
  // FIXED: Using initializeFirebase() which ensures the app is created before getAuth() is called.
  const { auth } = initializeFirebase();

  const isUnauthorized = searchParams.get('reason') === 'unauthorized';
  const deniedPath = searchParams.get('path');

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    // Standard redirect to home if logged in, unless we're here because of an access error
    if (!loading && user && !isUnauthorized) {
      router.push('/');
    }
  }, [user, loading, router, isUnauthorized]);

  const onSubmit = async (data: LoginFormValues) => {
    if (!auth) return;
    setIsLoading(true);
    try {
      // If already logged in but switching user, sign out first
      if (user) {
        await signOut(auth);
      }

      const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
      const authenticatedUser = userCredential.user;

      // Auto-detect Workspace: Fetch context from claims or repair profile
      if (firestore) {
        const profileRef = doc(firestore, 'users', authenticatedUser.uid);
        const profileSnap = await getDoc(profileRef);
        
        if (profileSnap.exists()) {
          toast({ title: 'Login Successful', description: `Welcome back!` });
          router.push('/');
          return;
        } else {
            // "Repair" Missing Profile using context from Token Claims if available
            const tokenResult = await authenticatedUser.getIdTokenResult();
            const companyIdFromClaim = tokenResult.claims.companyId as string || 'easy-as';
            const roleFromClaim = tokenResult.claims.role as string || 'user';

            await setDoc(profileRef, {
                id: authenticatedUser.uid,
                email: authenticatedUser.email,
                name: authenticatedUser.displayName || authenticatedUser.email?.split('@')[0] || 'User',
                role: roleFromClaim,
                companyId: companyIdFromClaim,
                subscriptionStatus: 'active',
                tokens: 50000,
                assignedCompanyIds: [companyIdFromClaim]
            }, { merge: true });
        }
      }

      toast({ title: 'Login Successful', description: "Welcome back!" });
      router.push('/');
    } catch (error: any) {
      console.error("Login error:", error);
      let message = 'An unknown error occurred.';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
          message = 'Invalid email or password.';
      }
      toast({
        title: 'Login Failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-10rem)] p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-primary rounded-lg flex items-center justify-center mb-2 shadow-lg">
            <Package className="h-7 w-7 text-white" />
          </div>
          <CardTitle className="text-3xl font-bold font-headline">
            {isUnauthorized ? 'Access Recovery' : 'Welcome Back'}
          </CardTitle>
          <CardDescription>
            {isUnauthorized 
              ? 'You do not have permission to view that page. Please log in with an authorized account.' 
              : 'Login to your organization account.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isUnauthorized && (
            <Alert variant="destructive" className="bg-destructive/5">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Permission Denied</AlertTitle>
              <AlertDescription className="text-xs">
                {deniedPath || 'Access was restricted by security rules.'}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input 
                id="email" 
                name="email"
                type="email" 
                placeholder="name@company.com" 
                {...form.register('email')} 
                className="h-11" 
                autoComplete="email" 
              />
              {form.formState.errors.email && <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}
            </div>
            
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link
                        href="/forgot-password"
                        className="text-xs text-primary font-medium hover:underline"
                    >
                        Forgot password?
                    </Link>
                </div>
                <Input 
                  id="password" 
                  name="password"
                  type="password" 
                  {...form.register('password')} 
                  className="h-11" 
                  autoComplete="current-password" 
                />
                {form.formState.errors.password && <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>}
            </div>

            <Button type="submit" className="w-full h-11 text-lg" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
              {isUnauthorized ? 'Authorize & Re-login' : 'Login'}
            </Button>
          </form>
          
          {!isUnauthorized && (
            <div className="mt-8 text-center text-sm text-muted-foreground border-t pt-6">
              New to the platform?{' '}
              <Link href="/register" className="text-primary font-bold hover:underline">
                Start Trial / Register Company
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirestore, useDoc, useMemoFirebase, setDocumentNonBlocking, initializeFirebase } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, UserPlus, ShieldCheck, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { doc, deleteDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import type { Invitation } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  password: z.string().min(6, 'Password must be at least 6 characters long.'),
  confirmPassword: z.string().min(6)
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignupFormValues = z.infer<typeof signupSchema>;

export default function InviteSignupPageContent({ inviteId }: { inviteId: string }) {
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { auth } = initializeFirebase();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inviteRef = useMemoFirebase(() => (firestore ? doc(firestore, 'invitations', inviteId) : null), [firestore, inviteId]);
  const { data: invite, isLoading: isLoadingInvite } = useDoc<Invitation>(inviteRef);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: '', password: '', confirmPassword: '' }
  });

  const onSubmit = async (data: SignupFormValues) => {
    if (!invite || !firestore || !auth) return;
    setIsSubmitting(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, invite.invitedBy, data.password); 
      const newUser = userCredential.user;
      await updateProfile(newUser, { displayName: data.name });

      const userDocRef = doc(firestore, 'users', newUser.uid);
      const userProfileData = {
        id: newUser.uid,
        name: data.name,
        email: invite.invitedBy,
        role: invite.role,
        companyId: invite.companyId,
        subscriptionStatus: 'active',
        tokens: 50000, 
        createdAt: new Date().toISOString()
      };
      setDocumentNonBlocking(userDocRef, userProfileData, { merge: false });

      await deleteDoc(doc(firestore, 'invitations', inviteId));

      toast({ title: 'Welcome Aboard!', description: `You have joined ${invite.companyName}.` });
      router.push('/');
    } catch (error: any) {
      toast({ title: 'Signup Failed', description: error.message || 'Could not complete registration.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingInvite) return <div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin h-12 w-12 text-primary" /></div>;

  if (!invite || invite.status !== 'pending') {
    return (
      <div className="flex items-center justify-center min-h-[80vh] p-4">
        <Card className="max-w-md w-full text-center py-10">
          <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
          <CardTitle>Invalid or Expired Invite</CardTitle>
          <CardDescription className="mt-2">This invitation link is no longer valid.</CardDescription>
          <Button asChild className="mt-6" variant="outline"><a href="/login">Return to Login</a></Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[80vh] p-4">
      <Card className="max-w-md w-full shadow-2xl">
        <CardHeader>
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Join {invite.companyName}</CardTitle>
          <CardDescription>You've been invited by {invite.invitedBy} to join their team.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <Label>Assigned Role</Label>
              <Badge variant="outline" className="w-full justify-center h-9 capitalize">{invite.role}</Badge>
            </div>
            <div className="space-y-1">
              <Label htmlFor="signup-name">Full Name</Label>
              <Input id="signup-name" {...form.register('name')} placeholder="Enter your name" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="signup-password">Password</Label>
              <Input id="signup-password" type="password" {...form.register('password')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="signup-confirm">Confirm Password</Label>
              <Input id="signup-confirm" type="password" {...form.register('confirmPassword')} />
            </div>
            <Button type="submit" className="w-full mt-4" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <UserPlus className="mr-2 h-4 w-4" />}
              Accept Invitation & Sign Up
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
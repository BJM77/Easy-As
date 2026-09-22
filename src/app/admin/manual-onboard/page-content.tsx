"use client";

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth, useFirestore } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, UserPlus, Building2, ShieldCheck, Mail, Key } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { doc, setDoc } from 'firebase/firestore';
import { Separator } from '@/components/ui/separator';

const onboardSchema = z.object({
  companyName: z.string().min(2, 'Company name is required.'),
  companyDomain: z.string().optional(),
  adminName: z.string().min(2, 'Admin full name is required.'),
  adminEmail: z.string().email('Invalid email address.'),
  adminPassword: z.string().min(6, 'Password must be at least 6 characters.'),
  initialTokens: z.coerce.number().min(0).default(100000),
});

type OnboardFormValues = z.infer<typeof onboardSchema>;

export default function ManualOnboardPageContent() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, role } = useAuth();
  const { toast } = useToast();
  const firestore = useFirestore();

  const form = useForm<OnboardFormValues>({
    resolver: zodResolver(onboardSchema),
    defaultValues: {
      companyName: '',
      companyDomain: '',
      adminName: '',
      adminEmail: '',
      adminPassword: 'Password123!',
      initialTokens: 100000,
    },
  });

  const onSubmit = async (data: OnboardFormValues) => {
    if (!user || !firestore) return;
    setIsSubmitting(true);

    try {
      const companyId = data.companyName.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Math.random().toString(36).substring(2, 7);
      const companyDocRef = doc(firestore, 'companies', companyId);
      
      await setDoc(companyDocRef, {
        id: companyId,
        name: data.companyName,
        domain: data.companyDomain || "",
        subscriptionStatus: 'active',
        settings: {
          logoText: data.companyName,
          primaryColor: '#616161',
          accentColor: '#ffa857',
          topMenuColor: '#ffffff',
          hoverColor: '#3d3d3d',
          markup: 0
        },
        enabledFeatures: {
          'standard-spend-bands': true,
          'admin-menu': true,           
          'manage-surcharges': false,
          'pdf-extractor': true,
          'core-rate-uploader': false,
          'about-tge': true,
          'salesforce-search-bar': true,
        },
        createdAt: new Date().toISOString()
      });

      const token = await user.getIdToken();
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email: data.adminEmail,
          password: data.adminPassword,
          name: data.adminName,
          role: 'admin',
          companyId: companyId,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.details || result.error || 'Failed to create user account.');

      toast({ title: 'Onboarding Successful', description: `Organization "${data.companyName}" created.` });
      form.reset();
    } catch (error: any) {
      console.error("Manual onboard error:", error);
      toast({ title: 'Onboarding Failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (role !== 'superadmin') {
    return <Card className="m-8"><CardContent className="pt-6 text-center">Unauthorized access.</CardContent></Card>;
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <Card className="shadow-xl border-t-4 border-primary">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <UserPlus className="mr-2 h-7 w-7 text-primary" /> Manual Organization Registration
          </CardTitle>
          <CardDescription>
            Onboard new customers manually.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <h3 className="font-semibold text-sm uppercase tracking-wider flex items-center gap-2">
                <Building2 className="h-4 w-4" /> Company Identity
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="companyName-onboard">Legal Business Name</Label>
                  <Input id="companyName-onboard" {...form.register('companyName')} placeholder="e.g. West Coast Logistics" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="companyDomain-onboard">Primary Domain (Optional)</Label>
                  <Input id="companyDomain-onboard" {...form.register('companyDomain')} placeholder="westcoast.com.au" />
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="font-semibold text-sm uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" /> Primary Administrator
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="adminName-onboard">Full Name</Label>
                  <Input id="adminName-onboard" {...form.register('adminName')} placeholder="Jane Doe" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="adminEmail-onboard">Email Address</Label>
                  <Input id="adminEmail-onboard" type="email" {...form.register('adminEmail')} placeholder="jane@company.com" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="adminPassword-onboard">Initial Password</Label>
                  <Input id="adminPassword-onboard" type="text" {...form.register('adminPassword')} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="initialTokens-onboard">Starting AI Tokens</Label>
                  <Input id="initialTokens-onboard" type="number" {...form.register('initialTokens')} />
                </div>
              </div>
            </div>

            <div className="pt-4">
              <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Provision Organization"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
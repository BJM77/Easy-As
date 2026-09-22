
"use client";

import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth, useFirestore, setDocumentNonBlocking } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  Building2, 
  MapPin, 
  Phone, 
  Mail, 
  Loader2, 
  Save,
  Package,
  Zap,
  Tag
} from 'lucide-react';
import { collection, doc } from 'firebase/firestore';
import { tgeAccountApplicationSchema } from '@/lib/zodSchemas';
import { ALL_STATES, ALL_LEAD_SALUTATIONS } from '@/lib/types';
import { Separator } from '@/components/ui/separator';

type TgeAccountFormValues = z.infer<typeof tgeAccountApplicationSchema>;

export default function RegisterTGEPageContent() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const firestore = useFirestore();

  const form = useForm<TgeAccountFormValues>({
    resolver: zodResolver(tgeAccountApplicationSchema),
    defaultValues: {
      companyName: '',
      abn: '',
      signeeTitle: 'Mr',
      firstName: '',
      lastName: '',
      addressLine1: '',
      addressLine2: '',
      suburb: '',
      state: 'WA',
      postcode: '',
      country: 'Australia',
      phone: '',
      email: '',
      preferredContact: 'Email',
      customerConsent: false,
      driverEmail: user?.email || '',
      referrerId: '',
      estSatchelsPerWeek: 0,
      estParcelsPerWeek: 0,
      estPalletsPerWeek: 0,
      speedSameDay: false,
      speedPriority: false,
      speedStandard: false,
      notes: '',
    },
  });

  const { control, register, handleSubmit, formState: { errors } } = form;

  const onSubmit = async (data: TgeAccountFormValues) => {
    if (!user || !firestore || !profile?.companyId) {
      toast({ title: 'Authentication Error', description: 'Please log in again.', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);

    try {
      const docRef = doc(collection(firestore, 'tgeAccountApplications'));
      const payload = {
        ...data,
        id: docRef.id,
        userId: user.uid,
        companyId: profile.companyId,
        createdAt: new Date().toISOString(),
        status: 'Submitted' as const,
      };
      
      setDocumentNonBlocking(docRef, payload, { merge: false });
      toast({ title: 'Details Saved', description: `Setup request for ${data.companyName} has been recorded.` });
      form.reset();
    } catch (error) {
      toast({ title: 'Error', description: 'Could not save details.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <Card className="shadow-xl border-t-4 border-primary">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Building2 className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-2xl font-headline">New Account Setup Request</CardTitle>
              <CardDescription>Record the essential details required for a new TGE account setup.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-10">
            
            {/* SECTION 1: COMPANY & SIGNEE */}
            <div className="space-y-6">
              <h3 className="text-lg font-bold flex items-center gap-2 text-primary">
                <Building2 className="h-5 w-5" />
                1. COMPANY & APPLICATION SIGNEE
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <Label>Company Name <span className="text-destructive">*</span></Label>
                  <Input {...register('companyName')} placeholder="Legal Entity Name" />
                  {errors.companyName && <p className="text-xs text-destructive">{errors.companyName.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>ABN <span className="text-destructive">*</span></Label>
                  <Input {...register('abn')} placeholder="XX XXX XXX XXX" />
                  {errors.abn && <p className="text-xs text-destructive">{errors.abn.message}</p>}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1">
                  <Label>Title</Label>
                  <Controller
                    name="signeeTitle"
                    control={control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ALL_LEAD_SALUTATIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="space-y-1">
                  <Label>First Name <span className="text-destructive">*</span></Label>
                  <Input {...register('firstName')} />
                  {errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Last Name <span className="text-destructive">*</span></Label>
                  <Input {...register('lastName')} />
                  {errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
                </div>
              </div>
            </div>

            <Separator />

            {/* SECTION 2: ADDRESS & CONTACT */}
            <div className="space-y-6">
              <h3 className="text-lg font-bold flex items-center gap-2 text-primary">
                <MapPin className="h-5 w-5" />
                2. ADDRESS & CONTACT DETAILS
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1"><Label>Address Line 1 <span className="text-destructive">*</span></Label><Input {...register('addressLine1')} /></div>
                <div className="space-y-1"><Label>Address Line 2</Label><Input {...register('addressLine2')} /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-2 space-y-1"><Label>Suburb <span className="text-destructive">*</span></Label><Input {...register('suburb')} /></div>
                <div className="space-y-1">
                  <Label>State</Label>
                  <Controller
                    name="state"
                    control={control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{ALL_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="space-y-1"><Label>Postcode <span className="text-destructive">*</span></Label><Input {...register('postcode')} /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1">
                  <Label>Phone <span className="text-destructive">*</span></Label>
                  <div className="relative"><Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input className="pl-9" {...register('phone')} /></div>
                </div>
                <div className="space-y-1">
                  <Label>Email <span className="text-destructive">*</span></Label>
                  <div className="relative"><Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input type="email" className="pl-9" {...register('email')} /></div>
                </div>
                <div className="space-y-1">
                  <Label>Preferred Contact</Label>
                  <Controller
                    name="preferredContact"
                    control={control}
                    render={({ field }) => (
                      <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4 pt-3">
                        <div className="flex items-center space-x-2"><RadioGroupItem value="Email" id="pc-email" /><Label htmlFor="pc-email">Email</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="Phone" id="pc-phone" /><Label htmlFor="pc-phone">Phone</Label></div>
                      </RadioGroup>
                    )}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* SECTION 3: FREIGHT PROFILE */}
            <div className="space-y-6">
              <h3 className="text-lg font-bold flex items-center gap-2 text-primary">
                <Package className="h-5 w-5" />
                3. FREIGHT PROFILE & REQUIREMENTS
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-4">
                  <Label className="font-bold flex items-center gap-2 underline decoration-accent"><Package className="h-4 w-4" /> ESTIMATED FREIGHT (WEEKLY)</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs">Satchels</Label>
                      <Input type="number" {...register('estSatchelsPerWeek')} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Parcels</Label>
                      <Input type="number" {...register('estParcelsPerWeek')} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Pallets</Label>
                      <Input type="number" {...register('estPalletsPerWeek')} />
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <Label className="font-bold flex items-center gap-2 underline decoration-accent"><Zap className="h-4 w-4" /> SERVICE SPEED REQUIRED</Label>
                  <div className="flex flex-wrap gap-6 pt-2">
                    <div className="flex items-center space-x-2">
                      <Controller name="speedSameDay" control={control} render={({ field }) => ( <Checkbox id="speed-sameday" checked={field.value} onCheckedChange={field.onChange} /> )}/>
                      <Label htmlFor="speed-sameday" className="cursor-pointer">Same-Day</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Controller name="speedPriority" control={control} render={({ field }) => ( <Checkbox id="speed-priority" checked={field.value} onCheckedChange={field.onChange} /> )}/>
                      <Label htmlFor="speed-priority" className="cursor-pointer">Priority</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Controller name="speedStandard" control={control} render={({ field }) => ( <Checkbox id="speed-standard" checked={field.value} onCheckedChange={field.onChange} /> )}/>
                      <Label htmlFor="speed-standard" className="cursor-pointer">Standard</Label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* SECTION 4: NOTES & CONSENT */}
            <div className="space-y-6">
              <h3 className="text-lg font-bold flex items-center gap-2 text-primary">
                <Tag className="h-5 w-5" />
                4. NOTES & CONSENT
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1"><Label>Notes / Questions</Label><Textarea {...register('notes')} rows={4} placeholder="Additional info..." /></div>
                <div className="space-y-4">
                  <div className="space-y-1"><Label>Referrer ID / Driver Email</Label><Input {...register('driverEmail')} placeholder="your.email@teamglobalexp.com" /></div>
                  <div className="flex items-start space-x-2 p-4 border rounded-md bg-muted/30">
                    <Controller name="customerConsent" control={control} render={({ field }) => (
                      <Checkbox id="consent" checked={field.value} onCheckedChange={field.onChange} className="mt-1" />
                    )} />
                    <div className="grid gap-1.5 leading-none">
                      <Label htmlFor="consent" className="text-sm font-semibold">Customer Consent <span className="text-destructive">*</span></Label>
                      <p className="text-xs text-muted-foreground">The customer provides consent to be contacted and for data to be stored for account setup.</p>
                    </div>
                  </div>
                  {errors.customerConsent && <p className="text-xs text-destructive">{errors.customerConsent.message}</p>}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-4 border-t pt-8">
              <Button type="button" variant="outline" onClick={() => form.reset()} disabled={isSubmitting}>Clear Form</Button>
              <Button type="submit" disabled={isSubmitting} className="min-w-[200px] h-12 text-lg">
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="mr-2 h-4 w-4" /> Save Details</>}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

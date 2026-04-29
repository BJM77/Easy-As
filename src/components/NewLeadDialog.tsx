'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { useAuth, useFirestore, setDocumentNonBlocking } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Lightbulb, Loader2, Camera } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { collection, doc } from 'firebase/firestore';
import { leadSchema, industryOptions } from '@/lib/zodSchemas';
import type { Lead, BusinessUnit, StateAbbreviation, LeadSalutation, LeadSource, LeadFrequency } from '@/lib/types';
import { ALL_STATES, ALL_BUSINESS_UNITS, ALL_LEAD_SALUTATIONS, ALL_LEAD_SOURCES, ALL_LEAD_FREQUENCIES } from '@/lib/types';
import { extractLeadDetailsFromImage, extractLeadDetailsFromText } from '@/ai/flows/extract-lead-details-flow';
import { Sparkles } from 'lucide-react';


type LeadFormValues = z.infer<typeof leadSchema>;

interface NewLeadDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  initialData?: Partial<Lead>;
}

const RequiredIndicator = () => <span className="text-destructive">*</span>;

export default function NewLeadDialog({ isOpen, onOpenChange, initialData }: NewLeadDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const firestore = useFirestore();

  const [isCameraDialogOpen, setIsCameraDialogOpen] = useState(false);
  const [isAiTextDialogOpen, setIsAiTextDialogOpen] = useState(false);
  const [aiNotes, setAiNotes] = useState('');
  const [isExtractingText, setIsExtractingText] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const photoVideoRef = useRef<HTMLVideoElement>(null);
  const photoCanvasRef = useRef<HTMLCanvasElement>(null);

  const defaultFormValues: LeadFormValues = {
    companyName: '',
    lastName: '',
    status: 'new',
    salutation: 'Mr',
    firstName: '',
    leadTopic: '',
    street: '',
    suburb: '',
    postcode: '',
    country: 'Australia',
    state: 'WA',
    contactPhone: '',
    contactEmail: '',
    leadSource: 'Cold Call',
    frequencyOfActivity: 'Reoccurring',
    businessUnit: 'IPEC',
    estimatedValue: 0,
    serviceOfInterest: '',
    notes: '',
    industry: '',
    depot: '',
    estimatedSpend: '0-50K',
    leadOwner: user?.displayName || user?.email || '',
  };

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadSchema),
    defaultValues: defaultFormValues,
  });

  useEffect(() => {
    if (isOpen) {
      // When dialog opens, reset the form with either initialData or defaults
      form.reset(initialData ? { ...defaultFormValues, ...initialData } : defaultFormValues);
    }
  }, [isOpen, initialData, form]);

  useEffect(() => {
    if (isCameraDialogOpen) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        .then(stream => {
          if (photoVideoRef.current) {
            photoVideoRef.current.srcObject = stream;
            photoVideoRef.current.play().catch(e => console.error("Error playing photo video stream:", e));
          }
        })
        .catch(err => {
          console.error("Error accessing camera for photo capture:", err);
          toast({ title: "Camera Error", description: "Could not access the camera.", variant: "destructive" });
        });
    } else {
      if (photoVideoRef.current && photoVideoRef.current.srcObject) {
        const stream = photoVideoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        photoVideoRef.current.srcObject = null;
      }
    }
  }, [isCameraDialogOpen, toast]);

  const handleCaptureAndExtract = async () => {
    if (!photoVideoRef.current || !photoCanvasRef.current) return;
    setIsCapturing(true);

    const video = photoVideoRef.current;
    const canvas = photoCanvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      toast({ title: "Canvas Error", description: "Could not get canvas context.", variant: "destructive" });
      setIsCapturing(false);
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUri = canvas.toDataURL('image/jpeg');

    try {
      const { details } = await extractLeadDetailsFromImage({ photoDataUri: dataUri });

      if (details.companyName) form.setValue('companyName', details.companyName);
      if (details.firstName) form.setValue('firstName', details.firstName);
      if (details.lastName) form.setValue('lastName', details.lastName);
      if (details.email) form.setValue('contactEmail', details.email);
      if (details.phone) form.setValue('contactPhone', details.phone);
      if (details.role) form.setValue('notes', `Role: ${details.role}`);
      if (details.street) form.setValue('street', details.street);
      if (details.suburb) form.setValue('suburb', details.suburb);
      if (details.state) form.setValue('state', details.state as StateAbbreviation);
      if (details.postcode) form.setValue('postcode', details.postcode);

      toast({ title: 'Details Extracted', description: 'Please review the auto-filled lead details.' });
      setIsCameraDialogOpen(false);
    } catch (error) {
      console.error("AI extraction failed:", error);
      toast({ title: "Extraction Failed", description: "Could not automatically extract details from the image.", variant: "destructive" });
    } finally {
      setIsCapturing(false);
    }
  };

  const handleTextExtract = async () => {
    if (!aiNotes.trim()) return;
    setIsExtractingText(true);
    try {
      const { details } = await extractLeadDetailsFromText({ text: aiNotes });
      
      if (details.companyName) form.setValue('companyName', details.companyName);
      if (details.firstName) form.setValue('firstName', details.firstName);
      if (details.lastName) form.setValue('lastName', details.lastName);
      if (details.email) form.setValue('contactEmail', details.email);
      if (details.phone) form.setValue('contactPhone', details.phone);
      if (details.role) form.setValue('notes', `Role: ${details.role}\n\nOriginal Notes:\n${aiNotes}`);
      if (details.street) form.setValue('street', details.street);
      if (details.suburb) form.setValue('suburb', details.suburb);
      if (details.state) form.setValue('state', details.state as StateAbbreviation);
      if (details.postcode) form.setValue('postcode', details.postcode);

      toast({ title: 'AI Extraction Complete', description: 'Form has been auto-filled from your notes.' });
      setIsAiTextDialogOpen(false);
      setAiNotes('');
    } catch (error) {
      console.error("Text extraction failed:", error);
      toast({ title: "AI Error", description: "Could not extract details from text.", variant: "destructive" });
    } finally {
      setIsExtractingText(false);
    }
  };

  const onSubmit = async (data: LeadFormValues) => {
    if (!user?.email || !firestore || !profile?.companyId) {
      toast({ title: 'Not Authenticated', description: 'Session error. Please log in again.', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);

    try {
      const leadsCollection = collection(firestore, 'leads');
      const docRef = doc(leadsCollection);
      const payload = {
        ...data,
        id: docRef.id,
        userId: user.uid,
        companyId: profile.companyId, // Tag with tenant ID
        date: new Date().toISOString(),
        status: 'new' as const,
        reportedBy: user.email,
        salesforceSync: 'not_synced' as const,
        country: 'Australia',
      };
      setDocumentNonBlocking(docRef, payload, { merge: false });

      toast({ title: 'Success', description: `New lead for ${data.companyName} has been logged.` });
      onOpenChange(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      toast({ title: 'Submission Failed', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <div className="flex justify-between items-start">
              <div className="flex items-center">
                <Lightbulb className="mr-2 h-6 w-6 text-primary" />
                <div>
                  <DialogTitle>{initialData ? 'Duplicate' : 'Log a New'} Lead</DialogTitle>
                  <DialogDescription>
                    {initialData ? 'Modify details and submit to create a new lead.' : 'Quickly capture the details of a new business opportunity.'}
                  </DialogDescription>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsAiTextDialogOpen(true)}>
                    <Sparkles className="mr-2 h-4 w-4 text-primary" /> AI Assistant
                </Button>
                <Button variant="outline" size="sm" onClick={() => setIsCameraDialogOpen(true)}>
                    <Camera className="mr-2 h-4 w-4" /> Scan Card
                </Button>
              </div>
            </div>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label htmlFor="companyName-lead">Company Name <RequiredIndicator /></Label>
                <Input 
                  id="companyName-lead" 
                  name="companyName"
                  {...form.register('companyName')} 
                  placeholder="e.g., ACME Corp" 
                />
                {form.formState.errors.companyName && <p className="text-sm text-destructive">{form.formState.errors.companyName.message}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="leadOwner-lead">Lead Owner</Label>
                <Input 
                  id="leadOwner-lead" 
                  name="leadOwner"
                  {...form.register('leadOwner')} 
                  placeholder="Lead Owner Name" 
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="salutation-lead">Salutation</Label>
                <Controller 
                  name="salutation" 
                  control={form.control} 
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger id="salutation-lead"><SelectValue placeholder="Select Salutation" /></SelectTrigger>
                      <SelectContent>
                        {ALL_LEAD_SALUTATIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )} 
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="firstName-lead">First Name</Label>
                <Input 
                  id="firstName-lead" 
                  name="firstName"
                  {...form.register('firstName')} 
                  placeholder="e.g., Jane" 
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="lastName-lead">Last Name <RequiredIndicator /></Label>
                <Input 
                  id="lastName-lead" 
                  name="lastName"
                  {...form.register('lastName')} 
                  placeholder="e.g., Doe" 
                />
                {form.formState.errors.lastName && <p className="text-sm text-destructive">{form.formState.errors.lastName.message}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="contactEmail-lead">Contact Email</Label>
                <Input 
                  id="contactEmail-lead" 
                  name="contactEmail"
                  type="email" 
                  {...form.register('contactEmail')} 
                  placeholder="e.g., jane@acme.com" 
                />
                {form.formState.errors.contactEmail && <p className="text-sm text-destructive">{form.formState.errors.contactEmail.message}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="contactPhone-lead">Contact Phone</Label>
                <Input 
                  id="contactPhone-lead" 
                  name="contactPhone"
                  {...form.register('contactPhone')} 
                  placeholder="e.g., 0400 123 456" 
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="street-lead">Street Address</Label>
              <Textarea 
                id="street-lead" 
                name="street"
                {...form.register('street')} 
                placeholder="e.g., 123 Example St" 
                rows={2} 
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label htmlFor="suburb-lead">Suburb</Label>
                <Input 
                  id="suburb-lead" 
                  name="suburb"
                  {...form.register('suburb')} 
                  placeholder="e.g., Sydney" 
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="state-lead-new">State</Label>
                <Controller 
                  name="state" 
                  control={form.control} 
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger id="state-lead-new"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ALL_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )} 
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="postcode-lead">Postcode</Label>
                <Input 
                  id="postcode-lead" 
                  name="postcode"
                  {...form.register('postcode')} 
                  placeholder="e.g., 2000" 
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="leadSource-lead">Lead Source</Label>
                <Controller 
                  name="leadSource" 
                  control={form.control} 
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger id="leadSource-lead"><SelectValue placeholder="Select Source" /></SelectTrigger>
                      <SelectContent>
                        {ALL_LEAD_SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )} 
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="frequency-lead">Frequency</Label>
                <Controller
                  name="frequencyOfActivity"
                  control={form.control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger id="frequency-lead"><SelectValue placeholder="Select Frequency" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Reoccurring">Regular</SelectItem>
                        <SelectItem value="Tender">Tender</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="businessUnit-lead">Business Unit <RequiredIndicator /></Label>
                <Controller 
                  name="businessUnit" 
                  control={form.control} 
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger id="businessUnit-lead"><SelectValue placeholder="Select Business Unit" /></SelectTrigger>
                      <SelectContent>
                        {ALL_BUSINESS_UNITS.map(bu => <SelectItem key={bu} value={bu}>{bu}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )} 
                />
                {form.formState.errors.businessUnit && <p className="text-sm text-destructive">{form.formState.errors.businessUnit.message}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="serviceOfInterest-lead">Service of Interest</Label>
                <Input 
                  id="serviceOfInterest-lead" 
                  name="serviceOfInterest"
                  {...form.register('serviceOfInterest')} 
                  placeholder="e.g., B2B Priority" 
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="industry-lead">Industry</Label>
                <Controller 
                  name="industry" 
                  control={form.control} 
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger id="industry-lead"><SelectValue placeholder="Select Industry" /></SelectTrigger>
                      <SelectContent>
                        {industryOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )} 
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="estimatedValue-lead">Est. Annual Value ($)</Label>
                <Input 
                  id="estimatedValue-lead" 
                  name="estimatedValue"
                  type="number" 
                  {...form.register('estimatedValue')} 
                  placeholder="e.g., 50000" 
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="depot-lead">Depot</Label>
                <Input 
                  id="depot-lead" 
                  name="depot"
                  {...form.register('depot')} 
                  placeholder="e.g., Perth" 
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="estimatedSpend-lead">Estimated Spend</Label>
                <Controller 
                  name="estimatedSpend" 
                  control={form.control} 
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger id="estimatedSpend-lead"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['0-50K', '50-100K', '100-250K', '250K+'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )} 
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="leadTopic-lead">Lead Topic</Label>
                <Input 
                  id="leadTopic-lead" 
                  name="leadTopic"
                  {...form.register('leadTopic')} 
                  placeholder="e.g., Urgent Freight Needs" 
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="notes-lead">Notes</Label>
              <Textarea 
                id="notes-lead" 
                name="notes"
                {...form.register('notes')} 
                rows={3} 
                placeholder="Initial discussion points, next steps, etc." 
              />
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Log Lead</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isCameraDialogOpen} onOpenChange={setIsCameraDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center"><Camera className="mr-2 h-5 w-5" />Scan Business Card / Signature</DialogTitle>
          </DialogHeader>
          <div className="aspect-video w-full bg-muted rounded-lg flex items-center justify-center overflow-hidden relative">
            <video ref={photoVideoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
            <canvas ref={photoCanvasRef} className="hidden" />
          </div>
          <DialogFooter>
            <Button onClick={handleCaptureAndExtract} disabled={isCapturing}>
              {isCapturing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
              Capture & Extract Details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAiTextDialogOpen} onOpenChange={setIsAiTextDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center"><Sparkles className="mr-2 h-5 w-5 text-primary" />AI Notes Assistant</DialogTitle>
            <DialogDescription>Paste meeting notes, an email body, or any unstructured text to extract lead details.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea 
                value={aiNotes} 
                onChange={(e) => setAiNotes(e.target.value)} 
                placeholder="e.g. Just had a coffee with John Smith from ACME. He's the Ops Manager and is interested in our Perth to Sydney rates. His email is john@acme.com..."
                rows={8}
                className="resize-none font-sans text-sm"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsAiTextDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleTextExtract} disabled={isExtractingText || !aiNotes.trim()}>
              {isExtractingText ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Extract Details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
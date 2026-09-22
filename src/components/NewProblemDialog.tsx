"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { useAuth, useFirestore, setDocumentNonBlocking } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import type { ProblemEntry, ServiceName, ProblemType, ProblemSubType, SimplifiedCarrier } from '@/lib/types';
import { ALL_SIMPLIFIED_CARRIERS } from '@/lib/types';
import { problemLogSchema } from '@/lib/zodSchemas';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, PlusCircle, ShieldAlert, Upload, ClipboardPaste } from 'lucide-react';
import { collection, doc } from 'firebase/firestore';
import { extractProblemDetailsFromEmail } from '@/ai/flows/extract-problem-details-flow';
import { useSession } from '@/context/SessionContext';
import { cn } from '@/lib/utils';


interface NewProblemDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

type ProblemLogFormValues = z.infer<typeof problemLogSchema>;

const subTypeOptions: Record<ProblemType, { value: ProblemSubType<any>; label: string }[]> = {
    delivery_issue: [
        { value: 'late_delivery', label: 'Late Delivery' },
        { value: 'short_delivery', label: 'Short Delivery (Missing Items)' },
        { value: 'pod_issue', label: 'Proof of Delivery Issue' },
        { value: 'sr_atl_ed', label: "SR ATL'ed" },
        { value: 'other', label: 'Other Delivery Issue' },
    ],
    freight_issue: [
        { value: 'misdirected', label: 'Misdirected' },
        { value: 'held_at_depot', label: 'Held at Depot' },
        { value: 'awaiting_paperwork', label: 'Awaiting Paperwork' },
        { value: 'packaging_issue', label: 'Packaging Issue' },
        { value: 'wrong_service', label: 'Wrong Service'},
        { value: 'other', label: 'Other Freight Issue' },
    ],
    billing_issue: [
        { value: 'incorrect_invoice', label: 'Incorrect Invoice' },
        { value: 'surcharge_dispute', label: 'Surcharge Dispute' },
        { value: 'stop_trade', label: 'Stop Trade'},
        { value: 'other', label: 'Other Billing Issue' },
    ],
    freight_damage: [
        { value: 'handling_damage', label: 'Handling Damage' },
        { value: 'water_damage', label: 'Water Damage' },
        { value: 'other', label: 'Other Damage' },
    ],
    customer_complaint: [],
    other: [],
};

export default function NewProblemDialog({ isOpen, onOpenChange }: NewProblemDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const { addTokens } = useSession();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const firestore = useFirestore();

  const [isPasteDialogOpen, setIsPasteDialogOpen] = useState(false);
  const [pastedEmailBody, setPastedEmailBody] = useState('');

  const form = useForm<ProblemLogFormValues>({
    resolver: zodResolver(problemLogSchema),
    defaultValues: {
      consignmentNumber: '',
      accountNumber: '',
      customerImpacted: '',
      description: '',
      problemType: undefined,
      problemSubType: undefined,
      otherProblemTypeDescription: '',
      carrier: undefined,
      depotAtFault: '',
    },
  });

  const watchProblemType = form.watch('problemType');
  const watchConsignmentNumber = form.watch('consignmentNumber');

  useEffect(() => {
    if (isOpen) {
      form.reset();
    }
  }, [isOpen, form]);

  useEffect(() => {
    form.resetField('problemSubType');
  }, [watchProblemType, form]);

  useEffect(() => {
    const connote = watchConsignmentNumber.trim().toUpperCase();
    if (connote.startsWith('240')) {
      form.setValue('carrier', 'IPEC', { shouldValidate: true });
    } else if (/^[A-Z]{4}\d{6}$/.test(connote)) {
      form.setValue('carrier', 'Priority', { shouldValidate: true });
    }
  }, [watchConsignmentNumber, form]);

  const processEmailText = async (emailBody: string) => {
    if (!emailBody) {
      throw new Error("No readable content found in the dropped item.");
    }
    setIsSubmitting(true);
    toast({ title: "Processing Email...", description: "The AI is extracting details from the email content." });

    try {
        const { details, usage } = await extractProblemDetailsFromEmail({ emailBody });
        addTokens(usage.totalTokens);
        
        form.setValue('consignmentNumber', details.consignmentNumber, { shouldValidate: true });
        form.setValue('carrier', details.carrier, { shouldValidate: true });
        form.setValue('problemType', details.problemType, { shouldValidate: true });
        form.setValue('description', details.description, { shouldValidate: true });

        toast({ title: "Details Extracted", description: "Please review the auto-filled fields before submitting." });
        return true;
    } catch (e: any) {
        toast({ title: "Extraction Failed", description: e.message || "Could not process the dropped email.", variant: "destructive" });
        return false;
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDrop = useCallback(async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    let emailBody = '';
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
        const file = event.dataTransfer.files[0];
        if (file.type === 'message/rfc822' || file.name.endsWith('.eml')) {
            emailBody = await file.text();
        } else {
            toast({ title: "Unsupported File", description: "Please drop a .eml file or plain text.", variant: "destructive"});
            return;
        }
    } else {
        emailBody = event.dataTransfer.getData('text/plain');
    }

    await processEmailText(emailBody);
  }, [toast, addTokens, form]);

  const handlePasteProcess = async () => {
    await processEmailText(pastedEmailBody);
    setIsPasteDialogOpen(false);
    setPastedEmailBody('');
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };
  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };
  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const onSubmit = async (data: ProblemLogFormValues) => {
    if (!user?.email || !firestore || !profile?.companyId) {
      toast({ title: 'Not Authenticated', description: 'Session error. Please log in again.', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    try {
      const docRef = doc(collection(firestore, 'problems'));
      const payload: Omit<ProblemEntry, 'id'> = {
        ...data,
        userId: user.uid,
        companyId: profile.companyId, // Tag with tenant ID
        date: new Date().toISOString(),
        status: 'open',
        reportedBy: user.email,
        solution: '',
        outcome: '',
        dateCompleted: null,
      };
      setDocumentNonBlocking(docRef, payload, { merge: false });
      toast({ title: 'Success', description: 'Problem logging in progress.' });
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
        <DialogContent 
          className="sm:max-w-[625px]"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
        >
          <DialogHeader>
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <ShieldAlert className="mr-2 h-6 w-6 text-primary" />
                <div>
                  <DialogTitle>Log a New Problem</DialogTitle>
                  <DialogDescription>
                    Drag & drop an email file (.eml) or use the paste button to auto-fill.
                  </DialogDescription>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setIsPasteDialogOpen(true)}>
                <ClipboardPaste className="mr-2 h-4 w-4" /> Paste from Email
              </Button>
            </div>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
            <div 
              className={cn(
                "relative grid grid-cols-1 md:grid-cols-2 gap-4 transition-all duration-300",
                isDragging && "opacity-50"
              )}
              >
                <div className="space-y-1">
                  <Label htmlFor="problemType-dialog">Problem Type</Label>
                  <Controller
                    name="problemType"
                    control={form.control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value ?? ''}>
                        <SelectTrigger id="problemType-dialog">
                          <SelectValue placeholder="Select a type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="freight_issue">Freight Issue</SelectItem>
                          <SelectItem value="delivery_issue">Delivery Issue</SelectItem>
                          <SelectItem value="billing_issue">Billing Issue</SelectItem>
                          <SelectItem value="freight_damage">Freight Damage</SelectItem>
                          <SelectItem value="customer_complaint">Customer Complaint</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {form.formState.errors.problemType && <p className="text-sm text-destructive">{form.formState.errors.problemType.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="consignmentNumber-dialog">Consignment Number</Label>
                  <Input 
                    id="consignmentNumber-dialog" 
                    name="consignmentNumber"
                    {...form.register('consignmentNumber')} 
                    placeholder="e.g., TGE12345678" 
                  />
                  {form.formState.errors.consignmentNumber && <p className="text-sm text-destructive">{form.formState.errors.consignmentNumber.message}</p>}
                </div>
                {watchProblemType && watchProblemType !== 'other' && subTypeOptions[watchProblemType]?.length > 0 && (
                  <div className="space-y-1">
                      <Label htmlFor="problemSubType-dialog">Sub-Type</Label>
                      <Controller
                          name="problemSubType"
                          control={form.control}
                          render={({ field }) => (
                              <Select onValueChange={field.onChange} value={field.value ?? ''}>
                                  <SelectTrigger id="problemSubType-dialog"><SelectValue placeholder="Select a sub-type..." /></SelectTrigger>
                                  <SelectContent>
                                      {subTypeOptions[watchProblemType].map(opt => (
                                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                      ))}
                                  </SelectContent>
                              </Select>
                          )}
                      />
                  </div>
                )}
                {watchProblemType === 'other' && (
                  <div className="space-y-1">
                      <Label htmlFor="otherProblemTypeDescription-dialog">Specify "Other" Problem</Label>
                      <Input 
                        id="otherProblemTypeDescription-dialog" 
                        name="otherProblemTypeDescription"
                        {...form.register('otherProblemTypeDescription')} 
                        placeholder="e.g., Special Request Not Met" 
                      />
                      {form.formState.errors.otherProblemTypeDescription && <p className="text-sm text-destructive">{form.formState.errors.otherProblemTypeDescription.message}</p>}
                  </div>
                )}
                  <div className="space-y-1">
                      <Label htmlFor="carrier-dialog">Carrier / Service</Label>
                      <Controller
                          name="carrier"
                          control={form.control}
                          render={({ field }) => (
                              <Select onValueChange={field.onChange} value={field.value ?? ''}>
                                  <SelectTrigger id="carrier-dialog"><SelectValue placeholder="Select carrier..." /></SelectTrigger>
                                  <SelectContent>
                                      {ALL_SIMPLIFIED_CARRIERS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                  </SelectContent>
                              </Select>
                          )}
                      />
                  </div>
                  <div className="space-y-1">
                      <Label htmlFor="accountNumber-dialog">Account Number</Label>
                      <Input 
                        id="accountNumber-dialog" 
                        name="accountNumber"
                        {...form.register('accountNumber')} 
                        placeholder="e.g., 80272019" 
                      />
                      {form.formState.errors.accountNumber && <p className="text-sm text-destructive">{form.formState.errors.accountNumber.message}</p>}
                  </div>
                  <div className="space-y-1">
                      <Label htmlFor="customerImpacted-dialog">Customer Impacted</Label>
                      <Input 
                        id="customerImpacted-dialog" 
                        name="customerImpacted"
                        {...form.register('customerImpacted')} 
                        placeholder="e.g., ACME Corp" 
                      />
                      {form.formState.errors.customerImpacted && <p className="text-sm text-destructive">{form.formState.errors.customerImpacted.message}</p>}
                  </div>
              </div>
              <div 
                className={cn(
                  "relative space-y-1 transition-all duration-300",
                  isDragging && "opacity-50"
                )}
              >
                <Label htmlFor="description-dialog">Description of Problem</Label>
                <Textarea 
                  id="description-dialog" 
                  name="description"
                  {...form.register('description')} 
                  rows={3} 
                  placeholder="Provide a clear and concise description of the issue..." 
                />
                {form.formState.errors.description && <p className="text-sm text-destructive">{form.formState.errors.description.message}</p>}
              </div>

              {isDragging && (
                  <div className="absolute inset-0 bg-primary/20 border-2 border-dashed border-primary rounded-lg flex flex-col items-center justify-center pointer-events-none">
                      <Upload className="h-10 w-10 text-primary" />
                      <p className="mt-2 text-sm font-semibold text-primary">Drop Email Here to Auto-Populate</p>
                  </div>
              )}
          </form>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" onClick={form.handleSubmit(onSubmit)} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Problem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isPasteDialogOpen} onOpenChange={setIsPasteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Paste Email Content</DialogTitle>
            <DialogDescription>Paste the full body of the email below and click "Process" to have the AI extract the details.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="pasted-email-body" className="sr-only">Email Body</Label>
            <Textarea 
              id="pasted-email-body"
              name="pasted-email-body"
              value={pastedEmailBody}
              onChange={(e) => setPastedEmailBody(e.target.value)}
              rows={15}
              placeholder="Paste email content here..."
            />
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handlePasteProcess} disabled={isSubmitting || !pastedEmailBody}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Process
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { EmailQuoteDialogProps, FreightFormValues, CalculatedPriceItem, FreightItem } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/hooks/use-toast';
import { Mail, User, Send } from 'lucide-react';

const emailQuoteSchema = z.object({
  email: z.string().email("Invalid email address."),
  contactName: z.string().min(1, "Contact name is required."),
});

type EmailQuoteFormValues = z.infer<typeof emailQuoteSchema>;

const formatCurrency = (amount: number | null) => {
  if (amount === null || isNaN(amount)) return "N/A";
  return amount.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });
};

const formatLocation = (location: FreightFormValues['originLocation'] | FreightFormValues['destinationLocation']): string => {
  if (!location) return "N/A";
  return `${location.suburb} ${location.postcode}, ${location.state}`;
};

const formatItemsSummary = (items: FreightItem[]): string => {
  if (!items || items.length === 0) return "No items specified.";
  return items.map(item => 
    `- ${item.quantity} x ${item.weight}kg ` +
    (item.length && item.width && item.height ? `(${item.length}L x ${item.width}W x ${item.height}H cm) ` : '(No dims provided) ')
  ).join('\n');
};

export default function EmailQuoteDialog({ isOpen, onOpenChange, serviceResult, freightFormValues }: EmailQuoteDialogProps) {
  const { emailQuoteTemplate } = useSettings();
  const { toast } = useToast();

  const form = useForm<EmailQuoteFormValues>({
    resolver: zodResolver(emailQuoteSchema),
    defaultValues: {
      email: '',
      contactName: '',
    },
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({ email: '', contactName: '' });
    }
  }, [isOpen, form]);

  const handlePrepareEmail = (data: EmailQuoteFormValues) => {
    if (!serviceResult || !freightFormValues) {
      toast({ title: "Error", description: "Missing quote data to prepare email.", variant: "destructive" });
      return;
    }

    let processedBody = emailQuoteTemplate;
    processedBody = processedBody.replace(/{{contactName}}/g, data.contactName);
    processedBody = processedBody.replace(/{{serviceName}}/g, String(serviceResult.serviceName));
    processedBody = processedBody.replace(/{{estimatedTotal}}/g, formatCurrency(serviceResult.finalPrice));
    processedBody = processedBody.replace(/{{origin}}/g, formatLocation(freightFormValues.originLocation));
    processedBody = processedBody.replace(/{{destination}}/g, formatLocation(freightFormValues.destinationLocation));
    processedBody = processedBody.replace(/{{itemsSummary}}/g, formatItemsSummary(freightFormValues.items));
    processedBody = processedBody.replace(/{{date}}/g, new Date().toLocaleDateString());
    
    const subject = `Your Freight Quote from BD Assist - ${serviceResult.serviceName}`;
    const mailtoLink = `mailto:${data.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(processedBody)}`;

    try {
      window.location.href = mailtoLink;
      toast({ title: "Email Client Opened", description: "Your email client should now be open with the quote details." });
      onOpenChange(false); // Close dialog
    } catch (error) {
      console.error("Error opening mailto link:", error);
      toast({ title: "Error", description: "Could not open your email client. Please try copying the details manually.", variant: "destructive" });
    }
  };

  if (!serviceResult) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center"><Mail className="mr-2 h-5 w-5 text-primary" />Email Quote: {serviceResult.serviceName}</DialogTitle>
          <DialogDescription>
            Enter the recipient's details to prepare an email with this quote. Estimated Total: <strong>{formatCurrency(serviceResult.finalPrice)}</strong>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handlePrepareEmail)} className="space-y-4 py-2">
          <div>
            <Label htmlFor="contactName" className="flex items-center"><User className="mr-1 h-4 w-4 text-muted-foreground" />Contact Name</Label>
            <Input id="contactName" {...form.register('contactName')} placeholder="Recipient's Name" />
            {form.formState.errors.contactName && <p className="text-sm text-destructive mt-1">{form.formState.errors.contactName.message}</p>}
          </div>
          <div>
            <Label htmlFor="email" className="flex items-center"><Mail className="mr-1 h-4 w-4 text-muted-foreground" />Email Address</Label>
            <Input id="email" type="email" {...form.register('email')} placeholder="recipient@example.com" />
            {form.formState.errors.email && <p className="text-sm text-destructive mt-1">{form.formState.errors.email.message}</p>}
          </div>
          <DialogFooter>
            <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              <Send className="mr-2 h-4 w-4" /> Prepare Email
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

    
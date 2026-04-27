"use client";

import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Receipt, CalendarIcon, Send, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const remittanceSchema = z.object({
  companyName: z.string().min(1, "Company name is required."),
  emailAddress: z.string().email("A valid email address is required."),
  invoiceNumber: z.string().min(1, "Invoice number is required."),
  remittanceNumber: z.string().min(1, "Remittance number is required."),
  dateDue: z.date({
    required_error: "A due date is required.",
  }),
  remittanceFile: z.custom<FileList | null>((val) => val instanceof FileList && val.length > 0, "A remittance file is required.")
    .refine(files => files && files[0].size <= 5 * 1024 * 1024, `File size should be less than 5MB.`)
    .refine(files => files && ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'].includes(files[0].type), 'Only .jpg, .png, .gif, and .pdf files are accepted.'),
});

type RemittanceFormValues = z.infer<typeof remittanceSchema>;

export default function RemittancePageContent() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  const form = useForm<RemittanceFormValues>({
    resolver: zodResolver(remittanceSchema),
  });

  const { control, handleSubmit, register, watch, formState: { errors } } = form;
  const remittanceFile = watch('remittanceFile');

  useEffect(() => {
    if (remittanceFile && remittanceFile.length > 0) {
      const file = remittanceFile[0];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFilePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setFilePreview(null); // No preview for non-image files like PDF
      }
    } else {
      setFilePreview(null);
    }
  }, [remittanceFile]);

  const onSubmit = async (data: RemittanceFormValues) => {
    setIsSubmitting(true);

    const subject = `Remittance Submission: Invoice #${data.invoiceNumber} / Remittance #${data.remittanceNumber}`;
    const body = `
Dear GSS Team,

Please find the remittance advice attached for the following invoice.

--- Details ---
Company Name: ${data.companyName}
Contact Email: ${data.emailAddress}
Invoice #: ${data.invoiceNumber}
Remittance #: ${data.remittanceNumber}
Date Due: ${format(data.dateDue, 'PPP')}
---

Thank you,
BD Assist

[Please manually attach the remittance file to this email before sending]
    `.trim();

    const mailtoLink = `mailto:gss.remittances@teamglobalexp.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    try {
      window.location.href = mailtoLink;
      toast({
        title: "Email Client Opened",
        description: "Please attach the remittance file and send the email.",
      });
      form.reset();
    } catch (error) {
      console.error("Error opening mailto link:", error);
      toast({
        title: "Error",
        description: "Could not open your email client automatically. Please copy the details manually.",
        variant: "destructive",
      });
    }

    setIsSubmitting(false);
  };

  return (
    <div className="space-y-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <Receipt className="mr-2 h-7 w-7 text-primary" /> Remittance Submission
          </CardTitle>
          <CardDescription>
            Submit a copy of your remittance advice for processing. The system will generate an email ready for you to attach the file and send.
          </CardDescription>
        </CardHeader>
      </Card>
      
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Important: Manual Attachment Required</AlertTitle>
        <AlertDescription>
          Due to browser security, you must <strong>manually attach the remittance file</strong> to the email draft after it opens in your email client.
        </AlertDescription>
      </Alert>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Remittance Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <Label htmlFor="companyName">Company Name</Label>
                <Input id="companyName" {...register('companyName')} />
                {errors.companyName && <p className="text-sm text-destructive">{errors.companyName.message}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="emailAddress">Your Email Address</Label>
                <Input id="emailAddress" type="email" {...register('emailAddress')} />
                {errors.emailAddress && <p className="text-sm text-destructive">{errors.emailAddress.message}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="invoiceNumber">Invoice #</Label>
                <Input id="invoiceNumber" {...register('invoiceNumber')} />
                {errors.invoiceNumber && <p className="text-sm text-destructive">{errors.invoiceNumber.message}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="remittanceNumber">Remittance #</Label>
                <Input id="remittanceNumber" {...register('remittanceNumber')} />
                {errors.remittanceNumber && <p className="text-sm text-destructive">{errors.remittanceNumber.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Date Due</Label>
                <Controller
                  name="dateDue"
                  control={control}
                  render={({ field }) => (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                      </PopoverContent>
                    </Popover>
                  )}
                />
                {errors.dateDue && <p className="text-sm text-destructive">{errors.dateDue.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="remittanceFile">Remittance File (Image or PDF, max 5MB)</Label>
                <Input id="remittanceFile" type="file" accept="image/*,application/pdf" {...register('remittanceFile')} />
                {errors.remittanceFile && <p className="text-sm text-destructive">{errors.remittanceFile.message as string}</p>}
                {filePreview && (
                  <div className="mt-2">
                    <img src={filePreview} alt="Remittance preview" className="max-h-48 rounded-md border" />
                  </div>
                )}
                {remittanceFile && remittanceFile[0]?.type === 'application/pdf' && (
                    <p className="text-sm text-muted-foreground mt-2">PDF file selected (no preview available).</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          Prepare & Submit Remittance
        </Button>
      </form>
    </div>
  );
}

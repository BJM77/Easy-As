
"use client";

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ServiceName, PostcodeData } from '@/lib/types';
import { z } from 'zod'; // Import z directly if exportFormSchema is removed or significantly changed
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ALL_SERVICES } from '@/lib/types';
import { useSettings } from '@/context/SettingsContext';
import { CalendarIcon, Download, User, MapPinIcon, DollarSign, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// Define a specific schema for this page if it diverges significantly
// from a potentially renamed/refactored global exportFormSchema
const singleLocationExportFormSchema = z.object({
  customerName: z.string().min(1, "Customer name is required."),
  sendingPostcode: z.string().min(4, "Valid postcode is required.").max(4, "Postcode must be 4 digits."),
  date: z.date({ required_error: "Date is required."}),
  spendBand: z.string().min(1, "Spend band is required."),
  services: z.array(z.enum(ALL_SERVICES as [ServiceName, ...ServiceName[]]))
             .min(1, "At least one service must be selected."),
});
type SingleLocationExportFormValues = z.infer<typeof singleLocationExportFormSchema>;


export default function ExportRatesPageContent() {
  const { globalSpendBands } = useSettings();
  const [isLoading, setIsLoading] = useState(false);
  const [allPostcodes, setAllPostcodes] = useState<PostcodeData[]>([]);
  const [postcodesLoading, setPostcodesLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchPostcodes = async () => {
      setPostcodesLoading(true);
      try {
        const response = await fetch('/api/postcodes');
        if (!response.ok) {
          let errorDetails = `HTTP error! status: ${response.status}`;
          try {
            const errorData = await response.json();
            if (errorData && errorData.details) {
              errorDetails = `API Error: ${errorData.details} (Status: ${response.status})`;
            } else if (errorData && errorData.error) {
              errorDetails = `API Error: ${errorData.error} (Status: ${response.status})`;
            }
          } catch (jsonError) {
            console.warn("Could not parse error response from /api/postcodes:", jsonError);
          }
          throw new Error(errorDetails);
        }
        const data: PostcodeData[] = await response.json();
        setAllPostcodes(data);
      } catch (error) {
        const errorMessage = (error instanceof Error) ? error.message : "An unknown error occurred";
        console.error("Failed to fetch postcodes for export page:", errorMessage);
        toast({
          title: "Postcode Data Error",
          description: `Could not load postcode data. ${errorMessage}. Please check server logs.`,
          variant: "destructive",
        });
        setAllPostcodes([]);
      } finally {
        setPostcodesLoading(false);
      }
    };
    fetchPostcodes();
  }, [toast]);

  const form = useForm<SingleLocationExportFormValues>({
    resolver: zodResolver(singleLocationExportFormSchema),
    defaultValues: {
      customerName: '',
      sendingPostcode: '',
      date: new Date(),
      spendBand: globalSpendBands[0] || "1",
      services: [],
    },
  });

  const onSubmit = async (data: SingleLocationExportFormValues) => {
    setIsLoading(true);
    
    if (postcodesLoading) {
      toast({ title: "Processing...", description: "Postcode data is still loading. Please wait.", variant: "default" });
      setIsLoading(false);
      return;
    }

    const { customerName, sendingPostcode, date: exportDate, spendBand, services } = data;
    
    const originPostcodeDetail = allPostcodes.find(p => p.postcode.toString() === sendingPostcode);

    if (!originPostcodeDetail) {
      toast({
        title: "Invalid Sending Postcode",
        description: `Sending postcode ${sendingPostcode} was not found in our records. Please enter a valid postcode.`,
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }
    
    const formattedDate = format(exportDate, 'yyyy-MM-dd');

    let csvHeader = "Customer Name,Sending Postcode,Effective Date,Spend Band,Product,From Zone,To Zone,Cube Factor,Price Basis,Reciprocal,Min Charge,Basic,Kilo Rate Thereafter\n";
    let csvContent = csvHeader;

    services.forEach(serviceName => {
        const isPalletService = serviceName.toLowerCase().includes('pallet');
        // B2C, LCP GO are prio based for zones. Standard services (B2B Std, LCP Std) are IPEC based.
        const isStandardRoadService = (serviceName === 'B2B Std' || serviceName === 'LCP Std');


        let fromZone = 'N/A';
        if (originPostcodeDetail) {
            if (isPalletService) {
                fromZone = originPostcodeDetail.pallet || 'N/A';
            } else if (isStandardRoadService) { 
                fromZone = originPostcodeDetail.ipec;
            } else { // B2B Priority, LCP Priority, LCP GO (Std & Prio), B2C (Std & Prio)
                fromZone = originPostcodeDetail.prio;
            }
        }
        
        const toZone = "ALL_OTHER_ZONES"; 
        const cubeFactor = isPalletService ? "333" : "250";
        const priceBasis = isPalletService ? "Per Pallet" : "Basic | Kilo";
        const reciprocal = isPalletService ? "N/A" : "N";
        
        // Simplified Min/Basic based on service type for placeholders
        let minCharge = "XX.XX";
        let basicRate = "XX.XX";

        if (serviceName === 'B2B Priority' || serviceName === 'LCP Priority' || serviceName.startsWith('LCP GO')) {
            minCharge = "0.00"; // Prio and LCP GO often have 0 min or basic if it's per KG from start
            basicRate = "0.00"; 
        } else if (isPalletService) {
             // Keep XX.XX for pallets as they are per pallet
        } else if (serviceName.startsWith('B2C')) {
            minCharge = "0.00"; // B2C is tiered, this placeholder is less accurate
            basicRate = "Tiered";
        }


        const kiloRate = "XX.XX"; 

        const row = [
            `"${customerName.replace(/"/g, '""')}"`,
            sendingPostcode,
            formattedDate,
            `Spend Band ${spendBand}`,
            serviceName,
            fromZone,
            toZone,
            cubeFactor,
            priceBasis,
            reciprocal,
            minCharge,
            basicRate,
            kiloRate
        ].join(',');
        csvContent += row + "\n";
    });

    try {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        const sanitizedCustomerName = customerName.replace(/[\s\/\\:*?"<>|]+/g, '_');
        const filename = `${sanitizedCustomerName} - Spend Band ${spendBand} - ${formattedDate}.csv`;
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast({
          title: "Download Started",
          description: "Your rate export CSV has started downloading.",
          variant: "default",
        });
      } else {
         toast({
          title: "Download Not Supported",
          description: "Your browser does not support direct file downloads. Please try a different browser.",
          variant: "destructive",
        });
      }
    } catch (error) {
        console.error("Error generating or downloading CSV:", error);
        toast({
          title: "Export Error",
          description: "Could not generate or download the CSV file.",
          variant: "destructive",
        });
    }
    
    setIsLoading(false);
  };

  return (
    <div className="space-y-8">
       <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <Download className="mr-2 h-7 w-7 text-primary" /> Placeholder Rate Exporter
          </CardTitle>
          <CardDescription>Generate a CSV of placeholder rates. Note: The new "Rate Card Generator" page offers more advanced functionality.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle className="text-xl">Export Criteria</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Customer Name */}
              <div className="space-y-2">
                <Label htmlFor="customerName" className="flex items-center"><User className="mr-2 h-4 w-4 text-muted-foreground" />Customer Name</Label>
                <Input id="customerName" {...form.register('customerName')} />
                {form.formState.errors.customerName && (
                  <p className="text-sm text-destructive">{form.formState.errors.customerName.message}</p>
                )}
              </div>

              {/* Sending Location Postcode */}
              <div className="space-y-2">
                <Label htmlFor="sendingPostcode" className="flex items-center"><MapPinIcon className="mr-2 h-4 w-4 text-muted-foreground" />Sending Location Postcode</Label>
                <Input id="sendingPostcode" {...form.register('sendingPostcode')} placeholder="e.g., 6000" />
                {form.formState.errors.sendingPostcode && (
                  <p className="text-sm text-destructive">{form.formState.errors.sendingPostcode.message}</p>
                )}
              </div>

              {/* Date */}
              <div className="space-y-2">
                <Label htmlFor="date" className="flex items-center"><CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />Effective Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !form.watch('date') && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.watch('date') ? format(form.watch('date') as Date, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={form.watch('date')}
                      onSelect={(date) => form.setValue('date', date || new Date(), { shouldValidate: true })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {form.formState.errors.date && (
                  <p className="text-sm text-destructive">{form.formState.errors.date.message}</p>
                )}
              </div>

              {/* Spend Band Selection */}
              <div className="space-y-2">
                <Label htmlFor="spendBandExport" className="flex items-center"><DollarSign className="mr-2 h-4 w-4 text-muted-foreground" />Spend Band</Label>
                <Select
                    defaultValue={form.getValues("spendBand")}
                    onValueChange={(value) => form.setValue('spendBand', value, { shouldValidate: true })}
                >
                  <SelectTrigger id="spendBandExport" className="w-full">
                    <SelectValue placeholder="Select Spend Band" />
                  </SelectTrigger>
                  <SelectContent>
                    {globalSpendBands.map(band => (
                      <SelectItem key={band} value={band}>Spend Band {band}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.spendBand && (
                  <p className="text-sm text-destructive">{form.formState.errors.spendBand.message}</p>
                )}
              </div>
            </div>
            
            {/* Services Required */}
            <div className="space-y-3">
              <Label className="font-semibold text-md">Services Required</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4 border rounded-md max-h-60 overflow-y-auto">
                {ALL_SERVICES.map((service) => (
                  <div key={service} className="flex items-center space-x-2">
                    <Checkbox
                      id={`service-${service}`}
                      checked={(form.watch('services') || []).includes(service)}
                      onCheckedChange={(checked) => {
                        const currentServices = form.getValues('services') || [];
                        const newServices = checked
                          ? [...currentServices, service]
                          : currentServices.filter((s) => s !== service);
                        form.setValue('services', newServices, { shouldValidate: true });
                      }}
                    />
                    <Label htmlFor={`service-${service}`} className="text-sm font-normal cursor-pointer">
                      {service}
                    </Label>
                  </div>
                ))}
              </div>
              {form.formState.errors.services && (
                <p className="text-sm text-destructive">{form.formState.errors.services.message}</p>
              )}
            </div>

            <Button 
                type="submit" 
                className="w-full md:w-auto bg-accent hover:bg-accent/90 text-accent-foreground" 
                disabled={isLoading || postcodesLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing Download...
                </>
              ) : postcodesLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading Postcode Data...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" /> Download Placeholder Export
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

       <Card className="mt-8">
        <CardContent className="pt-6 text-center text-muted-foreground">
            <p>Click "Download Placeholder Export" to generate a CSV file with the selected criteria. All rate values are currently placeholders. For more detailed rate card generation, please use the "Rate Card" page.</p>
        </CardContent>
       </Card>
    </div>
  );
}

    
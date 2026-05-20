"use client";

import React, { useState, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { FreightFormValues, PostcodeData, CalculatedPriceItem, ServiceName, FreightItem, StateAbbreviation, RateFileType, RateData } from '@/lib/types';
import { freightFormSchema } from '@/lib/zodSchemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { MapPin, Package, Loader2, Info, Zap, Trash2, PlusCircle, Tag, Printer, Send } from 'lucide-react';
import LocationAutocomplete from '@/components/freight/LocationAutocomplete';
import { useSettings } from '@/context/SettingsContext';
import { useRateOverrides } from '@/context/RateOverrideContext';
import { calculateAllFreightPrices, calculateChargeableWeight as standardCalculateChargeableWeight } from '@/lib/freightCalculations';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/firebase';

// A new, specialized calculation function for this page
const calculateWholesaleFreightPrice = async (
    formData: FreightFormValues,
    serviceSettings: any,
    surchargeDefinitions: any,
    getRateFile: (type: RateFileType) => RateData | undefined,
    pezoneData: any
): Promise<CalculatedPriceItem | null> => {
    
    // Custom chargeable weight calculation for the Wholesale page
    const calculateWholesaleChargeableWeight = (items: FreightItem[]): { chargeableWeight: number, rawCubicWeight: number, deadWeight: number, reductionApplied: boolean, reductionPercent: number } => {
        let totalDeadWeight = 0;
        let totalCubicWeight = 0;
        let reductionApplied = false;
        let reductionPercent = 0;
        const cubicFactor = 250; // Standard for B2B Priority

        items.forEach(item => {
            totalDeadWeight += (item.weight || 0) * (item.quantity || 1);
            if (!formData.globalNoCubic && item.length && item.width && item.height) {
                const cubicVolumeM3 = (item.length / 100) * (item.width / 100) * (item.height / 100) * (item.quantity || 1);
                totalCubicWeight += cubicVolumeM3 * cubicFactor;
            }
        });

        const rawCubicWeight = totalCubicWeight;
        
        // New tiered discount logic
        if (totalDeadWeight <= rawCubicWeight * 0.5) { // Dead weight is 50% or less of cubic
            totalCubicWeight *= 0.75; // Reduce cubic weight by 25%
            reductionApplied = true;
            reductionPercent = 25;
        } else if (totalDeadWeight <= rawCubicWeight * 0.7) { // Dead weight is between 50% and 70% of cubic
            totalCubicWeight *= 0.85; // Reduce cubic weight by 15%
            reductionApplied = true;
            reductionPercent = 15;
        }

        return { 
            chargeableWeight: Math.max(totalDeadWeight, totalCubicWeight),
            rawCubicWeight,
            deadWeight: totalDeadWeight,
            reductionApplied,
            reductionPercent,
        };
    };
    
    const { chargeableWeight, rawCubicWeight, deadWeight, reductionApplied, reductionPercent } = calculateWholesaleChargeableWeight(formData.items);

    // Call the main calculator but override the result
    const baseResults = await calculateAllFreightPrices({
        formData: { ...formData, selectedServices: ['B2B Priority'] }, // Only ask for B2B Prio
        allServiceSettings: serviceSettings,
        allSurchargeDefinitions: surchargeDefinitions,
        getRateFile,
        pezoneData
    });

    const b2bResult = baseResults.find(r => r.serviceName === 'B2B Priority');

    if (!b2bResult || !b2bResult.isApplicable) {
        return b2bResult || null;
    }
    
    // --- APPLY OVERRIDES ---
    const fixedBasicRate = 50.00;
    const rateEntry = b2bResult.rateEntryUsed;
    const kiloRate = rateEntry ? Number(rateEntry['K4']) : 0; // K4 for Spend Band 4
    
    b2bResult.chargeableWeight = chargeableWeight; // Use our custom chargeable weight
    
    // Recalculate base freight with overrides
    const newBaseFreight = fixedBasicRate + (kiloRate * chargeableWeight);
    b2bResult.baseRate = newBaseFreight;
    let formula = `(Fixed Basic: $50.00 + (K4: ${kiloRate.toFixed(4)} * Custom CW: ${chargeableWeight.toFixed(2)}))`;
    if(reductionApplied){
      formula += ` | Cubic Wt reduced by ${reductionPercent}% (from ${rawCubicWeight.toFixed(2)}kg) because Dead Wt (${deadWeight.toFixed(2)}kg) <= ${reductionPercent === 25 ? '50%' : '70%'} of Raw Cubic Wt.`;
    }
    b2bResult.calculationFormula = formula;

    // Filter out oversized/manual handling surcharges
    const oversizedSurchargeIds = ['manual_handling_gt35kg', 'oversize_item_fee', 'manual_handling_gt30kg', 'item_specific_handling_oversize_total'];
    b2bResult.otherSurcharges = b2bResult.otherSurcharges.filter(s => !oversizedSurchargeIds.includes(s.id));

    // Recalculate surcharges based on the new base freight
    const fuelSurchargeAmount = newBaseFreight * (b2bResult.fuelSurchargePercentApplied! / 100);
    b2bResult.fuelSurchargeAmount = fuelSurchargeAmount;

    let otherSurchargesTotal = 0;
    b2bResult.otherSurcharges.forEach(surcharge => {
        // Recalculate security surcharge as it depends on base + fuel
        if (surcharge.id === 'security' || surcharge.id === 'manual_security') {
            const securityAmount = (newBaseFreight + fuelSurchargeAmount) * (b2bResult.securitySurchargePercentApplied! / 100);
            surcharge.amount = securityAmount;
        }
        otherSurchargesTotal += surcharge.amount;
    });

    b2bResult.totalSurcharges = fuelSurchargeAmount + otherSurchargesTotal;
    
    // Recalculate final price
    const subTotal = newBaseFreight + b2bResult.totalSurcharges + (b2bResult.totalExtrasAmount || 0);
    b2bResult.subTotalBeforeGST = subTotal;
    b2bResult.finalPrice = subTotal; // Assuming no GST for now as in original form

    return b2bResult;
};

// New function for the Friday rate
const calculateFridayRate = async (
    formData: FreightFormValues,
    serviceSettings: any,
    surchargeDefinitions: any,
    getRateFile: (type: any) => any,
    pezoneData: any
): Promise<CalculatedPriceItem | null> => {
    // Standard chargeable weight, no special rule
    const chargeableWeight = standardCalculateChargeableWeight(formData.items, 250, formData.globalNoCubic);

    const baseResults = await calculateAllFreightPrices({
        formData: { ...formData, selectedServices: ['B2B Priority'] },
        allServiceSettings: serviceSettings,
        allSurchargeDefinitions: surchargeDefinitions,
        getRateFile,
        pezoneData
    });
    
    const b2bResult = baseResults.find(r => r.serviceName === 'B2B Priority');

    if (!b2bResult || !b2bResult.isApplicable) {
        return b2bResult || null;
    }

    // Apply Friday Rate logic
    const fixedBasicRate = 50.00;
    const rateEntry = b2bResult.rateEntryUsed;
    const kiloRate = rateEntry ? Number(rateEntry['K4']) : 0;
    
    b2bResult.chargeableWeight = chargeableWeight; // Use standard CW

    const newBaseFreight = fixedBasicRate + (kiloRate * chargeableWeight);
    b2bResult.baseRate = newBaseFreight;
    b2bResult.calculationFormula = `(Fixed Basic: $50.00 + (K4: ${kiloRate.toFixed(4)} * Std CW: ${chargeableWeight.toFixed(2)}))`;
    
    const oversizedSurchargeIds = ['manual_handling_gt35kg', 'oversize_item_fee', 'manual_handling_gt30kg', 'item_specific_handling_oversize_total'];
    b2bResult.otherSurcharges = b2bResult.otherSurcharges.filter(s => !oversizedSurchargeIds.includes(s.id));
    
    const fuelSurchargeAmount = newBaseFreight * (b2bResult.fuelSurchargePercentApplied! / 100);
    b2bResult.fuelSurchargeAmount = fuelSurchargeAmount;

    let otherSurchargesTotal = 0;
    b2bResult.otherSurcharges.forEach(surcharge => {
        if (surcharge.id === 'security' || surcharge.id === 'manual_security') {
            const securityAmount = (newBaseFreight + fuelSurchargeAmount) * (b2bResult.securitySurchargePercentApplied! / 100);
            surcharge.amount = securityAmount;
        }
        otherSurchargesTotal += surcharge.amount;
    });

    b2bResult.totalSurcharges = fuelSurchargeAmount + otherSurchargesTotal;
    
    const subTotal = newBaseFreight + b2bResult.totalSurcharges + (b2bResult.totalExtrasAmount || 0);
    
    // Apply 60% discount
    const finalPrice = subTotal * 0.40;
    b2bResult.subTotalBeforeGST = subTotal;
    b2bResult.finalPrice = finalPrice;
    b2bResult.remarks.push(`60% Friday Discount Applied to subtotal of ${subTotal.toFixed(2)}`);

    return b2bResult;
};

export default function WholesalePageContent() {
  const { actualRole } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [calculatedResult, setCalculatedResult] = useState<CalculatedPriceItem | null>(null);
  const [calculatedFridayResult, setCalculatedFridayResult] = useState<CalculatedPriceItem | null>(null);
  const { serviceSettings, surchargeDefinitions, stateEmailContacts } = useSettings();
  const { getRateFile, pezoneData, isLoading: isLoadingRates } = useRateOverrides();
  const { toast } = useToast();

  const resultsRef = useRef<HTMLDivElement>(null);
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);

  const form = useForm<FreightFormValues>({
    resolver: zodResolver(freightFormSchema),
    defaultValues: {
      spendBand: "4", // Hardcoded
      originQuery: '',
      originLocation: null,
      destinationQuery: '',
      destinationLocation: null,
      items: [{ weight: 0, length: 0, width: 0, height: 0, quantity: 1 }],
      globalNoCubic: false,
      globalOnPallet: false,
      selectedServices: ['B2B Priority'], // Hardcoded
      applyGST: false,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const { setValue, handleSubmit } = form;

  const onSubmit = async (data: FreightFormValues) => {
    setIsLoading(true);
    setShowResults(false);
    setCalculatedFridayResult(null);
    
    const result = await calculateWholesaleFreightPrice(
        { ...data, spendBand: '4' },
        serviceSettings,
        surchargeDefinitions,
        getRateFile,
        pezoneData
    );

    setCalculatedResult(result);
    
    // Check for Friday Rate
    const originPrio = data.originLocation?.prio;
    const destPrio = data.destinationLocation?.prio;
    if (originPrio === 'PER' && (destPrio === 'MEL' || destPrio === 'ADL')) {
        const fridayResult = await calculateFridayRate(
            { ...data, spendBand: '4' },
            serviceSettings,
            surchargeDefinitions,
            getRateFile,
            pezoneData
        );
        setCalculatedFridayResult(fridayResult);
    }

    setIsLoading(false);
    setShowResults(true);
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };
  
  const handleOriginSelect = (location: PostcodeData | null) => {
    setValue('originLocation', location, { shouldValidate: true });
    setValue('originQuery', location ? `${location.suburb} ${location.state} ${location.postcode}` : '');
  };

  const handleDestinationSelect = (location: PostcodeData | null) => {
    setValue('destinationLocation', location, { shouldValidate: true });
    setValue('destinationQuery', location ? `${location.suburb} ${location.state} ${location.postcode}` : '');
  };
  
  const handlePrint = () => {
    window.print();
  };

  const handleEmailSubmission = () => {
    const formData = form.getValues();
    const originState = formData.originLocation?.state as StateAbbreviation;
    const destState = formData.destinationLocation?.state as StateAbbreviation;

    if (!originState || !destState) {
        toast({ title: "Error", description: "Origin or destination state is missing.", variant: "destructive" });
        return;
    }

    const originEmails = stateEmailContacts[originState]?.filter(e => e) || [];
    const destEmails = stateEmailContacts[destState]?.filter(e => e) || [];
    const allEmails = [...new Set([...originEmails, ...destEmails])];

    if (allEmails.length === 0) {
        toast({ title: "No Contacts", description: "No email contacts configured in Settings for the origin or destination state.", variant: "destructive" });
        return;
    }
    
    const subject = `New Sameday & Bulk Freight Booking: ${formData.originQuery} to ${formData.destinationQuery}`;
    let body = "A new Sameday & Bulk freight movement has been submitted for actioning.\n\n";
    body += "---CONSIGNMENT DETAILS---\n";
    body += `Origin: ${formData.originQuery}\n`;
    body += `Destination: ${formData.destinationQuery}\n`;
    body += `Service: B2B Priority (Sameday & Bulk Rate)\n\n`;
    
    body += "---ITEMS---\n";
    formData.items.forEach((item, i) => {
        body += `Item ${i+1}: ${item.quantity} x ${item.weight}kg (${item.length}L x ${item.width}W x ${item.height}H cm)\n`;
    });
    body += "\n";

    body += "---PRICING---\n";
    if (calculatedResult) {
        body += `Sameday & Bulk Rate Price (ex GST): ${new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(calculatedResult.finalPrice ?? 0)}\n`;
        body += `Chargeable Weight: ${calculatedResult.chargeableWeight.toFixed(2)} kg\n`;
    }
    if (calculatedFridayResult) {
        body += `FRIDAY Sameday & Bulk Rate Price (ex GST): ${new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(calculatedFridayResult.finalPrice ?? 0)}\n`;
    }
    body += "\n---END---\n";

    const mailtoLink = `mailto:${allEmails.join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;
    setIsSubmitDialogOpen(false);
  };

  if (actualRole !== 'superadmin') {
    return <div className="p-20 text-center">Unauthorized.</div>;
  }

  const overallLoading = isLoading || isLoadingRates;

  return (
    <Card className="w-full shadow-xl print-expand">
      <CardHeader>
        <CardTitle className="flex items-center text-2xl font-headline">
          <Zap className="mr-2 h-7 w-7 text-primary" />
          Sameday & Bulk B2B Priority Calculator
        </CardTitle>
        <CardDescription>
            Specialized calculator for B2B Priority on Spend Band 4, using a fixed $50 basic rate and a unique cubic weight rule. Also shows a special Friday rate for PER to MEL/ADL routes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="print-hide">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
              <div className="space-y-2">
                <Label htmlFor="originQueryFreightForm" className="flex items-center font-semibold">
                  <MapPin className="mr-2 h-5 w-5 text-muted-foreground" /> Origin
                </Label>
                <LocationAutocomplete inputId="originQueryFreightForm" value={form.watch('originQuery')} onValueChange={(v) => setValue('originQuery', v)} onLocationSelect={handleOriginSelect} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="destinationQueryFreightForm" className="flex items-center font-semibold">
                  <MapPin className="mr-2 h-5 w-5 text-muted-foreground" /> Destination
                </Label>
                <LocationAutocomplete inputId="destinationQueryFreightForm" value={form.watch('destinationQuery')} onValueChange={(v) => setValue('destinationQuery', v)} onLocationSelect={handleDestinationSelect} />
              </div>
            </div>
              
            <Separator />

            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center"><Package className="mr-2 h-5 w-5 text-muted-foreground" /> Item Details</h3>
              {fields.map((item, index) => (
                  <Card key={item.id} className="mb-4 p-4 border rounded-lg shadow-sm bg-muted/20">
                      <div className="grid grid-cols-1 gap-y-2 gap-x-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 items-end">
                          <div className="space-y-1 flex-grow col-span-1"><Label>Weight (kg)</Label><Input type="number" {...form.register(`items.${index}.weight`)} /></div>
                          <div className="space-y-1 flex-grow col-span-1"><Label>L (cm)</Label><Input type="number" {...form.register(`items.${index}.length`)} /></div>
                          <div className="space-y-1 flex-grow col-span-1"><Label>W (cm)</Label><Input type="number" {...form.register(`items.${index}.width`)} /></div>
                          <div className="space-y-1 flex-grow col-span-1"><Label>H (cm)</Label><Input type="number" {...form.register(`items.${index}.height`)} /></div>
                          <div className="space-y-1 flex-grow col-span-1"><Label>Quantity</Label><Input type="number" {...form.register(`items.${index}.quantity`)} /></div>
                      </div>
                      {fields.length > 1 && (<div className="mt-2"><Button type="button" variant="destructive" size="sm" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button></div>)}
                  </Card>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => append({ weight: 0, length: 0, width: 0, height: 0, quantity: 1 })}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </div>
            
            <div className="flex flex-wrap gap-2">
                <Button type="submit" className="text-lg py-3 px-6 bg-accent hover:bg-accent/90 text-accent-foreground flex-grow md:flex-grow-0" disabled={overallLoading}>
                  {overallLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Calculating...</>) : 'Calculate Sameday & Bulk Rate'}
                </Button>
                <Button onClick={handlePrint} variant="outline" className="flex-grow md:flex-grow-0" type="button" disabled={!showResults || (!calculatedResult && !calculatedFridayResult)}>
                    <Printer className="mr-2 h-4 w-4" /> Print Quote
                </Button>
                <Button onClick={() => setIsSubmitDialogOpen(true)} variant="default" className="flex-grow md:flex-grow-0" type="button" disabled={!showResults || !calculatedResult}>
                    <Send className="mr-2 h-4 w-4" /> Submit Quote
                </Button>
            </div>
          </form>
        </div>

        <div ref={resultsRef} className="mt-8 space-y-6">
            {showResults && calculatedResult && (
                 <Card className="card-print">
                    <CardHeader>
                        <CardTitle className="flex items-center text-xl font-semibold"><Package className="mr-2"/>B2B Priority Sameday & Bulk Result</CardTitle>
                        <CardDescription>Final price calculated with a fixed $50 basic rate and special cubic logic.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {calculatedResult.isApplicable ? (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center text-3xl font-bold text-primary">
                                    <span>Total Price (ex GST):</span>
                                    <span>{new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(calculatedResult.finalPrice ?? 0)}</span>
                                </div>
                                <Separator />
                                <div className="text-sm space-y-2">
                                    <div className="flex justify-between">
                                        <strong>Chargeable Weight:</strong>
                                        <span className="font-mono">{calculatedResult.chargeableWeight.toFixed(2)} kg</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <strong>Base Rate:</strong>
                                        <span className="font-mono">{new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(calculatedResult.baseRate ?? 0)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <strong>Fuel Surcharge:</strong>
                                        <span className="font-mono">{new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(calculatedResult.fuelSurchargeAmount)}</span>
                                    </div>
                                    {calculatedResult.otherSurcharges.map((surcharge) => (
                                        <div key={surcharge.id} className="flex justify-between">
                                            <strong>{surcharge.name}:</strong>
                                            <span className="font-mono">{new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(surcharge.amount)}</span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between text-muted-foreground">
                                        <strong>Total Surcharges:</strong>
                                        <span className="font-mono">{new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(calculatedResult.totalSurcharges)}</span>
                                    </div>
                                </div>
                                <Separator />
                                 <p className="text-xs italic text-muted-foreground pt-2">
                                    <strong>Calculation Logic:</strong> {calculatedResult.calculationFormula}
                                </p>
                            </div>
                        ) : (
                             <div className="text-destructive text-center p-4">
                                 <Info className="mx-auto h-8 w-8 mb-2" />
                                 <p className="font-semibold">Rate Not Applicable</p>
                                 <p className="text-sm">{calculatedResult.remarks.join(', ')}</p>
                             </div>
                        )}
                    </CardContent>
                 </Card>
            )}
            {showResults && calculatedFridayResult && (
                 <Card className="border-accent card-print">
                    <CardHeader>
                        <CardTitle className="flex items-center text-xl font-semibold text-accent"><Tag className="mr-2"/>B2B Priority FRIDAY Rate</CardTitle>
                        <CardDescription>Special discounted rate for PER &gt; MEL/ADL routes. Uses standard chargeable weight and a 60% discount on the total price.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {calculatedFridayResult.isApplicable ? (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center text-3xl font-bold text-accent">
                                    <span>Total Price (ex GST):</span>
                                    <span>{new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(calculatedFridayResult.finalPrice ?? 0)}</span>
                                </div>
                                <div className="flex justify-between items-center text-muted-foreground line-through">
                                    <span>Pre-Discount Price:</span>
                                    <span>{new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(calculatedFridayResult.subTotalBeforeGST ?? 0)}</span>
                                </div>
                                <Separator />
                                <div className="text-sm space-y-2">
                                    <div className="flex justify-between">
                                        <strong>Chargeable Weight:</strong>
                                        <span className="font-mono">{calculatedFridayResult.chargeableWeight.toFixed(2)} kg</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <strong>Base Rate:</strong>
                                        <span className="font-mono">{new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(calculatedFridayResult.baseRate ?? 0)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <strong>Fuel Surcharge:</strong>
                                        <span className="font-mono">{new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(calculatedFridayResult.fuelSurchargeAmount)}</span>
                                    </div>
                                    {calculatedFridayResult.otherSurcharges.map((surcharge) => (
                                        <div key={surcharge.id} className="flex justify-between">
                                            <strong>{surcharge.name}:</strong>
                                            <span className="font-mono">{new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(surcharge.amount)}</span>
                                        </div>
                                    ))}
                                </div>
                                <Separator />
                                 <p className="text-xs italic text-muted-foreground pt-2">
                                    <strong>Calculation Logic:</strong> {calculatedFridayResult.calculationFormula}
                                </p>
                            </div>
                        ) : (
                             <div className="text-destructive text-center p-4">
                                <Info className="mx-auto h-8 w-8 mb-2" />
                                <p className="font-semibold">Friday Rate Not Applicable</p>
                                <p className="text-sm">{calculatedFridayResult.remarks.join(', ')}</p>
                            </div>
                        )}
                    </CardContent>
                 </Card>
            )}
             {showResults && !calculatedResult && (
                 <Card className="mt-8"><CardContent className="pt-6 text-center text-muted-foreground">Calculation failed or no applicable rate was found.</CardContent></Card>
             )}
        </div>
      </CardContent>
       <Dialog open={isSubmitDialogOpen} onOpenChange={setIsSubmitDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Confirm Quote Submission</DialogTitle>
                    <DialogDescription>
                        This will prepare an email to the configured contacts for the origin and destination states. Please review the details before sending.
                    </DialogDescription>
                </DialogHeader>
                <div className="text-sm">
                    <p><strong>Origin:</strong> {form.getValues('originQuery')}</p>
                    <p><strong>Destination:</strong> {form.getValues('destinationQuery')}</p>
                    <p><strong>Main Rate:</strong> {new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(calculatedResult?.finalPrice ?? 0)}</p>
                    {calculatedFridayResult && <p><strong>Friday Rate:</strong> {new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(calculatedFridayResult.finalPrice ?? 0)}</p>}
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleEmailSubmission}><Send className="mr-2 h-4 w-4"/>Send Email</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </Card>
  );
}

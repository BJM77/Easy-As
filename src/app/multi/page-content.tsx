"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { PostcodeData, ServiceName, FreightItem, SBComparisonResult, SpendBandPriceEntry, CalculatedPriceItem, AdditionalPercentageType, FreightFormValues } from '@/lib/types';
import { ALL_SERVICES, getAllowedServices } from '@/lib/types';
import { multiFreightFormSchema } from '@/lib/zodSchemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { MapPin, Package, Loader2, Info, Route, GitMerge, ArrowRight, DollarSign, Check, X, GitCommitHorizontal, GitBranch } from 'lucide-react';
import LocationAutocomplete from '@/components/freight/LocationAutocomplete';
import { Checkbox } from '@/components/ui/checkbox';
import { useSettings } from '@/context/SettingsContext';
import { calculateAllFreightPrices } from '@/lib/freightCalculations';
import { useRateOverrides } from '@/context/RateOverrideContext';
import { useAuth } from '@/firebase';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from '@/hooks/use-toast';

interface MultiLegDisplayResult {
  serviceName: ServiceName;
  directPrice: number | null;
  // Route 1
  leg1aPrice: number | null;
  leg1bPrice: number | null;
  multiLeg1Total: number | null;
  savings1: number | null;
  // Route 2
  leg2aPrice: number | null;
  leg2bPrice: number | null;
  multiLeg2Total: number | null;
  savings2: number | null;
  remarks: string[];
  isApplicable1: boolean;
  isApplicable2: boolean;
}

type MultiFreightFormValues = z.infer<typeof multiFreightFormSchema>;

const formatCurrency = (amount: number | null) => {
  if (amount === null || isNaN(amount)) return "N/A";
  return amount.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });
};

export default function MultiPageContent() {
    const [isLoading, setIsLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [results, setResults] = useState<MultiLegDisplayResult[]>([]);
    const { globalSpendBands, serviceSettings, surchargeDefinitions, servicePermissions } = useSettings();
    const { role } = useAuth();
    const { toast } = useToast();
    const { getRateFile, pezoneData, isLoading: isLoadingRates } = useRateOverrides();

    const allowedServices = useMemo(() => getAllowedServices(role, servicePermissions), [role, servicePermissions]);

    const form = useForm<MultiFreightFormValues>({
        resolver: zodResolver(multiFreightFormSchema),
        defaultValues: {
            spendBand: globalSpendBands[0] || "1",
            originLocation: null,
            via1Location: null,
            via2Location: null,
            destinationLocation: null,
            items: [{ weight: 0, quantity: 1 }],
            selectedServices: [],
            globalNoCubic: false,
            globalOnPallet: false,
            additionalPercentageType: 'none',
            applyGST: false,
        }
    });

    const { fields, append, remove, replace } = useFieldArray({
      control: form.control,
      name: "items",
    });

    const { watch, getValues, setValue, formState, handleSubmit } = form;

    useEffect(() => {
        if (allowedServices && allowedServices.length > 0) {
            setValue('selectedServices', allowedServices, { shouldValidate: true });
        }
    }, [allowedServices, setValue]);

    const onSubmit = async (data: MultiFreightFormValues) => {
        setIsLoading(true);
        setShowResults(false);

        const baseFormData: Omit<FreightFormValues, 'originLocation'|'destinationLocation'|'originQuery'|'destinationQuery'> = {
            ...data,
            enableOtherRate: false,
        };

        const directFormData: FreightFormValues = { ...baseFormData, originLocation: data.originLocation, destinationLocation: data.destinationLocation, originQuery: data.originQuery, destinationQuery: data.destinationQuery };
        const leg1aFormData: FreightFormValues = { ...baseFormData, originLocation: data.originLocation, destinationLocation: data.via1Location, originQuery: data.originQuery, destinationQuery: data.via1Query };
        const leg1bFormData: FreightFormValues = { ...baseFormData, originLocation: data.via1Location, destinationLocation: data.destinationLocation, originQuery: data.via1Query, destinationQuery: data.destinationQuery };
        
        const hasVia2 = data.via2Location && data.via2Query;
        const leg2aFormData: FreightFormValues | null = hasVia2 ? { ...baseFormData, originLocation: data.originLocation, destinationLocation: data.via2Location, originQuery: data.originQuery, destinationQuery: data.via2Query } : null;
        const leg2bFormData: FreightFormValues | null = hasVia2 ? { ...baseFormData, originLocation: data.via2Location, destinationLocation: data.destinationLocation, originQuery: data.via2Query, destinationQuery: data.destinationQuery } : null;
        
        try {
            const calculationPromises = [
                calculateAllFreightPrices({ formData: directFormData, allServiceSettings: serviceSettings, allSurchargeDefinitions: surchargeDefinitions, getRateFile, pezoneData }),
                calculateAllFreightPrices({ formData: leg1aFormData, allServiceSettings: serviceSettings, allSurchargeDefinitions: surchargeDefinitions, getRateFile, pezoneData }),
                calculateAllFreightPrices({ formData: leg1bFormData, allServiceSettings: serviceSettings, allSurchargeDefinitions: surchargeDefinitions, getRateFile, pezoneData }),
            ];
            
            if (leg2aFormData && leg2bFormData) {
                calculationPromises.push(calculateAllFreightPrices({ formData: leg2aFormData, allServiceSettings: serviceSettings, allSurchargeDefinitions: surchargeDefinitions, getRateFile, pezoneData }));
                calculationPromises.push(calculateAllFreightPrices({ formData: leg2bFormData, allServiceSettings: serviceSettings, allSurchargeDefinitions: surchargeDefinitions, getRateFile, pezoneData }));
            }
            
            const [directResults, leg1aResults, leg1bResults, leg2aResults, leg2bResults] = await Promise.all(calculationPromises);

            const combinedResults: MultiLegDisplayResult[] = [];
            const servicesToDisplay = Array.from(new Set(data.selectedServices));

            for (const serviceName of servicesToDisplay) {
                const direct = directResults.find(r => r.serviceName === serviceName);
                const directPrice = direct?.finalPrice ?? null;
                
                const leg1a = leg1aResults.find(r => r.serviceName === serviceName);
                const leg1b = leg1bResults.find(r => r.serviceName === serviceName);
                const isApplicable1 = !!(leg1a?.isApplicable && leg1b?.isApplicable);
                const leg1aPrice = leg1a?.finalPrice ?? null;
                const leg1bPrice = leg1b?.finalPrice ?? null;
                const multiLeg1Total = (leg1aPrice !== null && leg1bPrice !== null) ? leg1aPrice + leg1bPrice : null;
                const savings1 = (directPrice !== null && multiLeg1Total !== null) ? directPrice - multiLeg1Total : null;

                let leg2aPrice = null, leg2bPrice = null, multiLeg2Total = null, savings2 = null, isApplicable2 = false;
                if(leg2aResults && leg2bResults) {
                    const leg2a = leg2aResults.find(r => r.serviceName === serviceName);
                    const leg2b = leg2bResults.find(r => r.serviceName === serviceName);
                    isApplicable2 = !!(leg2a?.isApplicable && leg2b?.isApplicable);
                    leg2aPrice = leg2a?.finalPrice ?? null;
                    leg2bPrice = leg2b?.finalPrice ?? null;
                    multiLeg2Total = (leg2aPrice !== null && leg2bPrice !== null) ? leg2aPrice + leg2bPrice : null;
                    savings2 = (directPrice !== null && multiLeg2Total !== null) ? directPrice - multiLeg2Total : null;
                }

                const remarks = [
                    ...((!leg1a?.isApplicable && leg1a?.remarks.length) ? leg1a.remarks.map(r => `Hub 1 (Leg 1): ${r}`) : []),
                    ...((!leg1b?.isApplicable && leg1b?.remarks.length) ? leg1b.remarks.map(r => `Hub 1 (Leg 2): ${r}`) : []),
                ];
                if (!direct?.isApplicable && direct?.remarks.length) {
                    remarks.push(`Direct Leg: ${direct.remarks.join(', ')}`);
                }
                
                if (remarks.length === 0 && !isApplicable1) {
                    remarks.push("One or more legs are not applicable for this service.");
                }

                combinedResults.push({ serviceName, directPrice, leg1aPrice, leg1bPrice, multiLeg1Total, savings1, isApplicable1, leg2aPrice, leg2bPrice, multiLeg2Total, savings2, isApplicable2, remarks });
            }

            setResults(combinedResults.sort((a, b) => (a.multiLeg1Total ?? Infinity) - (b.multiLeg1Total ?? Infinity)));
        } catch (error) {
            console.error("Error during multi-leg calculation: ", error);
            toast({ title: "Calculation Error", description: "An unexpected error occurred during calculation.", variant: "destructive" });
        } finally {
            setIsLoading(false);
            setShowResults(true);
        }
    };

    const overallLoading = isLoading || isLoadingRates;

    return (
        <div className="space-y-8">
            <Card className="shadow-xl">
                <CardHeader>
                    <CardTitle className="flex items-center text-2xl font-headline">
                        <Route className="mr-2 h-7 w-7 text-primary" /> Multi-Leg Calculator
                    </CardTitle>
                    <CardDescription>Compare a direct route price against up to two different multi-leg routes via hubs.</CardDescription>
                </CardHeader>
            </Card>

            <Card>
                <CardContent className="pt-6">
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
                             <div className="space-y-2">
                                <Label htmlFor="spendBand" className="font-semibold">Spend Band</Label>
                                <Controller name="spendBand" control={form.control} render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{globalSpendBands.map(b => <SelectItem key={b} value={b}>Spend Band {b}</SelectItem>)}</SelectContent></Select>
                                )} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="originQuery" className="font-semibold flex items-center"><MapPin className="mr-2 h-4 w-4" />Origin</Label>
                                <LocationAutocomplete inputId="originQuery" value={watch('originQuery')} onValueChange={v => setValue('originQuery', v)} onLocationSelect={l => setValue('originLocation', l, { shouldValidate: true })} />
                                {formState.errors.originLocation && <p className="text-sm text-destructive">{formState.errors.originLocation.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="destinationQuery" className="font-semibold flex items-center"><MapPin className="mr-2 h-4 w-4" />Destination</Label>
                                <LocationAutocomplete inputId="destinationQuery" value={watch('destinationQuery')} onValueChange={v => setValue('destinationQuery', v)} onLocationSelect={l => setValue('destinationLocation', l, { shouldValidate: true })} />
                                {formState.errors.destinationLocation && <p className="text-sm text-destructive">{formState.errors.destinationLocation.message}</p>}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                            <div className="space-y-2">
                                <Label htmlFor="via1Query" className="font-semibold flex items-center"><GitCommitHorizontal className="mr-2 h-4 w-4" />Via Hub 1 (Required)</Label>
                                <LocationAutocomplete inputId="via1Query" value={watch('via1Query')} onValueChange={v => setValue('via1Query', v)} onLocationSelect={l => setValue('via1Location', l, { shouldValidate: true })} />
                                {formState.errors.via1Location && <p className="text-sm text-destructive">{formState.errors.via1Location.message}</p>}
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="via2Query" className="font-semibold flex items-center"><GitBranch className="mr-2 h-4 w-4" />Via Hub 2 (Optional)</Label>
                                <LocationAutocomplete inputId="via2Query" value={watch('via2Query') || ''} onValueChange={v => setValue('via2Query', v)} onLocationSelect={l => setValue('via2Location', l, { shouldValidate: true })} />
                                {formState.errors.via2Location && <p className="text-sm text-destructive">{formState.errors.via2Location.message}</p>}
                            </div>
                        </div>

                        <Separator />

                        <div>
                          <h3 className="text-lg font-semibold mb-3 flex items-center"><Package className="mr-2 h-5 w-5 text-muted-foreground" /> Item Details</h3>
                          {fields.map((item, index) => (
                            <Card key={item.id} className="mb-4 p-4 border rounded-lg bg-muted/20">
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-2 items-end">
                                <div className="space-y-1"><Label>Weight (kg)</Label><Input type="number" {...form.register(`items.${index}.weight`)} /></div>
                                <div className="space-y-1"><Label>L (cm)</Label><Input type="number" {...form.register(`items.${index}.length`)} disabled={watch('globalNoCubic')} /></div>
                                <div className="space-y-1"><Label>W (cm)</Label><Input type="number" {...form.register(`items.${index}.width`)} disabled={watch('globalNoCubic')} /></div>
                                <div className="space-y-1"><Label>H (cm)</Label><Input type="number" {...form.register(`items.${index}.height`)} disabled={watch('globalNoCubic')} /></div>
                                <div className="space-y-1"><Label>Quantity</Label><Input type="number" {...form.register(`items.${index}.quantity`)} /></div>
                              </div>
                            </Card>
                          ))}
                           <div className="mt-4 flex space-x-2">
                             <Controller name="globalNoCubic" control={form.control} render={({ field }) => (<div className="flex items-center space-x-2"><Checkbox id="globalNoCubicMulti" checked={field.value} onCheckedChange={field.onChange} /><Label htmlFor="globalNoCubicMulti">Satchel / No Cubic</Label></div>)} />
                           </div>
                        </div>

                        <Button type="submit" className="w-full md:w-auto text-lg py-3 px-6 bg-accent hover:bg-accent/90 text-accent-foreground" disabled={overallLoading}>
                            {overallLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Calculating...</> : 'Calculate Multi-Leg'}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {showResults && (
                <Card className="mt-8">
                    <CardHeader>
                        <CardTitle>Comparison Results</CardTitle>
                        <CardDescription>
                            Direct: {watch('originQuery')} → {watch('destinationQuery')} <br />
                            Route 1: {watch('originQuery')} → {watch('via1Query')} → {watch('destinationQuery')} <br />
                            {watch('via2Query') && <>Route 2: {watch('originQuery')} → {watch('via2Query')} → {watch('destinationQuery')}</>}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Service</TableHead>
                                    <TableHead>Direct Price</TableHead>
                                    <TableHead>Route 1 Total</TableHead>
                                    <TableHead>Route 1 Savings</TableHead>
                                    {watch('via2Location') && (
                                        <>
                                            <TableHead>Route 2 Total</TableHead>
                                            <TableHead>Route 2 Savings</TableHead>
                                        </>
                                    )}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {results.map(r => (
                                    <TableRow key={r.serviceName} className={!r.isApplicable1 && !r.isApplicable2 ? 'bg-destructive/10' : ''}>
                                        <TableCell className="font-medium">{r.serviceName}</TableCell>
                                        <TableCell>{formatCurrency(r.directPrice)}</TableCell>
                                        <TableCell className={cn("font-semibold", !r.isApplicable1 && "text-muted-foreground")}>{formatCurrency(r.multiLeg1Total)}</TableCell>
                                        <TableCell className={cn(r.savings1 && r.savings1 > 0 ? 'text-green-600' : r.savings1 && r.savings1 < 0 ? 'text-destructive' : '')}>
                                            {formatCurrency(r.savings1)}
                                        </TableCell>
                                        {watch('via2Location') && (
                                            <>
                                                <TableCell className={cn("font-semibold", !r.isApplicable2 && "text-muted-foreground")}>{formatCurrency(r.multiLeg2Total)}</TableCell>
                                                <TableCell className={cn(r.savings2 && r.savings2 > 0 ? 'text-green-600' : r.savings2 && r.savings2 < 0 ? 'text-destructive' : '')}>
                                                    {formatCurrency(r.savings2)}
                                                </TableCell>
                                            </>
                                        )}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                         <div className="mt-4 space-y-1 text-xs text-muted-foreground">
                            {results.filter(r => !r.isApplicable1 && r.remarks.length > 0).map(r => (
                                <p key={`${r.serviceName}-remark`}>
                                    <strong className="text-destructive">{r.serviceName}:</strong> {r.remarks.join('. ')}
                                </p>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
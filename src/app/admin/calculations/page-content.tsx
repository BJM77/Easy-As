"use client";

import React, { useState, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { FreightFormValues, PostcodeData, CalculatedPriceItem, ServiceName, RateData, RateFileType } from '@/lib/types';
import { ALL_SERVICES } from '@/lib/types';
import { useSettings } from '@/context/SettingsContext';
import { useRateOverrides } from '@/context/RateOverrideContext';
import { calculateAllFreightPrices } from '@/lib/freightCalculations';
import { useAuth } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Calculator, MapPin, Package, Percent, DollarSign, Info, ChevronDown, ChevronUp } from 'lucide-react';
import LocationAutocomplete from '@/components/freight/LocationAutocomplete';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const auditFormSchema = z.object({
  spendBand: z.string().min(1, "Spend Band is required."),
  originQuery: z.string().min(1, "Origin is required."),
  originLocation: z.custom<PostcodeData | null>((data) => data !== null, "Valid Origin must be selected."),
  destinationQuery: z.string().min(1, "Destination is required."),
  destinationLocation: z.custom<PostcodeData | null>((data) => data !== null, "Valid Destination must be selected."),
  chargeWeight: z.coerce.number().positive("Weight must be positive."),
});

type AuditFormValues = z.infer<typeof auditFormSchema>;

const formatCurrency = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined || isNaN(amount)) return "N/A";
  return amount.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });
};

export default function CalculationsPageContent() {
  const { globalSpendBands, serviceSettings, surchargeDefinitions } = useSettings();
  const { getRateFile, pezoneData, isLoading: isLoadingRates, areOurRatesLoaded } = useRateOverrides();
  const { role } = useAuth();
  
  const [isCalculating, setIsProcessing] = useState(false);
  const [results, setResults] = useState<CalculatedPriceItem[]>([]);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const form = useForm<AuditFormValues>({
    resolver: zodResolver(auditFormSchema),
    defaultValues: {
      spendBand: areOurRatesLoaded ? "Customer Rates" : (globalSpendBands[0] || "1"),
      chargeWeight: 1,
      originQuery: '',
      originLocation: null,
      destinationQuery: '',
      destinationLocation: null,
    },
  });

  const { control, handleSubmit, setValue, watch, formState } = form;

  const toggleRow = (serviceName: string) => {
    setExpandedRows(prev => ({ ...prev, [serviceName]: !prev[serviceName] }));
  };

  const onSubmit = async (data: AuditFormValues) => {
    setIsProcessing(true);
    
    const freightFormValues: FreightFormValues = {
      spendBand: data.spendBand,
      originLocation: data.originLocation,
      destinationLocation: data.destinationLocation,
      originQuery: data.originQuery,
      destinationQuery: data.destinationQuery,
      items: [{ weight: data.chargeWeight, quantity: 1 }],
      globalNoCubic: false,
      globalOnPallet: false,
      selectedServices: ALL_SERVICES,
      additionalPercentageType: 'none',
      applyGST: true,
    };

    try {
      const calcResults = await calculateAllFreightPrices({
        formData: freightFormValues,
        allServiceSettings: serviceSettings,
        allSurchargeDefinitions: surchargeDefinitions,
        getRateFile,
        pezoneData
      });
      setResults(calcResults);
    } catch (error) {
      console.error("Calculation failed:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (role && !['admin', 'superadmin'].includes(role)) {
    return <Card className="m-8"><CardContent className="pt-6">Unauthorized access.</CardContent></Card>;
  }

  return (
    <div className="space-y-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <Calculator className="mr-2 h-7 w-7 text-primary" /> Service Calculations Auditor
          </CardTitle>
          <CardDescription>
            Input freight details to view the step-by-step mathematical breakdown for every service simultaneously. 
            Use this to verify rate lookups and surcharge logic.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Audit Inputs</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-1">
              <Label>Spend Band</Label>
              <Controller
                name="spendBand"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {areOurRatesLoaded && <SelectItem value="Customer Rates">Customer Rates</SelectItem>}
                      {globalSpendBands.map(sb => <SelectItem key={sb} value={sb}>SB {sb}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1">
              <Label>Origin</Label>
              <LocationAutocomplete 
                inputId="audit-origin" 
                value={watch('originQuery')}
                onValueChange={(val) => setValue('originQuery', val, { shouldValidate: true })}
                onLocationSelect={(loc) => setValue('originLocation', loc, { shouldValidate: true })}
                placeholder="Search origin..."
              />
              {formState.errors.originLocation && <p className="text-[10px] text-destructive">{formState.errors.originLocation.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Destination</Label>
              <LocationAutocomplete 
                inputId="audit-dest" 
                value={watch('destinationQuery')}
                onValueChange={(val) => setValue('destinationQuery', val, { shouldValidate: true })}
                onLocationSelect={(loc) => setValue('destinationLocation', loc, { shouldValidate: true })}
                placeholder="Search destination..."
              />
              {formState.errors.destinationLocation && <p className="text-[10px] text-destructive">{formState.errors.destinationLocation.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Sample Weight (kg)</Label>
              <Input type="number" {...form.register('chargeWeight')} />
            </div>
            <Button type="submit" className="md:col-start-4 w-full" disabled={isCalculating || isLoadingRates}>
              {isCalculating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
              Audit All Calculations
            </Button>
          </form>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Calculation Audit Results</CardTitle>
            <CardDescription>
              Showing logic for <strong>{form.getValues('chargeWeight')}kg</strong> from <strong>{form.getValues('originLocation')?.suburb}</strong> to <strong>{form.getValues('destinationLocation')?.suburb}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Lookup Key</TableHead>
                  <TableHead className="text-right">Base Rate</TableHead>
                  <TableHead className="text-right">Surcharges</TableHead>
                  <TableHead className="text-right">Markup</TableHead>
                  <TableHead className="text-right">GST</TableHead>
                  <TableHead className="text-right font-bold">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result) => (
                  <React.Fragment key={result.serviceName}>
                    <TableRow 
                      className={cn(
                        "cursor-pointer hover:bg-muted/50",
                        !result.isApplicable && "opacity-50 grayscale"
                      )}
                      onClick={() => toggleRow(result.serviceName)}
                    >
                      <TableCell>
                        {expandedRows[result.serviceName] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {result.serviceName}
                        {!result.isApplicable && <Badge variant="destructive" className="ml-2 h-4 text-[8px]">FAILED</Badge>}
                      </TableCell>
                      <TableCell className="font-mono text-[10px] text-muted-foreground">{result.chargeZoneUsed}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(result.baseRate)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(result.totalSurcharges)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(result.additionalMarkupAmount)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(result.gstAmount)}</TableCell>
                      <TableCell className="text-right font-bold font-mono text-primary">{formatCurrency(result.finalPrice)}</TableCell>
                    </TableRow>
                    {expandedRows[result.serviceName] && (
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={8} className="p-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                            <div className="space-y-2 border-r pr-6">
                              <h4 className="font-bold flex items-center gap-2"><Package className="h-4 w-4" /> Base Logic</h4>
                              <p className="text-xs italic bg-background p-2 rounded border border-dashed">
                                {result.calculationFormula || "No specific formula string returned."}
                              </p>
                              {result.remarks.length > 0 && (
                                <div className="mt-2 text-[10px] text-destructive">
                                  <strong>Remarks:</strong> {result.remarks.join(' | ')}
                                </div>
                              )}
                            </div>
                            <div className="space-y-2">
                              <h4 className="font-bold flex items-center gap-2"><Percent className="h-4 w-4" /> Surcharge Breakdown</h4>
                              <ul className="space-y-1 text-xs font-mono">
                                <li className="flex justify-between">
                                  <span>Fuel ({result.fuelSurchargePercentApplied?.toFixed(2)}%)</span>
                                  <span>{formatCurrency(result.fuelSurchargeAmount)}</span>
                                </li>
                                {result.otherSurcharges.map(s => (
                                  <li key={s.id} className="flex justify-between">
                                    <span>{s.name}</span>
                                    <span>{formatCurrency(s.amount)}</span>
                                  </li>
                                ))}
                                {result.totalExtrasAmount > 0 && (
                                  <li className="flex justify-between text-blue-600">
                                    <span>Item Specific Extras</span>
                                    <span>{formatCurrency(result.totalExtrasAmount)}</span>
                                  </li>
                                )}
                                <Separator className="my-1" />
                                <li className="flex justify-between font-bold">
                                  <span>Total Logic Subtotal</span>
                                  <span>{formatCurrency(result.subTotalBeforeGST)}</span>
                                </li>
                              </ul>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
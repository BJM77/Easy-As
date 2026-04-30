

"use client";

import React, { useState, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { PostcodeData, ServiceName } from '@/lib/types';
import { BASIC_KILO_MIN_SERVICES } from '@/lib/types';
import { useSettings } from '@/context/SettingsContext';
import { useRateOverrides } from '@/context/RateOverrideContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowRightLeft, MapPin, Package, Weight, DollarSign, Target, Percent, Lock } from 'lucide-react';
import LocationAutocomplete from '@/components/freight/LocationAutocomplete';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from '@/firebase';


const legDiscountSchema = z.object({
  originLocation: z.custom<PostcodeData | null>((data) => data !== null, "Valid Origin location is required."),
  destinationLocation: z.custom<PostcodeData | null>((data) => data !== null, "Valid Destination is required."),
  services: z.array(z.string()).min(1, "At least one service must be selected."),
  spendBands: z.array(z.string()).min(1, "At least one Spend Band must be selected."),
  chargeableWeight: z.coerce.number().positive("Chargeable Weight must be positive."),
  targetPrice: z.coerce.number().positive("Target Price must be positive."),
  onPallet: z.boolean().default(false),
});

type LegDiscountFormValues = z.infer<typeof legDiscountSchema>;

interface CalculationResult {
  serviceName: ServiceName;
  spendBand: string;
  requiredKgRate: number | null;
  baseRate: number | null;
  minRate: number | null;
  fuelSurchargePercent: number;
  securitySurchargePercent: number;
  manualHandlingFee: number;
  error?: string;
}

const formatCurrency = (amount: number | null) => {
  if (amount === null || isNaN(amount)) return "N/A";
  return amount.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });
};

function parseSafeNum(val: any): number {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const clean = String(val).replace(/[^0-9.-]/g, '');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
}

export default function LegDiscountPageContent() {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<CalculationResult[]>([]);
  const { globalSpendBands, serviceSettings, surchargeDefinitions } = useSettings();
  const { getRateFile, isLoading: isLoadingRates } = useRateOverrides();
  const { toast } = useToast();
  const { role } = useAuth();

  const [originQuery, setOriginQuery] = useState("");
  const [destinationQuery, setDestinationQuery] = useState("");

  const form = useForm<LegDiscountFormValues>({
    resolver: zodResolver(legDiscountSchema),
    defaultValues: {
      originLocation: null,
      destinationLocation: null,
      chargeableWeight: 1,
      targetPrice: 1,
      spendBands: [],
      services: [],
      onPallet: false,
    },
  });

  const { control, handleSubmit, setValue, watch } = form;
  const chargeableWeight = watch('chargeableWeight');

  const applicableServices = useMemo(() => {
    return BASIC_KILO_MIN_SERVICES;
  }, []);

  const getServiceDetails = (serviceName: ServiceName) => {
    return {
      'B2B Std': { rateFileKey: 'b2brdex', logicPrefix: 'Parcel', bkm_prefix: 'B', zoneKey: 'ipec', usesMinRate: true },
      'B2B Priority': { rateFileKey: 'b2b_priority', logicPrefix: '02 02', bkm_prefix: 'B', zoneKey: 'prio', usesMinRate: false },
      'LCP Std': { rateFileKey: 'lcprdex', logicPrefix: 'LCPRDEX', bkm_prefix: 'LCPRDEX', zoneKey: 'ipec', usesMinRate: false },
      'LCP Priority': { rateFileKey: 'lcpprio', logicPrefix: 'LCPPrio', bkm_prefix: 'LCPPrio', zoneKey: 'prio', usesMinRate: false },
      'B2C Std': { rateFileKey: 'b2c', logicPrefix: 'B2C', bkm_prefix: 'B2C', zoneKey: 'ipec', usesMinRate: true },
      'B2C Priority': { rateFileKey: 'b2c', logicPrefix: 'B2CP', bkm_prefix: 'B2CP', zoneKey: 'prio', usesMinRate: true },
      'WA PE Special': { rateFileKey: 'pezone', logicPrefix: 'PE', bkm_prefix: 'PE', zoneKey: 'pallet', usesMinRate: true },
      'B2B Pallets Express': { rateFileKey: 'pallet2', logicPrefix: 'PE', bkm_prefix: 'E', zoneKey: 'pallet', usesMinRate: true },
      'B2B Pallets General Tiered': { rateFileKey: 'pallet1', logicPrefix: 'PG', bkm_prefix: 'G', zoneKey: 'pallet', usesMinRate: true },
    }[serviceName] || null;
  };

  const onSubmit = async (data: LegDiscountFormValues) => {
    setIsLoading(true);
    setResults([]);
    const calculatedResults: CalculationResult[] = [];

    const manualHandlingDef = surchargeDefinitions.find(d => d.id === 'manual_handling_gt30kg');
    const manualHandlingFee = (data.chargeableWeight > 30 && !data.onPallet && manualHandlingDef) ? manualHandlingDef.defaultValue || 0 : 0;

    for (const serviceName of data.services as ServiceName[]) {
      for (const spendBand of data.spendBands) {
        const serviceDetails = getServiceDetails(serviceName);
        const serviceConfig = serviceSettings.find(s => s.id === serviceName);

        if (!serviceDetails || !serviceConfig) {
          calculatedResults.push({ serviceName, spendBand, error: "Config not found", requiredKgRate: null, baseRate: null, minRate: null, fuelSurchargePercent: 0, securitySurchargePercent: 0, manualHandlingFee: 0 });
          continue;
        }
        
        const rateFileData = getRateFile(serviceDetails.rateFileKey as any);
        if (!rateFileData) {
           calculatedResults.push({ serviceName, spendBand, error: `Rate data not loaded`, requiredKgRate: null, baseRate: null, minRate: null, fuelSurchargePercent: 0, securitySurchargePercent: 0, manualHandlingFee: 0 });
           continue;
        }

        const originZone = data.originLocation?.[serviceDetails.zoneKey as keyof PostcodeData];
        const destZone = data.destinationLocation?.[serviceDetails.zoneKey as keyof PostcodeData];
        if (!originZone || !destZone) {
          calculatedResults.push({ serviceName, spendBand, error: `Missing ${serviceDetails.zoneKey.toUpperCase()} zones`, requiredKgRate: null, baseRate: null, minRate: null, fuelSurchargePercent: 0, securitySurchargePercent: 0, manualHandlingFee: 0 });
          continue;
        }

        const logicKey = `${serviceDetails.logicPrefix}${originZone}${destZone}`;
        const rateEntry = (rateFileData as any[]).find(r => r.Logic === logicKey);

        if (!rateEntry) {
          calculatedResults.push({ serviceName, spendBand, error: `No rate for key: ${logicKey}`, requiredKgRate: null, baseRate: null, minRate: null, fuelSurchargePercent: 0, securitySurchargePercent: 0, manualHandlingFee: 0 });
          continue;
        }

        let baseRate: number | null;
        let minRate: number | null;
        if (serviceDetails.bkm_prefix === 'B') {
          baseRate = parseSafeNum(rateEntry[`B${spendBand}`] ?? rateEntry.Basic);
          minRate = serviceDetails.usesMinRate ? parseSafeNum(rateEntry[`M${spendBand}`] ?? rateEntry.Min ?? rateEntry.Minimum ?? 0) : 0;
        } else {
          baseRate = parseSafeNum(rateEntry[`${serviceDetails.bkm_prefix}Basic`] ?? rateEntry.Basic);
          minRate = serviceDetails.usesMinRate ? parseSafeNum(rateEntry[`${serviceDetails.bkm_prefix}Min`] ?? rateEntry.Min ?? rateEntry.Minimum ?? 0) : 0;
        }
        
        if (isNaN(baseRate as number)) {
            calculatedResults.push({ serviceName, spendBand, error: "Base rate invalid", requiredKgRate: null, baseRate: null, minRate: null, fuelSurchargePercent: 0, securitySurchargePercent: 0, manualHandlingFee: 0 });
            continue;
        }

        const fuelSurchargePercent = serviceConfig.fuelSurchargePercent;
        const securitySurchargeConfig = serviceConfig.surcharges.find(s => s.surchargeId === 'security' && s.enabled);
        const securitySurchargePercent = securitySurchargeConfig ? securitySurchargeConfig.value : 0;
        
        const totalSurchargeMultiplier = 1 + (fuelSurchargePercent / 100) + (securitySurchargePercent / 100);

        const targetBeforeSurcharges = (data.targetPrice - manualHandlingFee) / totalSurchargeMultiplier;

        if (minRate !== null && !isNaN(minRate) && minRate > 0 && targetBeforeSurcharges < minRate) {
             const minCostWithSurcharges = minRate * totalSurchargeMultiplier + manualHandlingFee;
             calculatedResults.push({ serviceName, spendBand, error: `Target too low. Min rate of ${formatCurrency(minRate)} + surcharges requires ${formatCurrency(minCostWithSurcharges)}.`, requiredKgRate: null, baseRate, minRate, fuelSurchargePercent, securitySurchargePercent, manualHandlingFee });
             continue;
        }
        
        const priceComponentForKiloRate = targetBeforeSurcharges - (baseRate as number);
        
        if (priceComponentForKiloRate < -0.001) { // allow for tiny floating point rounding errors
            calculatedResults.push({ serviceName, spendBand, error: `Target too low. Doesn't cover base rate of ${formatCurrency(baseRate)} + surcharges.`, requiredKgRate: null, baseRate, minRate, fuelSurchargePercent, securitySurchargePercent, manualHandlingFee });
            continue;
        }
        
        const requiredKgRate = data.chargeableWeight > 0 ? priceComponentForKiloRate / data.chargeableWeight : 0;

        calculatedResults.push({ serviceName, spendBand, requiredKgRate, baseRate, minRate, fuelSurchargePercent, securitySurchargePercent, manualHandlingFee });
      }
    }

    setResults(calculatedResults);
    setIsLoading(false);
  };
  
  if (role && !['admin', 'superadmin', 'rsm', 'bdm'].includes(role)) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center"><Lock className="mr-2 h-5 w-5"/>Access Denied</CardTitle>
                <CardDescription>
                    The Leg Discount tool is available for BDM, RSM, Admin, and Super Admin roles.
                </CardDescription>
            </CardHeader>
        </Card>
    );
  }

  return (
    <div className="space-y-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <ArrowRightLeft className="mr-2 h-7 w-7 text-primary" /> Leg Discount Calculator
          </CardTitle>
          <CardDescription>
            Work backwards from a target price to find the required per-kilogram rate for specific freight legs across multiple services and spend bands.
          </CardDescription>
        </CardHeader>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-2">
                <Label htmlFor="originQuery" className="flex items-center"><MapPin className="mr-2 h-4 w-4" />Origin</Label>
                <LocationAutocomplete 
                    inputId="originQuery" 
                    value={originQuery} 
                    onValueChange={setOriginQuery} 
                    onLocationSelect={(l) => {
                        setValue('originLocation', l, { shouldValidate: true });
                        setOriginQuery(l ? `${l.suburb} ${l.state} ${l.postcode}` : '');
                    }}
                />
                {form.formState.errors.originLocation && <p className="text-sm text-destructive">{form.formState.errors.originLocation.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="destinationQuery" className="flex items-center"><MapPin className="mr-2 h-4 w-4" />Destination</Label>
                <LocationAutocomplete 
                    inputId="destinationQuery" 
                    value={destinationQuery} 
                    onValueChange={setDestinationQuery} 
                    onLocationSelect={(l) => {
                        setValue('destinationLocation', l, { shouldValidate: true });
                        setDestinationQuery(l ? `${l.suburb} ${l.state} ${l.postcode}` : '');
                    }}
                />
                {form.formState.errors.destinationLocation && <p className="text-sm text-destructive">{form.formState.errors.destinationLocation.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="chargeableWeight" className="flex items-center"><Weight className="mr-2 h-4 w-4" />Chargeable Weight (kg)</Label>
                <Input id="chargeableWeight" type="number" {...form.register('chargeableWeight')} />
                {form.formState.errors.chargeableWeight && <p className="text-sm text-destructive">{form.formState.errors.chargeableWeight.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="targetPrice" className="flex items-center"><Target className="mr-2 h-4 w-4" />Target Final Price ($)</Label>
                <Input id="targetPrice" type="number" {...form.register('targetPrice')} />
                {form.formState.errors.targetPrice && <p className="text-sm text-destructive">{form.formState.errors.targetPrice.message}</p>}
              </div>
            </div>
             {chargeableWeight > 30 && (
                <div className="flex items-center space-x-2 pt-4">
                    <Controller name="onPallet" control={control} render={({ field }) => ( <Checkbox id="onPallet" checked={field.value} onCheckedChange={field.onChange} /> )}/>
                    <Label htmlFor="onPallet" className="font-normal cursor-pointer">Item is on a pallet/skid (avoids manual handling fee)</Label>
                </div>
             )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label className="flex items-center"><Package className="mr-2 h-4 w-4" />Services</Label>
                    <Card className="p-4">
                        <Controller name="services" control={control} render={({ field }) => (
                             <div className="grid grid-cols-2 gap-4">
                                {applicableServices.map(s => (
                                    <div key={s} className="flex items-center space-x-2">
                                        <Checkbox id={`service-${s}`} checked={field.value.includes(s)} onCheckedChange={checked => {
                                            const newValue = checked ? [...field.value, s] : field.value.filter(val => val !== s);
                                            field.onChange(newValue);
                                        }}/>
                                        <Label htmlFor={`service-${s}`} className="font-normal">{s}</Label>
                                    </div>
                                ))}
                            </div>
                        )}/>
                        {form.formState.errors.services && <p className="text-sm text-destructive mt-2">{form.formState.errors.services.message}</p>}
                    </Card>
                </div>
                 <div className="space-y-2">
                    <Label className="flex items-center"><DollarSign className="mr-2 h-4 w-4" />Spend Bands</Label>
                     <Card className="p-4">
                        <Controller name="spendBands" control={control} render={({ field }) => (
                            <div className="grid grid-cols-2 gap-4">
                                {globalSpendBands.map(b => (
                                    <div key={b} className="flex items-center space-x-2">
                                        <Checkbox id={`sb-${b}`} checked={field.value.includes(b)} onCheckedChange={checked => {
                                            const newValue = checked ? [...field.value, b] : field.value.filter(val => val !== b);
                                            field.onChange(newValue);
                                        }}/>
                                        <Label htmlFor={`sb-${b}`} className="font-normal">Spend Band {b}</Label>
                                    </div>
                                ))}
                            </div>
                        )}/>
                        {form.formState.errors.spendBands && <p className="text-sm text-destructive mt-2">{form.formState.errors.spendBands.message}</p>}
                    </Card>
                </div>
            </div>

            <Button type="submit" disabled={isLoading || isLoadingRates}>
              {isLoading || isLoadingRates ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Calculate KG Rate
            </Button>
          </form>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Calculation Results</CardTitle>
            <CardDescription>The per-kilo rate needed to meet your target price, factoring in base rates, fuel, security, and manual handling fees where applicable.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Service</TableHead>
                        <TableHead>Spend Band</TableHead>
                        <TableHead className="text-right">Required KG Rate</TableHead>
                        <TableHead>Result</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {results.map((res, index) => (
                        <TableRow key={`${res.serviceName}-${res.spendBand}-${index}`}>
                            <TableCell>{res.serviceName}</TableCell>
                            <TableCell>SB {res.spendBand}</TableCell>
                            <TableCell className="text-right font-bold text-lg text-primary">{formatCurrency(res.requiredKgRate)}</TableCell>
                            <TableCell>
                                {res.error ? (
                                    <span className="text-destructive text-sm">{res.error}</span>
                                ) : (
                                    <span className="text-muted-foreground text-sm">
                                        Base: {formatCurrency(res.baseRate)}, Min: {formatCurrency(res.minRate)}, Fuel: {res.fuelSurchargePercent.toFixed(2)}%, Sec: {res.securitySurchargePercent.toFixed(2)}%
                                        {res.manualHandlingFee > 0 && `, MH: ${formatCurrency(res.manualHandlingFee)}`}
                                    </span>
                                )}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
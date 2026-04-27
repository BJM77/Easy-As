"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Calculator, Loader2, History, ArrowRightLeft, ChevronRight, Package, TrendingUp, Info } from 'lucide-react';
import LocationAutocomplete from '@/components/freight/LocationAutocomplete';
import { useSettings } from '@/context/SettingsContext';
import { useAuth, useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import type { PostcodeData, FreightFormValues, CalculatedPriceItem, AdditionalPercentageType, QuoteLog } from '@/lib/types';
import { getAllowedServices, DEFAULT_SERVICE_PERMISSIONS } from '@/lib/types';
import { isServiceEnabledForCompany } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { calculateAllFreightPrices } from '@/lib/freightCalculations';
import { useRateOverrides } from '@/context/RateOverrideContext';
import QuickQuoteResultsDialog from './QuickQuoteResultsDialog';
import { cn, formatCurrency } from '@/lib/utils';
import { collection, serverTimestamp, query, where, orderBy, limit } from 'firebase/firestore';
import { Separator } from '../ui/separator';
import Link from 'next/link';

const dashboardCalculatorSchema = z.object({
  spendBand: z.string().min(1, "Spend Band is required."),
  originQuery: z.string().min(3, "Origin is required."),
  originLocation: z.custom<PostcodeData | null>((data) => data !== null, {
    message: "Please select a valid origin from the suggestions.",
  }),
  destinationQuery: z.string().min(3, "Destination is required."),
  destinationLocation: z.custom<PostcodeData | null>((data) => data !== null, {
    message: "Please select a valid destination from the suggestions.",
  }),
  weight: z.coerce.number().positive("Weight must be positive."),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1."),
  length: z.coerce.number().optional(),
  width: z.coerce.number().optional(),
  height: z.coerce.number().optional(),
  additionalPercentageType: z.enum(['none', '3', '5', '8', '10', '12', '15', '18', '20', '30', 'other']).default('none'),
  additionalPercentageCustom: z.coerce.number().min(0).optional(),
  applyGST: z.boolean().default(false),
});

type DashboardCalculatorFormValues = z.infer<typeof dashboardCalculatorSchema>;

const additionalPercentageOptions: { value: AdditionalPercentageType; label: string }[] = [
  { value: 'none', label: 'Markup' },
  { value: '3', label: '3%' },
  { value: '5', label: '5%' },
  { value: '8', label: '8%' },
  { value: '10', label: '10%' },
  { value: '12', label: '12%' },
  { value: '15', label: '15%' },
  { value: '18', label: '18%' },
  { value: '20', label: '20%' },
  { value: '30', label: '30%' },
  { value: 'other', label: 'Other %' },
];

export default function DashboardCalculator() {
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { globalSpendBands, serviceSettings, surchargeDefinitions, servicePermissions } = useSettings();
  const { getRateFile, getAllRateFiles, isLoading: isLoadingRates, areOurRatesLoaded, pezoneData } = useRateOverrides();
  const { user, profile, company, role, actualRole, loading: authLoading } = useAuth();
  
  const [isLoading, setIsLoading] = useState(false);
  const [showDimensions, setShowDimensions] = useState(false);
  const [results, setResults] = useState<CalculatedPriceItem[]>([]);
  const [isResultsDialogOpen, setIsResultsDialogOpen] = useState(false);

  const historyQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
        collection(firestore, 'quote_logs'),
        where('userId', '==', user.uid),
        orderBy('timestamp', 'desc'),
        limit(4)
    );
  }, [firestore, user]);

  const { data: recentLogs = [], isLoading: isLoadingHistory } = useCollection<QuoteLog>(historyQuery);

  const allowedServices = useMemo(() => {
    // HARDENED: Use token role immediately, fall back to default permissions if context isn't fully loaded
    const activeRole = role || actualRole || 'user';
    const permissions = servicePermissions && Object.keys(servicePermissions).length > 0 ? servicePermissions : DEFAULT_SERVICE_PERMISSIONS;
    const roleAllowed = getAllowedServices(activeRole, permissions);
    return roleAllowed.filter(s => isServiceEnabledForCompany(s, company, actualRole));
  }, [role, actualRole, servicePermissions, company]);

  const showStandardSpendBands = useMemo(() => {
    if (actualRole === 'superadmin') return true;
    return company?.enabledFeatures?.['standard-spend-bands'] !== false;
  }, [actualRole, company]);

  const defaultSpendBand = useMemo(() => {
    if (areOurRatesLoaded) return "Customer Rates";
    return "1";
  }, [areOurRatesLoaded]);

  const form = useForm<DashboardCalculatorFormValues>({
    resolver: zodResolver(dashboardCalculatorSchema),
    defaultValues: {
      spendBand: defaultSpendBand,
      originQuery: '',
      originLocation: null,
      destinationQuery: '',
      destinationLocation: null,
      weight: 0,
      quantity: 1,
      length: undefined,
      width: undefined,
      height: undefined,
      additionalPercentageType: 'none',
      applyGST: false,
    },
  });

  const { watch, control, handleSubmit, setValue, reset } = form;
  const additionalPercentageType = watch('additionalPercentageType');

  useEffect(() => {
    if (typeof window !== 'undefined' && !isLoadingRates) {
        const rehydrateStr = sessionStorage.getItem('rehydration_state');
        if (rehydrateStr) {
            try {
                const state = JSON.parse(rehydrateStr);
                reset(state);
                sessionStorage.removeItem('rehydration_state');
                if (state.originLocation && state.destinationLocation) {
                    setTimeout(() => handleSubmit(runCalculation)(), 500);
                }
            } catch (e) {
                console.error("Rehydration failed", e);
            }
        }
    }
  }, [reset, handleSubmit, isLoadingRates]);

  const runCalculation = async (data: DashboardCalculatorFormValues) => {
    setIsLoading(true);
    
    if (allowedServices.length === 0) {
        toast({ title: "No Services Available", description: "Your current role or organization settings do not have any active freight services.", variant: "destructive"});
        setIsLoading(false);
        return;
    }

    const calculatorState: any = {
      ...data,
      items: [{ weight: data.weight, quantity: data.quantity, length: data.length, width: data.width, height: data.height }],
      selectedServices: allowedServices,
      globalNoCubic: false,
      globalOnPallet: false,
    };

    try {
        const calculatedResults = await calculateAllFreightPrices({
            formData: calculatorState,
            allServiceSettings: serviceSettings,
            allSurchargeDefinitions: surchargeDefinitions,
            getRateFile,
            getAllRateFiles,
            pezoneData
        });
        const applicableResults = calculatedResults.filter(r => r.isApplicable).sort((a,b) => (a.finalPrice ?? Infinity) - (b.finalPrice ?? Infinity));
        
        setResults(applicableResults);
        setIsResultsDialogOpen(true);

        if (firestore && user && applicableResults.length > 0) {
            const logsCol = collection(firestore, 'quote_logs');
            const activeCompanyId = company?.id || profile?.companyId || 'unknown';
            const best = applicableResults[0];

            addDocumentNonBlocking(logsCol, {
                userEmail: user.email,
                userId: user.uid,
                companyId: activeCompanyId,
                origin: data.originQuery,
                destination: data.destinationQuery,
                chargeWeight: best.chargeableWeight,
                markup: data.additionalPercentageType === 'none' ? '0%' : (data.additionalPercentageType === 'other' ? `${data.additionalPercentageCustom}%` : `${data.additionalPercentageType}%`),
                service: best.serviceName,
                totalExGst: best.subTotalBeforeGST,
                resultsCount: applicableResults.length,
                timestamp: serverTimestamp(),
                inputState: calculatorState
            });
        }
    } catch(e) {
        toast({ title: "Calculation Failed", variant: "destructive"});
    } finally {
        setIsLoading(false);
    }
  };

  const handleReplicateHistory = (log: QuoteLog) => {
    if (!log.inputState) return;
    const state = log.inputState;
    reset({
        spendBand: state.spendBand,
        originQuery: state.originQuery,
        originLocation: state.originLocation,
        destinationQuery: state.destinationQuery,
        destinationLocation: state.destinationLocation,
        weight: state.items[0]?.weight || 0,
        quantity: state.items[0]?.quantity || 1,
        length: state.items[0]?.length,
        width: state.items[0]?.width,
        height: state.items[0]?.height,
        additionalPercentageType: state.additionalPercentageType,
        additionalPercentageCustom: state.additionalPercentageCustom,
        applyGST: state.applyGST
    });
    toast({ title: "History Loaded", description: `Route: ${log.origin} &gt; ${log.destination}` });
  };

  const overallLoading = isLoading || authLoading;

  return (
    <>
      <Card className="shadow-lg flex flex-col h-full">
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl font-headline flex items-center">
            <Calculator className="mr-2 h-7 w-7 text-primary" />
            Quick Quote
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 flex-grow">
          <form onSubmit={handleSubmit(runCalculation)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-muted-foreground">Spend Band</Label>
                <Controller
                  name="spendBand"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select Band" />
                      </SelectTrigger>
                      <SelectContent>
                        {showStandardSpendBands && globalSpendBands.map(band => <SelectItem key={band} value={band}>{`Spend Band ${band}`}</SelectItem>)}
                        {areOurRatesLoaded && <SelectItem value="Customer Rates">Customer Rates</SelectItem>}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-muted-foreground">Origin</Label>
                <LocationAutocomplete
                  inputId="dash-originQuery"
                  value={watch('originQuery')}
                  onValueChange={(value) => setValue('originQuery', value, { shouldValidate: true })}
                  onLocationSelect={(loc) => setValue('originLocation', loc, { shouldValidate: true })}
                  placeholder="Suburb or PC"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-muted-foreground">Destination</Label>
                <LocationAutocomplete
                  inputId="dash-destinationQuery"
                  value={watch('destinationQuery')}
                  onValueChange={(value) => setValue('destinationQuery', value, { shouldValidate: true })}
                  onLocationSelect={(loc) => setValue('destinationLocation', loc, { shouldValidate: true })}
                  placeholder="Suburb or PC"
                  className="h-9"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4 items-end">
               <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-muted-foreground">Weight (kg)</Label>
                <Input type="number" {...form.register('weight')} placeholder="0" onFocus={(e) => e.target.select()} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-muted-foreground">Qty</Label>
                <Input type="number" {...form.register('quantity')} placeholder="1" onFocus={(e) => e.target.select()} className="h-9" />
              </div>
              <div className="col-span-2 lg:col-span-3 flex items-end gap-2">
                 <Button type="button" variant="outline" size="sm" onClick={() => setShowDimensions(!showDimensions)} className="h-9 text-[10px] px-2 shrink-0">
                    {showDimensions ? 'Hide Dims' : '+ Dims'}
                </Button>
                <div className="w-[95px] shrink-0">
                 <Controller
                    name="additionalPercentageType"
                    control={control}
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger className="h-9 text-[10px] px-2">
                                <SelectValue placeholder="Markup" />
                            </SelectTrigger>
                            <SelectContent>
                                {additionalPercentageOptions.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                 />
                </div>
                <Button type="submit" className="h-12 flex-grow bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-xs tracking-widest shadow-lg shadow-primary/20" disabled={overallLoading}>
                    {overallLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Calculator className="mr-2 h-5 w-5" /> Quote</>}
                </Button>
              </div>
            </div>

            {showDimensions && (
                <div className="grid grid-cols-3 gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="space-y-1">
                        <Label className="text-[8px] uppercase font-black text-muted-foreground">L (cm)</Label>
                        <Input type="number" {...form.register('length')} className="h-7 text-xs" />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[8px] uppercase font-black text-muted-foreground">W (cm)</Label>
                        <Input type="number" {...form.register('width')} className="h-7 text-xs" />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[8px] uppercase font-black text-muted-foreground">H (cm)</Label>
                        <Input type="number" {...form.register('height')} className="h-7 text-xs" />
                    </div>
                </div>
            )}
          </form>

          <Separator className="my-4" />

          <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <History className="h-3 w-3" />
                    Your Recent Results
                </h4>
                {recentLogs && recentLogs.length > 0 && (
                    <Button variant="link" asChild className="h-auto p-0 text-[10px] font-bold">
                        <Link href="/admin/quote-logs">View All</Link>
                    </Button>
                )}
              </div>
              
              <div className="space-y-1.5">
                  {isLoadingHistory ? (
                      <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground/30" /></div>
                  ) : (recentLogs && recentLogs.length > 0) ? (
                      recentLogs.map((log) => (
                          <div 
                            key={log.id} 
                            onClick={() => handleReplicateHistory(log)}
                            className="flex items-center justify-between p-2 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/50 cursor-pointer group transition-colors"
                          >
                              <div className="flex items-center gap-2 min-w-0">
                                  <div className="h-7 w-7 rounded bg-background flex items-center justify-center border shadow-sm shrink-0">
                                      <TrendingUp className="h-3.5 w-3.5 text-primary opacity-50" />
                                  </div>
                                  <div className="min-w-0">
                                      <p className="text-[10px] font-bold truncate">{log.origin} &gt; {log.destination}</p>
                                      <p className="text-[9px] text-muted-foreground uppercase font-black tracking-tighter">
                                          {log.service} • {log.chargeWeight}kg
                                      </p>
                                  </div>
                              </div>
                              <div className="text-right shrink-0 flex items-center gap-2">
                                  <span className="text-xs font-black font-headline text-primary">
                                      {formatCurrency(log.totalExGst)}
                                  </span>
                                  <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                          </div>
                      ))
                  ) : (
                      <div className="py-8 text-center border-2 border-dashed rounded-lg bg-muted/5">
                          <p className="text-[10px] text-muted-foreground italic">No recent calculations found.</p>
                      </div>
                  )}
              </div>
          </div>
        </CardContent>
        <CardFooter className="bg-muted/30 border-t py-3 flex justify-between items-center">
            <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 font-headline">
                <Info className="h-3 w-3" />
                Select a recent result to re-load parameters.
            </p>
            <Button variant="ghost" size="sm" asChild className="h-6 text-[9px] font-black uppercase tracking-widest">
                <Link href="/calculator">Full Mode <ArrowRightLeft className="ml-1.5 h-2.5 w-2.5" /></Link>
            </Button>
        </CardFooter>
      </Card>

      <QuickQuoteResultsDialog
        isOpen={isResultsDialogOpen}
        onOpenChange={setIsResultsDialogOpen}
        results={results}
        onGoToFullCalculator={() => {
            const data = form.getValues();
            const calculatorState: any = {
                ...data,
                items: [{ weight: data.weight, quantity: data.quantity, length: data.length, width: data.width, height: data.height }],
                selectedServices: allowedServices,
            };
            sessionStorage.setItem('rehydration_state', JSON.stringify(calculatorState));
            router.push('/calculator');
        }}
        role={role}
      />
    </>
  );
}

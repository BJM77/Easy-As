"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { 
  FreightFormValues, 
  PostcodeData, 
  CalculatedPriceItem, 
  ServiceName, 
  AdditionalPercentageType, 
  IntelliSendResult
} from '@/lib/types';
import { getAllowedServices, isServiceEnabledForCompany, DEFAULT_SERVICE_PERMISSIONS } from '@/lib/types';
import { freightFormSchema } from '@/lib/zodSchemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { 
  MapPin, 
  Package, 
  Loader2, 
  Info, 
  Trash2, 
  Truck, 
  Zap, 
  PlusCircle, 
  RefreshCw,
  AlertCircle,
  Sparkles,
  Fuel,
  Calculator,
  ExternalLink,
  TrendingUp
} from 'lucide-react';
import LocationAutocomplete from '@/components/freight/LocationAutocomplete';
import { Checkbox } from '@/components/ui/checkbox';
import { useSettings } from '@/context/SettingsContext';
import PricingResults from '@/components/freight/PricingResults';
import { calculateAllFreightPrices, calculateOptimizedRates } from '@/lib/freightCalculations';
import { useRateOverrides } from '@/context/RateOverrideContext';
import EmailQuoteDialog from '@/components/freight/EmailQuoteDialog';
import { cn } from '@/lib/utils';
import { useAuth, useFirestore, addDocumentNonBlocking } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { updateFuelSurcharges } from '@/ai/flows/update-fuel-surcharges-flow';
import { collection, serverTimestamp } from 'firebase/firestore';

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

export default function FreightForm() {
  const { user, profile, company, role, actualRole, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const { 
    globalSpendBands, 
    serviceSettings, 
    surchargeDefinitions, 
    servicePermissions, 
    updateGroupFuelSurcharge,
  } = useSettings();
  const { getRateFile, getAllRateFiles, isLoading: isLoadingRates, areOurRatesLoaded, isAnyFileLoaded, pezoneData } = useRateOverrides();

  const [isLoadingForm, setIsLoadingForm] = useState(false);
  const [isUpdatingFuel, setIsUpdatingFuel] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [calculatedResults, setCalculatedResults] = useState<CalculatedPriceItem[]>([]);
  const [optimizedResult, setOptimizedResult] = useState<IntelliSendResult | null>(null);
  
  const [isEmailQuoteDialogOpen, setIsEmailQuoteDialogOpen] = useState(false);
  const [selectedServiceForQuote, setSelectedServiceForQuote] = useState<CalculatedPriceItem | null>(null);
  const [itemDimensionsVisibility, setItemDimensionsVisibility] = useState<boolean[]>([false]);
  const resultsRef = useRef<HTMLDivElement>(null);

  const allowedServices = useMemo(() => {
    const permissions = servicePermissions && Object.keys(servicePermissions).length > 0 ? servicePermissions : DEFAULT_SERVICE_PERMISSIONS;
    const roleAllowed = getAllowedServices(role, permissions);
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

  const form = useForm<FreightFormValues>({
    resolver: zodResolver(freightFormSchema),
    defaultValues: {
      spendBand: defaultSpendBand,
      originQuery: '',
      originLocation: null,
      destinationQuery: '',
      destinationLocation: null,
      items: [{ weight: 0, quantity: 1 }],
      globalNoCubic: false,
      globalOnPallet: false,
      selectedServices: [],
      additionalPercentageType: 'none',
      applyGST: false,
      accountTransferRequired: false,
      afterHoursCollection: false,
      afterHoursDelivery: false,
      publicHolidayService: false,
      bookInDeliveryRequired: false,
      dangerousGoodsConsignment: false,
      handUnloadRequired: false,
      routeViaMelbourne: false,
      tailLiftRequired: false,
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const { watch, control, handleSubmit, setValue, formState, getValues, reset } = form;
  const additionalPercentageType = watch('additionalPercentageType');

  useEffect(() => {
    if (typeof window !== 'undefined') {
        const rehydrateStr = sessionStorage.getItem('rehydration_state');
        if (rehydrateStr) {
            try {
                const state = JSON.parse(rehydrateStr);
                reset(state);
                sessionStorage.removeItem('rehydration_state');
                toast({ title: "Form Rehydrated", description: "Quote parameters loaded successfully." });
                if (state.originLocation && state.destinationLocation) {
                    handleSubmit(runCalculation)();
                }
            } catch (e) {
                console.error("Rehydration failed", e);
            }
        }
    }
  }, [reset, handleSubmit, toast]);

  useEffect(() => {
    if (allowedServices && allowedServices.length > 0) {
        const currentServices = getValues('selectedServices') || [];
        const validServices = currentServices.filter(s => allowedServices.includes(s));
        
        if (validServices.length === 0 || validServices.length !== currentServices.length) {
            setValue('selectedServices', allowedServices, { shouldValidate: true });
        }
    }
  }, [allowedServices, setValue, getValues]);

  const handleFetchLatestFuelRates = async () => {
    setIsUpdatingFuel(true);
    toast({ title: "Connecting to TGE...", description: "Fetching live fuel rates." });
    try {
      const { update, success, error } = await updateFuelSurcharges();
      if (!success) throw new Error(error || "Fetch failed");
      
      updateGroupFuelSurcharge('pallet', update.pallet, update.lastUpdated);
      updateGroupFuelSurcharge('standard', update.road, update.lastUpdated);
      updateGroupFuelSurcharge('priority', update.air, update.lastUpdated);
      
      toast({
        title: "Fuel Rates Updated",
        description: "Live TGE fuel percentages loaded for this session.",
      });
    } catch (error) {
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Could not reach TGE website.",
        variant: "destructive"
      });
    } finally {
      setIsUpdatingFuel(false);
    }
  };

  const handleOpenEmailQuoteDialog = (serviceResult: CalculatedPriceItem) => {
    setSelectedServiceForQuote(serviceResult);
    setIsEmailQuoteDialogOpen(true);
  };

  const handleAddNewItem = () => {
    append({ weight: 0, quantity: 1 });
    setItemDimensionsVisibility(prev => [...prev, false]);
  };
  
  const handleRemoveItem = (index: number) => {
    remove(index);
    setItemDimensionsVisibility(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleClearItems = () => {
    replace([{ weight: 0, quantity: 1 }]);
    setItemDimensionsVisibility([false]);
  };

  const handleClearLocations = () => {
    setValue('originQuery', '', { shouldValidate: true, shouldDirty: true });
    setValue('originLocation', null, { shouldValidate: true, shouldDirty: true });
    setValue('destinationQuery', '', { shouldValidate: true, shouldDirty: true });
    setValue('destinationLocation', null, { shouldValidate: true, shouldDirty: true });
  };

  const toggleItemDimensions = (index: number) => {
    setItemDimensionsVisibility(prev => {
      const newVisibility = [...prev];
      newVisibility[index] = !newVisibility[index];
      if (!newVisibility[index]) {
        setValue(`items.${index}.length`, undefined);
        setValue(`items.${index}.width`, undefined);
        setValue(`items.${index}.height`, undefined);
      }
      return newVisibility;
    });
  };

  const runCalculation = async (data: FreightFormValues) => {
    setIsLoadingForm(true);
    setOptimizedResult(null);
    const servicesToSubmit = (data.selectedServices && data.selectedServices.length > 0) ? data.selectedServices : allowedServices;
    
    if (servicesToSubmit.length === 0) {
        toast({ title: "No Services Selected", variant: "destructive"});
        setIsLoadingForm(false);
        return;
    }

    try {
      const results = await calculateAllFreightPrices({
          formData: { ...data, selectedServices: servicesToSubmit }, 
          allServiceSettings: serviceSettings, 
          allSurchargeDefinitions: surchargeDefinitions, 
          getRateFile,
          getAllRateFiles,
          pezoneData: pezoneData
      });
      const sorted = results
        .filter(r => r.isApplicable && r.baseRate !== null)
        .sort((a, b) => (a.finalPrice ?? Infinity) - (b.finalPrice ?? Infinity));
      setCalculatedResults(sorted);

      try {
        const optimizedRes = await calculateOptimizedRates({
            formData: { ...data, selectedServices: servicesToSubmit }, 
            allServiceSettings: serviceSettings, 
            allSurchargeDefinitions: surchargeDefinitions, 
            getRateFile,
            getAllRateFiles,
            pezoneData: pezoneData
        });
        setOptimizedResult(optimizedRes);
      } catch (optErr) {
        console.warn("Optimized summary calculation failed", optErr);
      }

      // --- LOGGING TRIGGER: Fires immediately upon successful calculation ---
      if (firestore && user && sorted.length > 0) {
        const logsCol = collection(firestore, 'quote_logs');
        sorted.forEach(res => {
          if (res.isApplicable) {
            addDocumentNonBlocking(logsCol, {
                userEmail: user.email,
                userId: user.uid,
                companyId: profile?.companyId || 'unknown',
                origin: data.originQuery,
                destination: data.destinationQuery,
                chargeWeight: res.chargeableWeight,
                markup: data.additionalPercentageType === 'none' ? '0%' : (data.additionalPercentageType === 'other' ? `${data.additionalPercentageCustom}%` : `${data.additionalPercentageType}%`),
                service: res.serviceName,
                totalExGst: res.subTotalBeforeGST,
                timestamp: serverTimestamp(),
                inputState: data 
            });
          }
        });
      }

    } catch (e) {
      console.error("Main calculation block failed", e);
      toast({ title: "Error", description: "Calculation failed.", variant: "destructive"});
    } finally {
      setIsLoadingForm(false);
    }
  };
  
  const onSubmit = async (data: FreightFormValues) => {
    setShowResults(false);
    await runCalculation(data);
    setShowResults(true);
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const overallLoading = isLoadingForm || isLoadingRates || authLoading;

  if (authLoading || !user) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
            Freight Calculator
            <div className={cn(
              "h-2.5 w-2.5 rounded-full ml-1",
              isAnyFileLoaded ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"
            )} title={isAnyFileLoaded ? "Pricing Data Loaded" : "No Pricing Data Loaded"} />
          </h1>
          <p className="text-muted-foreground text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            Get instant pricing across the entire multi-modal network.
          </p>
        </div>
      </div>

      <Card className="w-full shadow-xl">
        <CardContent className="pt-6 p-4 md:p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 md:space-y-8" autoComplete="off">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 items-end">
              <div className="space-y-2">
                <Label htmlFor="spendBand" className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Spend Band</Label>
                <Controller
                    name="spendBand"
                    control={control}
                    render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger id="spendBand" className="w-full h-10">
                          <SelectValue placeholder="Select Spend Band" />
                        </SelectTrigger>
                        <SelectContent>
                          {showStandardSpendBands && globalSpendBands.map(band => <SelectItem key={band} value={band}>{`Spend Band ${band}`}</SelectItem>)}
                          {areOurRatesLoaded && <SelectItem value="Customer Rates">Customer Rates</SelectItem>}
                        </SelectContent>
                    </Select>
                    )}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center"><MapPin className="mr-1.5 h-3 w-3" /> Origin</Label>
                <LocationAutocomplete
                  inputId="originQuery"
                  value={watch('originQuery')}
                  onValueChange={(val) => setValue('originQuery', val, { shouldValidate: true })}
                  onLocationSelect={(loc) => setValue('originLocation', loc, { shouldValidate: true })}
                  placeholder="Enter suburb or postcode"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center"><MapPin className="mr-1.5 h-3 w-3" /> Destination</Label>
                <LocationAutocomplete
                  inputId="destinationQuery"
                  value={watch('destinationQuery')}
                  onValueChange={(val) => setValue('destinationQuery', val, { shouldValidate: true })}
                  onLocationSelect={(loc) => setValue('destinationLocation', loc, { shouldValidate: true })}
                  placeholder="Enter suburb or postcode"
                />
              </div>
            </div>

            <div>
              <h3 className="text-lg md:text-xl font-bold font-headline mb-3 md:mb-4 flex items-center text-primary">
                  <Package className="mr-2 h-5 w-5" /> Item Details
              </h3>
              {fields.map((item, index) => (
                  <Card key={item.id} className="mb-4 p-3 md:p-4 border rounded-lg shadow-sm bg-muted/20">
                      <div className="grid grid-cols-1 gap-y-2 gap-x-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 items-end">
                          <div className="space-y-1 flex-grow">
                              <Label htmlFor={`items.${index}.weight`} className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Weight (kg)</Label>
                               <div className="flex items-center gap-2">
                                  <Input id={`items.${index}.weight`} type="number" {...form.register(`items.${index}.weight`, { valueAsNumber: true })} onFocus={(e) => e.target.select()} placeholder="0" className="h-9" />
                                  <Button type="button" variant="outline" size="sm" onClick={() => toggleItemDimensions(index)} className="h-9 text-xs">
                                      {itemDimensionsVisibility[index] ? 'Hide Dims' : 'Add Dims'}
                                  </Button>
                              </div>
                          </div>

                          {itemDimensionsVisibility[index] && (
                              <>
                                  <div className="space-y-1">
                                      <Label htmlFor={`items.${index}.length`} className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-muted-foreground">L (cm)</Label>
                                      <Input id={`items.${index}.length`} type="number" step="0.1" {...form.register(`items.${index}.length`)} onFocus={(e) => e.target.select()} className="h-9" />
                                  </div>
                                  <div className="space-y-1">
                                      <Label htmlFor={`items.${index}.width`} className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-muted-foreground">W (cm)</Label>
                                      <Input id={`items.${index}.width`} type="number" step="0.1" {...form.register(`items.${index}.width`)} onFocus={(e) => e.target.select()} className="h-9" />
                                  </div>
                                  <div className="space-y-1">
                                      <Label htmlFor={`items.${index}.height`} className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-muted-foreground">H (cm)</Label>
                                      <Input id={`items.${index}.height`} type="number" step="0.1" {...form.register(`items.${index}.height`)} onFocus={(e) => e.target.select()} className="h-9" />
                                  </div>
                              </>
                          )}
                          
                          <div className="space-y-1">
                             <Label htmlFor={`items.${index}.quantity`} className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Quantity</Label>
                             <Input id={`items.${index}.quantity`} type="number" step="1" {...form.register(`items.${index}.quantity`, { valueAsNumber: true })} onFocus={(e) => e.target.select()} className="h-9" />
                          </div>
                      </div>
                      {fields.length > 1 && (
                          <div className="mt-2">
                              <Button type="button" variant="destructive" size="sm" onClick={() => handleRemoveItem(index)}>
                                  <Trash2 className="h-4 w-4" />
                              </Button>
                          </div>
                      )}
                  </Card>
              ))}
               <div className="mt-4 flex flex-col space-y-2 md:flex-row md:space-y-0 md:space-x-2 md:items-center md:flex-wrap">
                   <Controller
                      name="globalOnPallet"
                      control={form.control}
                      render={({ field }) => (
                          <div className="flex items-center">
                              <Checkbox id="globalOnPallet" checked={field.value} onCheckedChange={field.onChange} className="peer sr-only" />
                              <Label htmlFor="globalOnPallet" className={cn("flex items-center justify-center px-3 py-2 border rounded-md cursor-pointer text-xs font-medium transition-colors h-9", "bg-background hover:bg-accent hover:text-accent-foreground w-full md:w-auto", field.value ? "bg-primary text-primary-foreground hover:bg-primary/90 border-primary" : "border-input")}>
                                  On Pallet
                              </Label>
                          </div>
                      )}
                  />
                   <Controller
                      name="applyGST"
                      control={form.control}
                      render={({ field }) => (
                          <div className="flex items-center">
                              <Checkbox id="applyGSTGlobalFreightForm" checked={field.value} onCheckedChange={field.onChange} className="peer sr-only" />
                              <Label htmlFor="applyGSTGlobalFreightForm" className={cn("flex items-center justify-center px-3 py-2 border rounded-md cursor-pointer text-xs font-medium transition-colors h-9", "bg-background hover:bg-accent hover:text-accent-foreground w-full md:w-auto", field.value ? "bg-primary text-primary-foreground hover:bg-primary/90 border-primary" : "border-input")}>
                                  Add GST
                              </Label>
                          </div>
                      )}
                  />
                  <div className="flex flex-col gap-1">
                    <Controller
                        name="additionalPercentageType"
                        control={form.control}
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger className="w-full md:w-24 h-9">
                                    <SelectValue placeholder="Markup" />
                                </SelectTrigger>
                                <SelectContent>
                                    {additionalPercentageOptions.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                  </div>
                  {additionalPercentageType === 'other' && (
                      <div className="space-y-1 pl-1">
                          <Input
                              id="additionalPercentageCustom"
                              type="number"
                              step="0.01"
                              className="h-9 text-xs w-full md:w-32"
                              {...form.register('additionalPercentageCustom', { valueAsNumber: true })}
                              placeholder="Custom %"
                          />
                      </div>
                  )}
                  <div className="space-y-1">
                    <Input
                      id="globalExtras"
                      type="number"
                      step="0.01"
                      className="w-full md:w-24 h-9 text-center text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                      {...form.register('globalExtras', {
                        setValueAs: (v) => (v === '' ? undefined : parseFloat(v)),
                      })}
                      onFocus={(e) => e.target.select()}
                      placeholder="Extra $"
                    />
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddNewItem} className="w-full md:w-auto h-9 text-xs">
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Item
                  </Button>
                   <Button type="button" variant="outline" size="sm" onClick={handleClearLocations} className="w-full md:w-auto h-9 text-xs">
                    Clear Locations
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={handleClearItems} className="w-full md:w-auto h-9 text-xs">
                    Clear Details
                  </Button>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-3">
              <Button type="submit" className="flex-grow md:flex-grow-0 text-lg py-3 px-8 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md font-bold" disabled={overallLoading || (allowedServices.length === 0 && actualRole !== 'superadmin')}>
                {overallLoading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Calculating...
                    </>
                ) : (allowedServices.length === 0 && actualRole !== 'superadmin' ? 'No Services Available' : <><Calculator className="mr-2 h-5 w-5" /> Calculate Prices</>)}
              </Button>

              <Button 
                type="button" 
                variant="outline" 
                className="flex-grow md:flex-grow-0 text-lg py-3 px-8 shadow-sm border-primary/20 hover:bg-primary/5 font-bold" 
                onClick={handleFetchLatestFuelRates} 
                disabled={isUpdatingFuel || overallLoading}
              >
                {isUpdatingFuel ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Fuel className="mr-2 h-5 w-5 text-primary" />
                    Update Fuel Rates
                  </>
                )}
              </Button>
            </div>

            <Card>
              <CardHeader className="p-4 md:p-6">
                  <CardTitle className="text-lg md:text-xl font-bold font-headline">Additional Requirements</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-4 pt-0 p-4 md:p-6">
                  <div className="flex items-center space-x-2"><Controller name="accountTransferRequired" control={control} render={({ field }) => <Checkbox id="at" checked={!!field.value} onCheckedChange={field.onChange} />} /><Label htmlFor="at" className="font-normal cursor-pointer text-xs md:text-sm">Account Transfer</Label></div>
                  <div className="flex items-center space-x-2"><Controller name="afterHoursCollection" control={control} render={({ field }) => <Checkbox id="ahc" checked={!!field.value} onCheckedChange={field.onChange} />} /><Label htmlFor="ahc" className="font-normal cursor-pointer text-xs md:text-sm">After Hours Coll.</Label></div>
                  <div className="flex items-center space-x-2"><Controller name="afterHoursDelivery" control={control} render={({ field }) => <Checkbox id="ahd" checked={!!field.value} onCheckedChange={field.onChange} />} /><Label htmlFor="ahd" className="font-normal cursor-pointer text-xs md:text-sm">After Hours Del.</Label></div>
                  <div className="flex items-center space-x-2"><Controller name="publicHolidayService" control={control} render={({ field }) => <Checkbox id="phs" checked={!!field.value} onCheckedChange={field.onChange} />} /><Label htmlFor="phs" className="font-normal cursor-pointer text-xs md:text-sm">Public Holiday</Label></div>
                  <div className="flex items-center space-x-2"><Controller name="bookInDeliveryRequired" control={control} render={({ field }) => <Checkbox id="bid" checked={!!field.value} onCheckedChange={field.onChange} />} /><Label htmlFor="bid" className="font-normal cursor-pointer text-xs md:text-sm">Book-In Delivery</Label></div>
                  <div className="flex items-center space-x-2"><Controller name="dangerousGoodsConsignment" control={control} render={({ field }) => <Checkbox id="dg" checked={!!field.value} onCheckedChange={field.onChange} />} /><Label htmlFor="dg" className="font-normal cursor-pointer text-xs md:text-sm">Dangerous Goods</Label></div>
                  <div className="flex items-center space-x-2"><Controller name="handUnloadRequired" control={control} render={({ field }) => <Checkbox id="hu" checked={!!field.value} onCheckedChange={field.onChange} />} /><Label htmlFor="hu" className="font-normal cursor-pointer text-xs md:text-sm">Hand Unload Req.</Label></div>
                  <div className="flex items-center space-x-2"><Controller name="routeViaMelbourne" control={control} render={({ field }) => <Checkbox id="rvm" checked={!!field.value} onCheckedChange={field.onChange} />} /><Label htmlFor="rvm" className="font-normal cursor-pointer text-xs md:text-sm">Route via Melb.</Label></div>
                  <div className="flex items-center space-x-2"><Controller name="tailLiftRequired" control={control} render={({ field }) => <Checkbox id="tl" checked={!!field.value} onCheckedChange={field.onChange} />} /><Label htmlFor="tl" className="font-normal cursor-pointer text-xs md:text-sm">Tail Lift Required</Label></div>
              </CardContent>
            </Card>
          </form>

          <div ref={resultsRef}>
            {!overallLoading && showResults && (
              <div className="mt-8 space-y-6">
                <PricingResults 
                  results={calculatedResults} 
                  optimizedResult={optimizedResult} 
                  onOpenEmailQuoteDialog={handleOpenEmailQuoteDialog} 
                  onUpdateWeight={(w) => {
                      setValue('items.0.weight', w);
                      handleSubmit(onSubmit)();
                  }} 
                  initialWeight={getValues('items.0.weight')} 
                  showLcpRates={true} 
                  selectedSpendBand={watch('spendBand')} 
                />
                
                <div className="flex justify-center pt-4">
                  <Button 
                    asChild 
                    size="lg" 
                    className="w-full md:w-auto font-bold"
                  >
                    <a href="https://www.myteamge.com/group/guest/shipment?isEdit=true" target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-5 w-5" /> Book on MyTeamGE
                    </a>
                  </Button>
                </div>
              </div>
            )}
          </div>
          <EmailQuoteDialog 
            isOpen={isEmailQuoteDialogOpen} 
            onOpenChange={setIsEmailQuoteDialogOpen} 
            serviceResult={selectedServiceForQuote} 
            freightFormValues={getValues()} 
          />
        </CardContent>
      </Card>
    </div>
  );
}
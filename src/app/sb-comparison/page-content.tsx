"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { FreightFormValues, PostcodeData, ServiceName, FreightItem, SBComparisonResult, SpendBandPriceEntry, CalculatedPriceItem } from '@/lib/types';
import { ALL_SERVICES, getAllowedServices, PALLET_LIKE_SERVICES } from '@/lib/types'; 
import { sbComparisonFormSchema } from '@/lib/zodSchemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { MapPin, Package, PlusCircle, Trash2, Info, Loader2, Settings2, Truck, Zap, Anchor, BarChartHorizontalBig, Lock } from 'lucide-react';
import LocationAutocomplete from '@/components/freight/LocationAutocomplete';
import { Checkbox } from '@/components/ui/checkbox';
import { useSettings } from '@/context/SettingsContext';
import SBComparisonResults from '@/components/freight/SBComparisonResults';
import { calculateAllFreightPrices } from '@/lib/freightCalculations';
import { useRateOverrides } from '@/context/RateOverrideContext';
import { useAuth } from '@/firebase'; 
import { cn } from '@/lib/utils';

const defaultBlankItem: FreightItem = {
  weight: 0,
  length: undefined,
  width: undefined,
  height: undefined,
  quantity: 1,
};

type SBComparisonFormValues = Omit<FreightFormValues, 'spendBand' | 'globalExtras' | 'additionalPercentageType' | 'additionalPercentageCustom' | 'applyGST'>;

export default function SBComparisonPageContent() {
  const [isLoadingForm, setIsLoadingForm] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [calculatedSBResults, setCalculatedSBResults] = useState<SBComparisonResult[]>([]);
  const { globalSpendBands, serviceSettings, surchargeDefinitions, servicePermissions } = useSettings();
  const { role, company } = useAuth(); 
  const { getRateFile, isLoading: isLoadingRates, areOurRatesLoaded, pezoneData } = useRateOverrides();
  const [itemDimensionsVisibility, setItemDimensionsVisibility] = useState<boolean[]>([false]);

  const allowedServicesForRole = useMemo(() => getAllowedServices(role, servicePermissions), [role, servicePermissions]);

  const showStandardSpendBands = useMemo(() => {
    if (role === 'superadmin') return true;
    // Standardized feature flag check
    return company?.enabledFeatures?.['standard-spend-bands'] !== false;
  }, [role, company]);

  const form = useForm<SBComparisonFormValues>({
    resolver: zodResolver(sbComparisonFormSchema),
    defaultValues: {
      originQuery: '',
      originLocation: null,
      destinationQuery: '',
      destinationLocation: null,
      items: [defaultBlankItem],
      globalNoCubic: false,
      globalOnPallet: false,
      selectedServices: [], 
    },
  });
  
  useEffect(() => {
    if (!form || !form.setValue) return;
    const defaultNonLCPServices = allowedServicesForRole.filter(s => !s.startsWith('LCP'));
    if (allowedServicesForRole.length > 0) {
      form.setValue('selectedServices', defaultNonLCPServices.length > 0 ? defaultNonLCPServices : [...allowedServicesForRole], { shouldValidate: true });
    }
  }, [allowedServicesForRole, form]);

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const { setValue, handleSubmit, watch, getValues } = form;
  const currentSelectedServices = watch('selectedServices') || [];

  const handleAddNewItem = () => {
    append(defaultBlankItem);
    setItemDimensionsVisibility(prev => [...prev, false]);
  };

  const handleRemoveItem = (index: number) => {
    remove(index);
    setItemDimensionsVisibility(prev => prev.filter((_, i) => i !== index));
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

  const onSubmit = async (data: SBComparisonFormValues) => {
    setIsLoadingForm(true);
    setShowResults(false); 

    const finalResults: SBComparisonResult[] = [];
    const servicesToCompare = data.selectedServices.filter(s => allowedServicesForRole.includes(s));

    for (const serviceName of servicesToCompare) {
        const currentServiceSpendBandPrices: SpendBandPriceEntry[] = [];
        let isThisServiceOverallApplicable = false;
        const overallRemarksForThisService: string[] = [];
        
        const spendBandsToUse: string[] = [];
        if (areOurRatesLoaded) spendBandsToUse.push('Customer Rates');
        if (showStandardSpendBands) spendBandsToUse.push(...globalSpendBands);

        for (const sb of spendBandsToUse) {
            const tempFormData: FreightFormValues = {
                ...data,
                spendBand: sb, 
                selectedServices: [serviceName],
                additionalPercentageType: 'none',
                applyGST: false,
                tailLiftRequired: false,
            };

            const singleServiceCalcResults: CalculatedPriceItem[] = await calculateAllFreightPrices({
                formData: tempFormData,
                allServiceSettings: serviceSettings,
                allSurchargeDefinitions: surchargeDefinitions,
                getRateFile,
                pezoneData
            });

            const priceItemForSB = singleServiceCalcResults.find(r => r.serviceName === serviceName || r.serviceName.includes(serviceName));

            if (priceItemForSB) {
                currentServiceSpendBandPrices.push({ spendBand: sb, priceItem: priceItemForSB });
                if (priceItemForSB.isApplicable) isThisServiceOverallApplicable = true;
                 if (!priceItemForSB.isApplicable && overallRemarksForThisService.length === 0 && priceItemForSB.remarks.length > 0) {
                    overallRemarksForThisService.push(...priceItemForSB.remarks);
                }
            }
        }
        finalResults.push({
            serviceName, spendBandPrices: currentServiceSpendBandPrices,
            isOverallApplicable: isThisServiceOverallApplicable,
            overallRemarks: !isThisServiceOverallApplicable && overallRemarksForThisService.length === 0 ? ["Service not applicable for any available spend band."] : overallRemarksForThisService,
        });
    }

    setCalculatedSBResults(finalResults.filter(r => r.isOverallApplicable));
    setIsLoadingForm(false);
    setShowResults(true);
  };

  const handleOriginSelect = (location: PostcodeData | null) => {
    setValue('originLocation', location, { shouldValidate: true });
    setValue('originQuery', location ? `${location.suburb} ${location.state} ${location.postcode}` : '');
  };

  const handleDestinationSelect = (location: PostcodeData | null) => {
    setValue('destinationLocation', location, { shouldValidate: true });
    setValue('destinationQuery', location ? `${location.suburb} ${location.state} ${location.postcode}` : '');
  };

  const handleClearItems = () => {
    replace([defaultBlankItem]);
    setItemDimensionsVisibility([false]);
  };

  const handleClearLocations = () => {
    setValue('originQuery', '', { shouldValidate: true, shouldDirty: true });
    setValue('originLocation', null, { shouldValidate: true, shouldDirty: true });
    setValue('destinationQuery', '', { shouldValidate: true, shouldDirty: true });
    setValue('destinationLocation', null, { shouldValidate: true, shouldDirty: true });
  };

  const handleGroupSelection = (group: ServiceName[], checked: boolean) => {
    const current = getValues('selectedServices') || [];
    let newSelected: ServiceName[];
    const groupInAllowed = group.filter(s => allowedServicesForRole.includes(s));
    if (checked) {
      newSelected = Array.from(new Set([...current, ...groupInAllowed]));
    } else {
      newSelected = current.filter(s => !groupInAllowed.includes(s));
    }
    setValue('selectedServices', newSelected, { shouldValidate: true });
  };

  const areAllGroupServicesSelected = (group: ServiceName[]) => {
      const groupInAllowed = group.filter(s => allowedServicesForRole.includes(s));
      if (groupInAllowed.length === 0) return false;
      return groupInAllowed.every(s => currentSelectedServices.includes(s));
  };

  const overallLoading = isLoadingForm || isLoadingRates;

  return (
    <Card className="w-full shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center text-2xl font-headline">
          <BarChartHorizontalBig className="mr-2 h-7 w-7 text-primary" />
          SB Comparison
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">

          <Card className="w-full border rounded-lg shadow-sm bg-muted/20">
            <CardHeader>
                <CardTitle className="flex items-center text-xl font-semibold">
                    <Settings2 className="mr-2 h-6 w-6 text-primary" />
                    Comparison Options
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
                 <div className="space-y-2">
                    <Label className="flex items-center font-semibold">
                        Services to Compare
                    </Label>
                     {allowedServicesForRole.length > 0 ? (
                        <div className="flex flex-wrap gap-x-4 gap-y-2 items-center p-2 border rounded-md bg-background">
                            <div className="flex items-center space-x-2">
                                <Checkbox id="group-road-sb" checked={areAllGroupServicesSelected(ALL_SERVICES.filter(s => s.includes('Std')))} onCheckedChange={(checked) => handleGroupSelection(ALL_SERVICES.filter(s => s.includes('Std')), Boolean(checked))} />
                                <Label htmlFor="group-road-sb" className="font-medium cursor-pointer flex items-center"><Truck className="mr-1.5 h-4 w-4" />Standard</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="group-priority-sb" checked={areAllGroupServicesSelected(ALL_SERVICES.filter(s => s.includes('Priority')))} onCheckedChange={(checked) => handleGroupSelection(ALL_SERVICES.filter(s => s.includes('Priority')), Boolean(checked))} />
                                <Label htmlFor="group-priority-sb" className="font-medium cursor-pointer flex items-center"><Zap className="mr-1.5 h-4 w-4" />Priority</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="group-pallets-sb" checked={areAllGroupServicesSelected(PALLET_LIKE_SERVICES)} onCheckedChange={(checked) => handleGroupSelection(PALLET_LIKE_SERVICES, Boolean(checked))} />
                                <Label htmlFor="group-pallets-sb" className="font-medium cursor-pointer flex items-center"><Anchor className="mr-1.5 h-4 w-4" />Pallets</Label>
                            </div>
                        </div>
                     ) : (
                        <p className="text-sm text-muted-foreground p-2 border rounded-md bg-background">No services are available for your current user role.</p>
                     )}
                </div>
            </CardContent>
          </Card>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="originQuerySbComparison" className="flex items-center font-semibold">
                <MapPin className="mr-2 h-5 w-5 text-muted-foreground" /> Origin
              </Label>
              <LocationAutocomplete
                inputId="originQuerySbComparison"
                value={watch('originQuery')}
                onValueChange={(value) => setValue('originQuery', value, { shouldValidate: true, shouldDirty: true })}
                onLocationSelect={handleOriginSelect}
                placeholder="Enter suburb or postcode"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="destinationQuerySbComparison" className="flex items-center font-semibold">
                <MapPin className="mr-2 h-5 w-5 text-muted-foreground" /> Destination
              </Label>
              <LocationAutocomplete
                inputId="destinationQuerySbComparison"
                value={watch('destinationQuery')}
                onValueChange={(value) => setValue('destinationQuery', value, { shouldValidate: true, shouldDirty: true })}
                onLocationSelect={handleDestinationSelect}
                placeholder="Enter suburb or postcode"
              />
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center">
                <Package className="mr-2 h-5 w-5 text-muted-foreground" /> Item Details
            </h3>
            {fields.map((item, index) => (
              <Card key={item.id} className="mb-4 p-4 border rounded-lg shadow-sm bg-muted/20">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-2 items-end">
                  <div className="space-y-1">
                    <Label htmlFor={`items.${index}.weight`} className="text-sm font-medium">Weight (kg)</Label>
                    <div className="flex items-center gap-2">
                        <Input id={`items.${index}.weight`} type="number" {...form.register(`items.${index}.weight`, { valueAsNumber: true })} onFocus={(e) => e.target.select()} placeholder="0" className="w-full" />
                        <Button type="button" variant="outline" size="sm" onClick={() => toggleItemDimensions(index)}>
                            {itemDimensionsVisibility[index] ? 'Hide Dims' : 'Add Dims'}
                        </Button>
                    </div>
                  </div>

                    {itemDimensionsVisibility[index] && (
                        <>
                            <div className="space-y-1">
                                <Label htmlFor={`items.${index}.length`} className="text-sm font-medium">L (cm)</Label>
                                <Input id={`items.${index}.length`} type="number" step="0.1" className="w-full" {...form.register(`items.${index}.length`)} onFocus={(e) => e.target.select()} placeholder="0" />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor={`items.${index}.width`} className="text-sm font-medium">W (cm)</Label>
                                <Input id={`items.${index}.width`} type="number" step="0.1" className="w-full" {...form.register(`items.${index}.width`)} onFocus={(e) => e.target.select()} placeholder="0" />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor={`items.${index}.height`} className="text-sm font-medium">H (cm)</Label>
                                <Input id={`items.${index}.height`} type="number" step="0.1" className="w-full" {...form.register(`items.${index}.height`)} onFocus={(e) => e.target.select()} placeholder="0" />
                            </div>
                        </>
                    )}

                  <div className="space-y-1">
                    <Label htmlFor={`items.${index}.quantity`} className="text-sm font-medium">Quantity</Label>
                    <Input id={`items.${index}.quantity`} type="number" step="1" className="w-full" {...form.register(`items.${index}.quantity`, { valueAsNumber: true })} onFocus={(e) => e.target.select()} placeholder="1" />
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
                            <Checkbox id="globalOnPalletSb" checked={field.value} onCheckedChange={field.onChange} className="peer sr-only" />
                            <Label htmlFor="globalOnPalletSb" className={cn("flex items-center justify-center px-3 py-2 border rounded-md cursor-pointer text-xs font-medium transition-colors h-9", "bg-background hover:bg-accent hover:text-accent-foreground w-full md:w-auto", field.value ? "bg-primary text-primary-foreground hover:bg-primary/90 border-primary" : "border-input")}>
                                On Pallet
                            </Label>
                        </div>
                    )}
                />
                <Button type="button" variant="outline" size="sm" onClick={handleAddNewItem} className="w-full md:w-auto h-9">Add Item</Button>
                <Button type="button" variant="outline" size="sm" onClick={handleClearItems} className="w-full md:w-auto h-9">Clear Details</Button>
                <Button type="button" variant="outline" size="sm" onClick={handleClearLocations} className="w-full md:w-auto h-9">Clear Locations</Button>
            </div>
          </div>

          <Separator />

          <Button type="submit" className="w-full md:w-auto text-lg py-3 px-6 bg-accent hover:bg-accent/90 text-accent-foreground" disabled={overallLoading || allowedServicesForRole.length === 0}>
            {overallLoading ? (
                <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {isLoadingRates ? 'Loading Rates...' : 'Calculating Comparison...'}
                </>
            ) : (allowedServicesForRole.length === 0 ? 'No Services Available' : 'Compare')}
          </Button>
        </form>

        {overallLoading && !showResults && (
          <div className="mt-8 flex flex-col items-center justify-center space-y-2 py-10">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg text-muted-foreground">{isLoadingRates ? 'Loading rate data...' : 'Generating comparison...'}</p>
          </div>
        )}

        {!overallLoading && showResults && (
          <div className="mt-8">
            <SBComparisonResults results={calculatedSBResults} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { PostcodeData, ServiceName } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { Sparkles, Loader2, Printer, Trash2, CheckCircle2, Building, MapPin, Package, Route, Plus, RotateCcw, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRateOverrides } from '@/context/RateOverrideContext';
import { useSettings } from '@/context/SettingsContext';
import { calculateAllFreightPrices } from '@/lib/freightCalculations';
import { perfectPlanSchema } from '@/lib/zodSchemas';
import WizardInput from '@/components/ai-guru/WizardInput';
import GuruHistory from '@/components/ai-guru/GuruHistory';
import GuruResults from '@/components/ai-guru/GuruResults';
import ServiceLegsFieldArray from '@/components/ai-guru/ServiceLegsFieldArray';
import { useSpeechRecognition } from '@/hooks/use-speech-recognition';
import { cn } from '@/lib/utils';

type GuruFormValues = z.infer<typeof perfectPlanSchema>;
type ViewMode = 'history' | 'form' | 'results';

function FormSection({ 
  title, 
  icon,
  children, 
  isComplete, 
  isActive, 
  isHidden 
}: { 
  title: string; 
  icon: React.ReactNode;
  children: React.ReactNode; 
  isComplete?: boolean; 
  isActive?: boolean; 
  isHidden?: boolean 
}) {
  if (isHidden) return null;
  
  return (
    <fieldset className={cn(
      "space-y-4 rounded-xl border p-5 transition-all duration-300 bg-card shadow-sm",
      isActive && "ring-2 ring-primary/40 border-primary/50 shadow-md",
      "animate-in fade-in slide-in-from-top-2"
    )}>
      <legend className="flex items-center gap-2 px-2 text-base font-semibold">
        {isComplete ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
        ) : isActive ? (
          <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0" />
        ) : (
          <div className="h-5 w-5 rounded-full border-2 border-muted shrink-0" />
        )}
        <span className="flex items-center gap-2 text-foreground font-headline">
          {icon}
          {title}
        </span>
      </legend>
      <div className={cn("transition-opacity", !isActive && !isComplete && "opacity-80")}>
        {children}
      </div>
    </fieldset>
  );
}

export default function AIGuruPageContent() {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>('history');
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [comparisonHistory, setComparisonHistory] = useState<GuruFormValues[]>([]);
  const [currentWizardField, setCurrentWizardField] = useState<string>('none');
  const [isCalculating, setIsCalculating] = useState(false);
  
  const { serviceSettings, surchargeDefinitions, perfectPlanPalletRate, perfectPlanParcelRate, perfectPlanSatchelRate } = useSettings();
  const { getRateFile, isLoading: areRatesLoading, pezoneData } = useRateOverrides();
  const [allPostcodes, setAllPostcodes] = useState<PostcodeData[]>([]);
  const { transcript, listening, isSupported, startListening, stopListening } = useSpeechRecognition();

  const servicesForSelection: ServiceName[] = ['LCP Std', 'B2B Std', 'B2C Std', 'LCP Priority', 'B2B Priority', 'B2C Priority', 'WA PE Special', 'B2B Pallets General Tiered', 'B2B Pallets Express'];

  const form = useForm<GuruFormValues>({
    resolver: zodResolver(perfectPlanSchema),
    defaultValues: { customerName: '', originLocationQuery: '', originLocation: null, palletsPerWeek: 0, parcelsPerWeek: 0, satchelsPerWeek: 0, monthlySpend: 0, destinations: [], addressType: 'Business', distributionArea: 'Both' },
  });

  const { control, setValue, watch, handleSubmit } = form;
  const { fields: destinationFields, append: appendDestination, remove: removeDestination } = useFieldArray({ control, name: 'destinations' });

  const customerName = watch('customerName');
  const originLocation = watch('originLocation');
  const destinations = watch('destinations');
  const palletsPerWeek = watch('palletsPerWeek');
  const parcelsPerWeek = watch('parcelsPerWeek');
  const satchelsPerWeek = watch('satchelsPerWeek');
  const monthlySpend = watch('monthlySpend');

  const hasCustomer = !!customerName && customerName.trim().length >= 2;
  const hasOrigin = !!originLocation;
  const hasVolumes = (palletsPerWeek || 0) > 0 || (parcelsPerWeek || 0) > 0 || (satchelsPerWeek || 0) > 0 || (monthlySpend || 0) > 0;
  const hasDestinations = Array.isArray(destinations) && destinations.length > 0 && destinations.some(d => !!d.destinationLocation || (d.destinationQuery && d.destinationQuery.trim().length >= 2));

  const completedSections = useMemo(() => {
    return [hasCustomer, hasOrigin, hasVolumes, hasDestinations].filter(Boolean).length;
  }, [hasCustomer, hasOrigin, hasVolumes, hasDestinations]);

  // Auto-append initial destination when origin is selected and destinations is empty
  useEffect(() => {
    if (hasOrigin && destinationFields.length === 0) {
      appendDestination({ 
        id: `dest-${Date.now()}`, 
        destinationQuery: '', 
        destinationLocation: null, 
        serviceLegs: [{ id: `leg-${Date.now()}`, service: 'B2B Priority', averageWeight: 5, targetPrice: 0 }] 
      });
    }
  }, [hasOrigin, destinationFields.length, appendDestination]);

  useEffect(() => {
    if (transcript && currentWizardField !== 'none') {
      setValue(currentWizardField as any, transcript, { shouldValidate: true });
      setCurrentWizardField('none');
    }
  }, [transcript, currentWizardField, setValue]);

  const handleVoiceInput = (fieldName: string) => {
    if (listening && currentWizardField === fieldName) {
      stopListening();
      setCurrentWizardField('none');
    } else {
      setCurrentWizardField(fieldName);
      startListening();
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem('perfectPlanHistory');
    if (stored) setComparisonHistory(JSON.parse(stored));
    fetch('/api/postcodes').then(res => res.json()).then(setAllPostcodes).catch(() => {});
  }, []);

  const handleFormKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.target instanceof HTMLInputElement && e.target.type !== 'submit') {
      e.preventDefault();
      const elements = Array.from(e.currentTarget.querySelectorAll('input, select, textarea, button:not([tabindex="-1"])')) as HTMLElement[];
      const index = elements.indexOf(e.target);
      if (index > -1 && elements[index + 1]) {
        elements[index + 1].focus();
      }
    }
  };

  const onSubmit = async (data: GuruFormValues) => {
    if (areRatesLoading) return;
    setIsCalculating(true);
    try {
      const weeklySpend = (data.palletsPerWeek || 0) * perfectPlanPalletRate + (data.parcelsPerWeek || 0) * perfectPlanParcelRate + (data.satchelsPerWeek || 0) * perfectPlanSatchelRate;
      let finalMonthlySpend = weeklySpend * 4.3;
      if (data.monthlySpend && Math.abs(finalMonthlySpend - data.monthlySpend) / data.monthlySpend <= 0.1) finalMonthlySpend = data.monthlySpend;
      
      const annualSpend = finalMonthlySpend * 12;
      const band = annualSpend < 50000 ? '1' : annualSpend < 200000 ? '2' : annualSpend < 350000 ? '3' : annualSpend < 500000 ? '4' : '5';

      const results = [];
      for (const dest of data.destinations) {
        const legs = [];
        for (const leg of dest.serviceLegs) {
          const calcRes = await calculateAllFreightPrices({
            formData: { ...data, spendBand: band, originLocation: data.originLocation, destinationLocation: dest.destinationLocation, items: [{ weight: leg.averageWeight, quantity: 1 }], selectedServices: [leg.service] } as any,
            allServiceSettings: serviceSettings, allSurchargeDefinitions: surchargeDefinitions, getRateFile, pezoneData
          });
          const price = calcRes.find(r => r.serviceName.includes(leg.service));
          legs.push({ serviceName: leg.service, weight: leg.averageWeight, targetPrice: leg.targetPrice, tgePrice: price?.finalPrice ?? null, savings: price?.finalPrice ? leg.targetPrice - price.finalPrice : null, calculationFormula: price?.calculationFormula });
        }
        results.push({ destination: dest.destinationQuery, legs });
      }

      setAnalysisResult({ analysis: { calculatedMonthlySpend: finalMonthlySpend, recommendedSpendBand: band, spendSource: data.monthlySpend ? 'User-provided' : 'Calculated' }, pricingByOrigin: [{ originName: data.originLocationQuery, results }] });
      
      const history = [ { ...data, date: new Date().toISOString() }, ...comparisonHistory.slice(0, 19)];
      localStorage.setItem('perfectPlanHistory', JSON.stringify(history));
      setComparisonHistory(history);
      setViewMode('results');
    } catch (e) {
      toast({ title: 'Calculation Failed', description: 'Could not compute rate options.', variant: 'destructive' });
    } finally {
      setIsCalculating(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {viewMode === 'history' && (
        <GuruHistory 
          history={comparisonHistory} 
          isLoading={areRatesLoading} 
          onStartNew={() => { form.reset(); setViewMode('form'); }} 
          onLoad={(entry) => { form.reset(entry); setViewMode('form'); }} 
          onDelete={(idx) => {
            const newHist = [...comparisonHistory]; newHist.splice(idx, 1);
            localStorage.setItem('perfectPlanHistory', JSON.stringify(newHist)); setComparisonHistory(newHist);
          }} 
        />
      )}

      {viewMode === 'results' && analysisResult && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-card p-4 rounded-xl border shadow-sm print-hide">
            <Button variant="outline" onClick={() => setViewMode('form')}>
              <RotateCcw className="mr-2 h-4 w-4" /> Edit / Adjust Plan
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" /> Print Plan Report
              </Button>
              <Button onClick={() => { form.reset(); setViewMode('form'); }}>
                Start New Plan <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
          <GuruResults analysis={analysisResult.analysis} pricingByOrigin={analysisResult.pricingByOrigin} />
        </div>
      )}

      {viewMode === 'form' && (
        <Card className="shadow-xl border-primary/20">
          <div className="sticky top-0 bg-background/95 backdrop-blur z-20 px-6 py-4 border-b rounded-t-xl">
            <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Perfect Plan Progress
              </span>
              <span>{completedSections} of 4 Sections Complete</span>
            </div>
            <Progress value={(completedSections / 4) * 100} className="h-2.5" />
          </div>

          <form onSubmit={handleSubmit(onSubmit)} onKeyDown={handleFormKeyDown}>
            <CardContent className="space-y-8 p-6">
              
              {/* SECTION 1: Customer Information */}
              <FormSection 
                title="1. Customer Information" 
                icon={<Building className="h-5 w-5 text-primary" />}
                isComplete={hasCustomer}
                isActive={!hasCustomer}
              >
                <div className="space-y-2">
                  <Label htmlFor="customerName" className="font-medium">Customer / Business Name</Label>
                  <WizardInput 
                    fieldName="customerName" 
                    placeholder="e.g. Acme Freight Solutions"
                    form={form} 
                    handleVoiceInput={handleVoiceInput} 
                    isSupported={isSupported} 
                    listening={listening} 
                    currentWizardField={currentWizardField} 
                    autoFocus 
                  />
                </div>
              </FormSection>

              {/* SECTION 2: Sending Location */}
              <FormSection 
                title="2. Sending Location" 
                icon={<MapPin className="h-5 w-5 text-primary" />}
                isComplete={hasOrigin}
                isActive={hasCustomer && !hasOrigin}
                isHidden={!hasCustomer}
              >
                <div className="space-y-2">
                  <Label htmlFor="originLocationQuery" className="font-medium">Origin Suburb or Postcode</Label>
                  <WizardInput 
                    fieldName="originLocationQuery" 
                    isLocation 
                    placeholder="Type suburb or postcode (e.g. Perth 6000)..."
                    form={form} 
                    handleVoiceInput={handleVoiceInput} 
                    isSupported={isSupported} 
                    listening={listening} 
                    currentWizardField={currentWizardField} 
                    allPostcodes={allPostcodes} 
                    onLocationSelect={(l) => { 
                      setValue('originLocation', l, { shouldValidate: true }); 
                      if (l) setValue('originLocationQuery', `${l.suburb} ${l.state} ${l.postcode}`); 
                    }} 
                  />
                </div>
              </FormSection>

              {/* SECTION 3: Freight Volumes & Profile */}
              <FormSection 
                title="3. Freight Volumes & Profile" 
                icon={<Package className="h-5 w-5 text-primary" />}
                isComplete={hasVolumes}
                isActive={hasOrigin && !hasVolumes}
                isHidden={!hasOrigin}
              >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Pallets / Week</Label>
                    <WizardInput type="number" fieldName="palletsPerWeek" label="Pallets/wk" form={form} handleVoiceInput={handleVoiceInput} isSupported={isSupported} listening={listening} currentWizardField={currentWizardField} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Parcels / Week</Label>
                    <WizardInput type="number" fieldName="parcelsPerWeek" label="Parcels/wk" form={form} handleVoiceInput={handleVoiceInput} isSupported={isSupported} listening={listening} currentWizardField={currentWizardField} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Satchels / Week</Label>
                    <WizardInput type="number" fieldName="satchelsPerWeek" label="Satchels/wk" form={form} handleVoiceInput={handleVoiceInput} isSupported={isSupported} listening={listening} currentWizardField={currentWizardField} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Est. Monthly Spend ($)</Label>
                    <WizardInput type="number" fieldName="monthlySpend" label="Monthly Spend ($)" form={form} handleVoiceInput={handleVoiceInput} isSupported={isSupported} listening={listening} currentWizardField={currentWizardField} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/50">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Address Receiver Type</Label>
                    <Controller 
                      name="addressType" 
                      control={control} 
                      render={({ field }) => (
                        <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-6">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="Business" id="bus" />
                            <Label htmlFor="bus" className="cursor-pointer">Business</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="Residential" id="res" />
                            <Label htmlFor="res" className="cursor-pointer">Residential</Label>
                          </div>
                        </RadioGroup>
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Primary Distribution Scope</Label>
                    <Controller 
                      name="distributionArea" 
                      control={control} 
                      render={({ field }) => (
                        <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-6">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="Both" id="both" />
                            <Label htmlFor="both" className="cursor-pointer">Both / National</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="Metro" id="metro" />
                            <Label htmlFor="metro" className="cursor-pointer">Metro</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="Regional" id="reg" />
                            <Label htmlFor="reg" className="cursor-pointer">Regional</Label>
                          </div>
                        </RadioGroup>
                      )} 
                    />
                  </div>
                </div>
              </FormSection>

              {/* SECTION 4: Key Destinations & Service Legs */}
              <FormSection 
                title="4. Key Destinations & Service Legs" 
                icon={<Route className="h-5 w-5 text-primary" />}
                isComplete={hasDestinations}
                isActive={hasOrigin && !hasDestinations}
                isHidden={!hasOrigin}
              >
                <div className="space-y-4">
                  {destinationFields.map((dest, i) => (
                    <Card key={dest.id} className="p-4 bg-muted/20 border-border/60">
                      <div className="flex justify-between items-center mb-3 border-b pb-2">
                        <Label className="font-bold text-sm">Destination {i + 1}</Label>
                        {destinationFields.length > 1 && (
                          <Button variant="ghost" size="sm" onClick={() => removeDestination(i)} className="text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-4 w-4 mr-1" /> Remove
                          </Button>
                        )}
                      </div>
                      <div className="space-y-3">
                        <Label className="text-xs">Destination Location</Label>
                        <WizardInput 
                          fieldName={`destinations.${i}.destinationQuery`} 
                          isLocation 
                          placeholder="Search destination suburb or postcode..."
                          form={form} 
                          handleVoiceInput={handleVoiceInput} 
                          isSupported={isSupported} 
                          listening={listening} 
                          currentWizardField={currentWizardField} 
                          allPostcodes={allPostcodes} 
                          onLocationSelect={(l) => { 
                            setValue(`destinations.${i}.destinationLocation`, l, { shouldValidate: true }); 
                            if (l) setValue(`destinations.${i}.destinationQuery`, `${l.suburb} ${l.state} ${l.postcode}`); 
                          }} 
                        />
                        <ServiceLegsFieldArray control={control} destIndex={i} servicesForSelection={servicesForSelection} />
                      </div>
                    </Card>
                  ))}

                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => appendDestination({ 
                      id: `dest-${Date.now()}`, 
                      destinationQuery: '', 
                      destinationLocation: null, 
                      serviceLegs: [{ id: `leg-${Date.now()}`, service: 'B2B Priority', averageWeight: 5, targetPrice: 0 }] 
                    })} 
                    className="w-full border-dashed"
                  >
                    <Plus className="mr-2 h-4 w-4" /> Add Destination Route
                  </Button>
                </div>
              </FormSection>

            </CardContent>

            <CardFooter className="sticky bottom-0 bg-background/95 backdrop-blur border-t p-4 flex justify-between items-center rounded-b-xl z-20">
              <Button type="button" variant="ghost" onClick={() => setViewMode('history')}>
                Cancel / View History
              </Button>
              <Button type="submit" size="lg" disabled={!hasCustomer || !hasOrigin || isCalculating} className="font-semibold shadow-md">
                {isCalculating ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Calculating Perfect Plan...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" /> Generate Perfect Plan
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}
    </div>
  );
}
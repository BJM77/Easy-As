"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { Card } from '@/components/ui/card';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { PostcodeData, ServiceName, FreightFormValues } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ArrowRight, Sparkles, Loader2, Save, Printer, Edit, Trash2 } from 'lucide-react';
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
import { formatCurrency } from '@/lib/utils';

type GuruFormValues = z.infer<typeof perfectPlanSchema>;
type WizardStep = 'closed' | 'customerName' | 'sendingLocation' | 'volumes' | 'distributionProfile' | 'destinations' | 'summary' | 'calculating' | 'results';

export default function AIGuruPageContent() {
  const { toast } = useToast();
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [wizardStep, setWizardStep] = useState<WizardStep>('closed');
  const [comparisonHistory, setComparisonHistory] = useState<GuruFormValues[]>([]);
  const [currentWizardField, setCurrentWizardField] = useState<string>('none');
  
  const { serviceSettings, surchargeDefinitions, globalSpendBands, perfectPlanPalletRate, perfectPlanParcelRate, perfectPlanSatchelRate } = useSettings();
  const { getRateFile, isLoading: areRatesLoading, pezoneData } = useRateOverrides();
  const [allPostcodes, setAllPostcodes] = useState<PostcodeData[]>([]);
  const { transcript, listening, isSupported, startListening, stopListening } = useSpeechRecognition();

  const servicesForSelection: ServiceName[] = ['LCP Std', 'B2B Std', 'B2C Std', 'LCP Priority', 'B2B Priority', 'B2C Priority', 'WA PE Special', 'B2B Pallets General Tiered', 'B2B Pallets Express'];

  const form = useForm<GuruFormValues>({
    resolver: zodResolver(perfectPlanSchema),
    defaultValues: { customerName: '', originLocationQuery: '', originLocation: null, palletsPerWeek: 0, parcelsPerWeek: 0, satchelsPerWeek: 0, monthlySpend: 0, destinations: [], addressType: 'Business', distributionArea: 'Both' },
  });

  const { control, trigger, getValues, setValue, formState } = form;
  const { fields: destinationFields, append: appendDestination, remove: removeDestination } = useFieldArray({ control, name: 'destinations' });

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

  const nextStep = useCallback(async () => {
    const stepOrder: WizardStep[] = ['customerName', 'sendingLocation', 'volumes', 'distributionProfile', 'destinations', 'summary'];
    const currentIndex = stepOrder.indexOf(wizardStep);
    let proceed = await trigger(wizardStep === 'destinations' ? 'destinations' : wizardStep as any);

    if (!proceed) return toast({ title: 'Validation Error', variant: 'destructive' });

    if (currentIndex < stepOrder.length - 1) {
      if (stepOrder[currentIndex + 1] === 'destinations' && destinationFields.length === 0) {
        appendDestination({ id: `dest-${Date.now()}`, destinationQuery: '', destinationLocation: null, serviceLegs: [{ id: `leg-${Date.now()}`, service: 'B2B Priority', averageWeight: 0, targetPrice: 0 }] });
      }
      setWizardStep(stepOrder[currentIndex + 1]);
    }
  }, [wizardStep, trigger, destinationFields, appendDestination, toast]);

  const onSubmit = async (data: GuruFormValues) => {
    if (areRatesLoading) return;
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
      setWizardStep('results');
    } catch (e) {
      toast({ title: 'Calculation Failed', variant: 'destructive' });
      setWizardStep('summary');
    }
  };

  return (
    <div className="space-y-8">
      {wizardStep === 'closed' && (
        <GuruHistory 
          history={comparisonHistory} 
          isLoading={areRatesLoading} 
          onStartNew={() => setWizardStep('customerName')} 
          onLoad={(entry) => { form.reset(entry); setWizardStep('summary'); }} 
          onDelete={(idx) => {
            const newHist = [...comparisonHistory]; newHist.splice(idx, 1);
            localStorage.setItem('perfectPlanHistory', JSON.stringify(newHist)); setComparisonHistory(newHist);
          }} 
        />
      )}

      <Dialog open={wizardStep !== 'closed'} onOpenChange={(open) => !open && setWizardStep('closed')}>
        <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] flex flex-col shadow-2xl border-primary/20">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-3xl font-black font-headline text-primary tracking-tight">Perfect Plan Assistant</DialogTitle>
            <DialogDescription className="text-xs uppercase tracking-[0.2em] font-black text-muted-foreground/60">{wizardStep.replace(/([A-Z])/g, ' $1').toLowerCase()}</DialogDescription>
          </DialogHeader>
          
          <div className="flex-grow overflow-y-auto pr-4 -mr-4 space-y-8 py-8">
            {wizardStep === 'customerName' && (
                <div className="space-y-4 max-w-4xl mx-auto">
                    <Label className="text-[10px] font-black uppercase tracking-[0.1em] text-primary">Prospect / Company Name</Label>
                    <WizardInput fieldName='customerName' form={form} handleVoiceInput={handleVoiceInput} isSupported={isSupported} listening={listening} currentWizardField={currentWizardField} autoFocus onLocationSelect={()=>{}} allPostcodes={[]} className="h-16 text-2xl font-bold shadow-sm" />
                    <p className="text-[10px] text-muted-foreground italic">Enter the name of the business you are analyzing.</p>
                </div>
            )}
            
            {wizardStep === 'sendingLocation' && (
                <div className="space-y-4 max-w-4xl mx-auto">
                    <Label className="text-[10px] font-black uppercase tracking-[0.1em] text-primary">Origin Location</Label>
                    <WizardInput fieldName='originLocationQuery' form={form} handleVoiceInput={handleVoiceInput} isSupported={isSupported} listening={listening} currentWizardField={currentWizardField} isLocation autoFocus allPostcodes={allPostcodes} onLocationSelect={(l) => { setValue('originLocation', l, { shouldValidate: true }); if (l) setValue('originLocationQuery', `${l.suburb} ${l.state} ${l.postcode}`); }} className="h-16 text-2xl font-bold shadow-sm" />
                    <p className="text-[10px] text-muted-foreground italic">Where is this prospect primarily shipping from?</p>
                </div>
            )}

            {wizardStep === 'volumes' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                    <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Weekly Pallets</Label>
                        <WizardInput type="number" fieldName='palletsPerWeek' form={form} handleVoiceInput={handleVoiceInput} isSupported={isSupported} listening={listening} currentWizardField={currentWizardField} className="h-14 text-xl font-bold" />
                    </div>
                    <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Weekly Parcels</Label>
                        <WizardInput type="number" fieldName='parcelsPerWeek' form={form} handleVoiceInput={handleVoiceInput} isSupported={isSupported} listening={listening} currentWizardField={currentWizardField} className="h-14 text-xl font-bold" />
                    </div>
                    <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Weekly Satchels</Label>
                        <WizardInput type="number" fieldName='satchelsPerWeek' form={form} handleVoiceInput={handleVoiceInput} isSupported={isSupported} listening={listening} currentWizardField={currentWizardField} className="h-14 text-xl font-bold" />
                    </div>
                    <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Monthly Spend ($)</Label>
                        <WizardInput type="number" fieldName='monthlySpend' form={form} handleVoiceInput={handleVoiceInput} isSupported={isSupported} listening={listening} currentWizardField={currentWizardField} className="h-14 text-xl font-bold" />
                    </div>
                </div>
            )}
            {wizardStep === 'distributionProfile' && (
                <div className="space-y-6 max-w-4xl mx-auto py-4">
                    <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Delivery Type</Label>
                        <Controller name="addressType" control={control} render={({ field }) => (
                            <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-8">
                                <div className="flex items-center space-x-3 bg-muted/30 p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
                                    <RadioGroupItem value="Residential" id="res"/>
                                    <Label htmlFor="res" className="font-bold cursor-pointer">Residential</Label>
                                </div>
                                <div className="flex items-center space-x-3 bg-muted/30 p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
                                    <RadioGroupItem value="Business" id="bus"/>
                                    <Label htmlFor="bus" className="font-bold cursor-pointer">Business</Label>
                                </div>
                            </RadioGroup>
                        )}/>
                    </div>
                    
                    <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Service Region</Label>
                        <Controller name="distributionArea" control={control} render={({ field }) => (
                            <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-8">
                                <div className="flex items-center space-x-3 bg-muted/30 p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
                                    <RadioGroupItem value="Metro" id="metro"/>
                                    <Label htmlFor="metro" className="font-bold cursor-pointer">Metro Focus</Label>
                                </div>
                                <div className="flex items-center space-x-3 bg-muted/30 p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
                                    <RadioGroupItem value="Regional" id="reg"/>
                                    <Label htmlFor="reg" className="font-bold cursor-pointer">Regional Focus</Label>
                                </div>
                            </RadioGroup>
                        )} />
                    </div>
                </div>
            )}
            {wizardStep === 'destinations' && (
                <div className="space-y-6 max-w-4xl mx-auto">
                    <div className="space-y-4">
                        {destinationFields.map((dest, i) => (
                            <Card key={dest.id} className="p-6 bg-muted/30 border-primary/10 shadow-sm relative overflow-hidden group">
                                <div className="absolute left-0 top-0 w-1 h-full bg-primary opacity-20 group-hover:opacity-100 transition-opacity" />
                                <div className="flex justify-between items-center mb-4">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-black">DEST {i+1}</Badge>
                                        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Target Destination & Legs</Label>
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => removeDestination(i)}>
                                        <Trash2 className="h-4 w-4"/>
                                    </Button>
                                </div>
                                <div className="space-y-4">
                                    <WizardInput 
                                        fieldName={`destinations.${i}.destinationQuery`} 
                                        isLocation 
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
                                        placeholder="Where to? (e.g. Sydney NSW 2000)"
                                        className="h-12 font-semibold"
                                    />
                                    <ServiceLegsFieldArray control={control} destIndex={i} servicesForSelection={servicesForSelection}/>
                                </div>
                            </Card>
                        ))}
                    </div>
                    <Button variant="outline" className="w-full border-dashed h-12 text-primary font-black uppercase tracking-widest hover:bg-primary/5" onClick={() => appendDestination({ id: `dest-${Date.now()}`, destinationQuery: '', destinationLocation: null, serviceLegs: [{ id: `leg-${Date.now()}`, service: 'B2B Priority', averageWeight: 0, targetPrice: 0 }] })}>
                        + Add Destination Zone
                    </Button>
                </div>
            )}
            {wizardStep === 'results' && analysisResult && <GuruResults analysis={analysisResult.analysis} pricingByOrigin={analysisResult.pricingByOrigin} />}
          </div>

          <DialogFooter className="border-t pt-4">
            <div className="flex justify-between w-full">
              <Button variant="ghost" onClick={() => setWizardStep('closed')}>Cancel</Button>
              {['results'].includes(wizardStep) ? (
                <div className="flex gap-2"><Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4"/>Print</Button><Button onClick={() => setWizardStep('customerName')}>Start New</Button></div>
              ) : wizardStep === 'summary' ? (
                <Button onClick={() => { setWizardStep('calculating'); onSubmit(getValues()); }}>Generate Perfect Plan</Button>
              ) : (
                <Button onClick={nextStep}>Next <ArrowRight className="ml-2 h-4 w-4"/></Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
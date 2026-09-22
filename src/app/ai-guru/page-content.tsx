"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { PostcodeData, ServiceName, FreightFormValues } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Perfect Plan Assistant</DialogTitle>
            <DialogDescription>{wizardStep.replace(/([A-Z])/g, ' $1').toLowerCase()}</DialogDescription>
          </DialogHeader>
          
          <div className="flex-grow overflow-y-auto pr-4 -mr-4 space-y-4">
            {wizardStep === 'customerName' && <WizardInput fieldName='customerName' form={form} handleVoiceInput={handleVoiceInput} isSupported={isSupported} listening={listening} currentWizardField={currentWizardField} autoFocus onLocationSelect={()=>{}} allPostcodes={[]} />}
            {wizardStep === 'sendingLocation' && <WizardInput fieldName='originLocationQuery' form={form} handleVoiceInput={handleVoiceInput} isSupported={isSupported} listening={listening} currentWizardField={currentWizardField} isLocation autoFocus allPostcodes={allPostcodes} onLocationSelect={(l) => { setValue('originLocation', l, { shouldValidate: true }); if (l) setValue('originLocationQuery', `${l.suburb} ${l.state} ${l.postcode}`); }} />}
            {wizardStep === 'volumes' && <div className="grid grid-cols-2 gap-4"><WizardInput type="number" fieldName='palletsPerWeek' label="Pallets/wk" form={form} handleVoiceInput={handleVoiceInput} isSupported={isSupported} listening={listening} currentWizardField={currentWizardField} /><WizardInput type="number" fieldName='parcelsPerWeek' label="Parcels/wk" form={form} handleVoiceInput={handleVoiceInput} isSupported={isSupported} listening={listening} currentWizardField={currentWizardField} /><WizardInput type="number" fieldName='satchelsPerWeek' label="Satchels/wk" form={form} handleVoiceInput={handleVoiceInput} isSupported={isSupported} listening={listening} currentWizardField={currentWizardField} /><WizardInput type="number" fieldName='monthlySpend' label="User Spend ($)" form={form} handleVoiceInput={handleVoiceInput} isSupported={isSupported} listening={listening} currentWizardField={currentWizardField} /></div>}
            {wizardStep === 'distributionProfile' && <div className="space-y-4"><Controller name="addressType" control={control} render={({ field }) => (<RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4"><div className="flex items-center space-x-2"><RadioGroupItem value="Residential" id="res"/><Label htmlFor="res">Residential</Label></div><div className="flex items-center space-x-2"><RadioGroupItem value="Business" id="bus"/><Label htmlFor="bus">Business</Label></div></RadioGroup>)}/><Controller name="distributionArea" control={control} render={({ field }) => (<RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4"><div className="flex items-center space-x-2"><RadioGroupItem value="Metro" id="metro"/><Label htmlFor="metro">Metro</Label></div><div className="flex items-center space-x-2"><RadioGroupItem value="Regional" id="reg"/><Label htmlFor="reg">Regional</Label></div></RadioGroup>)} /></div>}
            {wizardStep === 'destinations' && <div className="space-y-4">{destinationFields.map((dest, i) => (<Card key={dest.id} className="p-4 bg-muted/30"><div className="flex justify-between mb-2"><Label>Destination {i+1}</Label><Button variant="ghost" size="icon" onClick={() => removeDestination(i)}><Trash2 className="h-4 w-4"/></Button></div><WizardInput fieldName={`destinations.${i}.destinationQuery`} isLocation form={form} handleVoiceInput={handleVoiceInput} isSupported={isSupported} listening={listening} currentWizardField={currentWizardField} allPostcodes={allPostcodes} onLocationSelect={(l) => { setValue(`destinations.${i}.destinationLocation`, l, { shouldValidate: true }); if (l) setValue(`destinations.${i}.destinationQuery`, `${l.suburb} ${l.state} ${l.postcode}`); }} /><ServiceLegsFieldArray control={control} destIndex={i} servicesForSelection={servicesForSelection}/></Card>))}<Button variant="outline" onClick={() => appendDestination({ id: `dest-${Date.now()}`, destinationQuery: '', destinationLocation: null, serviceLegs: [{ id: `leg-${Date.now()}`, service: 'B2B Priority', averageWeight: 0, targetPrice: 0 }] })}>Add Destination</Button></div>}
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
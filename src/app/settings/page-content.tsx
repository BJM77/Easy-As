"use client";

import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { useSettings } from '@/context/SettingsContext';
import { 
  ALL_SERVICES, 
  ALL_STATES 
} from '@/lib/types';
import type { 
  SurchargeDefinition, 
  ServiceName 
} from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Fuel, 
  Settings as SettingsIcon, 
  Percent, 
  PlusCircle, 
  Edit3, 
  ShieldCheck, 
  Mail, 
  RefreshCw, 
  Loader2, 
  Save, 
  Lock 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { newSurchargeSchema } from '@/lib/zodSchemas';
import { updateFuelSurcharges } from '@/ai/flows/update-fuel-surcharges-flow';
import { useAuth } from '@/firebase';
import { verifyAdminPassword } from '@/ai/flows/admin-auth-flow';

type NewSurchargeFormValues = z.infer<typeof newSurchargeSchema>;

export default function SettingsPageContent() {
  const {
    standardFuelSurcharge,
    priorityFuelSurcharge,
    palletFuelSurcharge,
    globalSecuritySurchargePercent,
    setGlobalSecuritySurchargePercent,
    updateGroupFuelSurcharge,
    surchargeDefinitions,
    addSurchargeDefinition,
    stateEmailContacts,
    setStateEmailContact,
    saveSettingsToServer,
    premiumServiceFees,
    setPremiumServiceFees,
  } = useSettings();

  const { toast } = useToast();
  const [isFetchingFuel, setIsFetchingFuel] = useState(false);
  const [savePassword, setSavePassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isPasswordValid, setIsPasswordValid] = useState(false);
  const { role } = useAuth();

  useEffect(() => {
    const validate = async () => {
      if (!savePassword) {
        setIsPasswordValid(false);
        return;
      }
      const isValid = await verifyAdminPassword(savePassword);
      setIsPasswordValid(isValid);
    };
    const timer = setTimeout(validate, 300);
    return () => clearTimeout(timer);
  }, [savePassword]);

  const newSurchargeForm = useForm<NewSurchargeFormValues>({
    resolver: zodResolver(newSurchargeSchema),
    defaultValues: {
      id: '',
      name: '',
      type: undefined,
      defaultValue: 0,
      applicableServices: [],
    }
  });

  const handleAddSurchargeDefinition = (data: NewSurchargeFormValues) => {
    const success = addSurchargeDefinition(data as SurchargeDefinition);
    if (success) {
      toast({ title: "Surcharge Added" });
      newSurchargeForm.reset();
    } else {
      toast({ title: "Error", description: "ID already exists.", variant: "destructive" });
    }
  };

  const handleGroupFuelChange = (groupType: 'standard' | 'priority' | 'pallet', value: string) => {
    const percentage = parseFloat(value);
    if (!isNaN(percentage)) {
      updateGroupFuelSurcharge(groupType, percentage, new Date().toISOString());
    }
  };

  const handlePremiumFeeChange = (key: keyof typeof premiumServiceFees, value: string) => {
    const num = parseFloat(value) || 0;
    setPremiumServiceFees({ ...premiumServiceFees, [key]: num });
  };

  const handleSaveChanges = async () => {
    if (!isPasswordValid) {
      toast({ title: "Unauthorized", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    const success = await saveSettingsToServer(savePassword);
    if (success) {
      toast({ title: "Settings Saved" });
    }
    setIsSaving(false);
  };
  
  const handleFetchLatestFuelRates = async () => {
    setIsFetchingFuel(true);
    try {
      const { update } = await updateFuelSurcharges();
      updateGroupFuelSurcharge('pallet', update.pallet, update.lastUpdated);
      updateGroupFuelSurcharge('standard', update.road, update.lastUpdated);
      updateGroupFuelSurcharge('priority', update.air, update.lastUpdated);
      toast({ title: "Fuel Rates Updated" });
    } catch(error) {
       toast({ title: "Error Fetching Fuel Rates", variant: "destructive" });
    } finally {
      setIsFetchingFuel(false);
    }
  };

  if (role !== 'admin' && role !== 'superadmin') {
    return <div className="p-20 text-center">Unauthorized.</div>;
  }

  return (
    <div className="space-y-8 pb-20 max-w-6xl mx-auto">
      <Card className="shadow-xl border-t-4 border-primary">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <SettingsIcon className="mr-2 h-7 w-7 text-primary" /> Application Settings
          </CardTitle>
          <CardDescription>Global configuration and surcharge definitions.</CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
            <CardHeader><CardTitle className="text-lg">State Contacts</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <ScrollArea className="h-64 pr-4">
                    {ALL_STATES.map(state => (
                        <div key={state} className="mb-4 space-y-1">
                            <Label className="text-xs font-bold">{state}</Label>
                            <Input
                                type="email"
                                value={stateEmailContacts[state]?.[0] || ''}
                                onChange={(e) => setStateEmailContact(state, 0, e.target.value)}
                                placeholder="Primary Email"
                                className="h-8 text-xs"
                            />
                        </div>
                    ))}
                </ScrollArea>
            </CardContent>
        </Card>

        <Card>
            <CardHeader><CardTitle className="text-lg">Fuel & Security</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                {['standard', 'priority', 'pallet'].map(g => (
                    <div key={g} className="flex items-center justify-between">
                        <Label className="capitalize">{g} Fuel %</Label>
                        <Input 
                            className="w-24 h-8 text-right font-mono" 
                            value={(g === 'standard' ? standardFuelSurcharge : g === 'priority' ? priorityFuelSurcharge : palletFuelSurcharge).toString()}
                            onChange={(e) => handleGroupFuelChange(g as any, e.target.value)}
                        />
                    </div>
                ))}
                <div className="pt-2 border-t flex items-center justify-between">
                    <Label className="font-bold">Security %</Label>
                    <Input 
                        className="w-24 h-8 text-right font-mono" 
                        value={globalSecuritySurchargePercent.toString()}
                        onChange={(e) => setGlobalSecuritySurchargePercent(parseFloat(e.target.value) || 0)}
                    />
                </div>
                <Button onClick={handleFetchLatestFuelRates} disabled={isFetchingFuel} variant="outline" className="w-full mt-2 h-8 text-xs">
                    {isFetchingFuel ? <Loader2 className="mr-2 h-3 w-3 animate-spin"/> : <RefreshCw className="mr-2 h-3 w-3" />} Sync Live Rates
                </Button>
            </CardContent>
        </Card>

        <Card>
            <CardHeader><CardTitle className="text-lg">Premium Services (Sameday & Bulk)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                {[
                  { key: 'sameDay', label: 'Same-Day' },
                  { key: 'handToHand', label: 'Hand 2 Hand' },
                  { key: 'highValue', label: 'High Value' },
                  { key: 'timeSensitive', label: 'Time Sensitive' },
                  { key: 'highlyMonitored', label: 'Highly Monitored' },
                ].map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between">
                        <Label>{label} Fee ($)</Label>
                        <Input 
                            type="number"
                            className="w-24 h-8 text-right font-mono" 
                            value={premiumServiceFees[key as keyof typeof premiumServiceFees].toString()}
                            onChange={(e) => handlePremiumFeeChange(key as keyof typeof premiumServiceFees, e.target.value)}
                        />
                    </div>
                ))}
            </CardContent>
        </Card>
      </div>

      <Card className="bg-primary/5 border-primary">
        <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="space-y-1 flex-grow">
                    <Label className="flex items-center gap-2"><Lock className="h-3 w-3" /> Admin Auth</Label>
                    <Input type="password" value={savePassword} onChange={(e) => setSavePassword(e.target.value)} placeholder="Enter password to commit..."/>
                </div>
                <Button onClick={handleSaveChanges} disabled={isSaving || !isPasswordValid} className="px-10 shadow-md">
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>} Commit Changes
                </Button>
            </div>
            {!isPasswordValid && savePassword && <p className="text-[10px] text-destructive mt-2">Incorrect password.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

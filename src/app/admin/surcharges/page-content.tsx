"use client";

import React, { useState, useEffect } from 'react';
import { useSettings } from '@/context/SettingsContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Fuel, ShieldCheck, Save, RefreshCw, Loader2, AlertTriangle, Truck, Zap, Anchor, Layers, Percent, Search, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { updateFuelSurcharges } from '@/ai/flows/update-fuel-surcharges-flow';
import { useSession } from '@/context/SessionContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/firebase';
import { verifyAdminPassword } from '@/ai/flows/admin-auth-flow';

export default function AdminSurchargesPageContent() {
  const {
    standardFuelSurcharge,
    priorityFuelSurcharge,
    palletFuelSurcharge,
    standardFuelLastUpdated,
    globalSecuritySurchargePercent,
    setGlobalSecuritySurchargePercent,
    updateGroupFuelSurcharge,
    surchargeDefinitions,
    serviceSettings,
    updateGroupOtherSurcharge,
    saveSettingsToServer,
  } = useSettings();

  const { role } = useAuth();
  const { toast } = useToast();
  const { addTokens } = useSession();
  const [isFetchingFuel, setIsFetchingFuel] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [password, setPassword] = useState('');
  const [isPasswordValid, setIsPasswordValid] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Local state for raw input values to allow clearing/typing without immediate reset
  const [localFuel, setLocalFuel] = useState({ standard: '', priority: '', pallet: '' });
  const [localSecurity, setLocalSecurity] = useState('');
  const [localAncillary, setLocalAncillary] = useState<Record<string, string>>({});

  useEffect(() => {
    setLocalFuel({
      standard: standardFuelSurcharge.toString(),
      priority: priorityFuelSurcharge.toString(),
      pallet: palletFuelSurcharge.toString(),
    });
  }, [standardFuelSurcharge, priorityFuelSurcharge, palletFuelSurcharge]);

  useEffect(() => {
    setLocalSecurity(globalSecuritySurchargePercent.toString());
  }, [globalSecuritySurchargePercent]);

  useEffect(() => {
    const validate = async () => {
      if (!password) {
        setIsPasswordValid(false);
        return;
      }
      const isValid = await verifyAdminPassword(password);
      setIsPasswordValid(isValid);
    };
    const timer = setTimeout(validate, 300);
    return () => clearTimeout(timer);
  }, [password]);

  const handleFetchFuel = async () => {
    setIsFetchingFuel(true);
    toast({ title: "Connecting to TGE...", description: "Fetching the latest live fuel rates." });
    try {
      const { update, usage } = await updateFuelSurcharges();
      if (usage) addTokens(usage.totalTokens);
      
      updateGroupFuelSurcharge('pallet', update.pallet, update.lastUpdated);
      updateGroupFuelSurcharge('standard', update.road, update.lastUpdated);
      updateGroupFuelSurcharge('priority', update.air, update.lastUpdated);

      if (isPasswordValid) {
        const success = await saveSettingsToServer(password);
        if (success) {
          toast({
            title: "Rates Fetched & Saved",
            description: `Successfully retrieved and saved values. Pallet: ${update.pallet}%, Road: ${update.road}%, Air: ${update.air}%`,
          });
        }
      } else {
        toast({
          title: "Rates Fetched (Action Required)",
          description: `Successfully retrieved values. Pallet: ${update.pallet}%, Road: ${update.road}%, Air: ${update.air}%. PLEASE ENTER YOUR PASSWORD AND CLICK 'SAVE & UPDATE GLOBALLY' TO APPLY.`,
          duration: 8000,
        });
      }
    } catch (error) {
      toast({
        title: "Fetch Failed",
        description: error instanceof Error ? error.message : "Could not reach TGE website.",
        variant: "destructive"
      });
    } finally {
      setIsFetchingFuel(false);
    }
  };

  const handleSave = async () => {
    if (!isPasswordValid) {
      toast({ title: "Access Denied", description: "Incorrect password for server write.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    const success = await saveSettingsToServer(password);
    if (success) {
      toast({ title: "Success", description: "All surcharges updated globally." });
    }
    setIsSaving(false);
  };

  const onFuelInputChange = (group: 'standard' | 'priority' | 'pallet', val: string) => {
    setLocalFuel(prev => ({ ...prev, [group]: val }));
    const num = parseFloat(val);
    if (!isNaN(num)) {
      updateGroupFuelSurcharge(group, num, new Date().toISOString());
    }
  };

  const onSecurityInputChange = (val: string) => {
    setLocalSecurity(val);
    const num = parseFloat(val);
    if (!isNaN(num)) {
      setGlobalSecuritySurchargePercent(num);
    }
  };

  const onAncillaryInputChange = (surchargeId: string, val: string) => {
    setLocalAncillary(prev => ({ ...prev, [surchargeId]: val }));
    const num = parseFloat(val);
    if (!isNaN(num)) {
      ['STANDARD_ROAD', 'PRIORITY_MIXED', 'PALLET_SERVICES'].forEach(groupKey => {
        updateGroupOtherSurcharge(groupKey as any, surchargeId, num, true);
      });
    }
  };

  const filteredAncillary = surchargeDefinitions.filter(d => 
    d.id !== 'fuel' && d.id !== 'security' &&
    (d.name.toLowerCase().includes(searchTerm.toLowerCase()) || d.id.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (role !== 'admin' && role !== 'superadmin') {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center text-destructive"><Lock className="mr-2 h-5 w-5" /> Unauthorized</CardTitle>
            <CardDescription>You do not have the required permissions to access this page.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20">
      <Card className="shadow-xl border-t-4 border-primary">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start gap-4">
            <div>
              <CardTitle className="text-2xl font-headline flex items-center">
                <Layers className="mr-2 h-7 w-7 text-primary" /> Global Surcharge Manager
              </CardTitle>
              <CardDescription>Adjust fees. Values saved update the app for all users.</CardDescription>
            </div>
            <Button onClick={handleFetchFuel} disabled={isFetchingFuel} variant="outline">
              {isFetchingFuel ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Fetch Latest TGE Rates
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-md">
          <CardHeader><CardTitle className="text-lg flex items-center"><Fuel className="mr-2 h-5 w-5 text-primary" />Fuel Surcharges (%)</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {['standard', 'priority', 'pallet'].map((g) => (
              <div key={g} className="space-y-2">
                <Label className="capitalize">{g} Express</Label>
                <div className="flex items-center gap-2">
                  <Input value={localFuel[g as keyof typeof localFuel]} onChange={(e) => onFuelInputChange(g as any, e.target.value)} className="font-mono" />
                  <Percent className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader><CardTitle className="text-lg flex items-center"><ShieldCheck className="mr-2 h-5 w-5 text-primary" />Security Surcharge (%)</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Global Security %</Label>
              <div className="flex items-center gap-2">
                <Input value={localSecurity} onChange={(e) => onSecurityInputChange(e.target.value)} className="font-mono" />
                <Percent className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-md">
        <CardHeader className="bg-muted/30 border-b flex flex-row items-center justify-between">
          <CardTitle>Ancillary Fees</CardTitle>
          <Input placeholder="Search fees..." className="w-64" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Fee Name</TableHead><TableHead className="text-right">Price ($)</TableHead></TableRow></TableHeader>
            <TableBody>
              {filteredAncillary.map(def => {
                const currentValue = serviceSettings.find(s => s.surcharges.some(as => as.surchargeId === def.id))
                  ?.surcharges.find(as => as.surchargeId === def.id)?.value ?? def.defaultValue ?? 0;
                const localVal = localAncillary[def.id] !== undefined ? localAncillary[def.id] : currentValue.toString();
                return (
                  <TableRow key={def.id}>
                    <TableCell className="font-medium">{def.name}</TableCell>
                    <TableCell className="text-right">
                      <Input value={localVal} onChange={(e) => onAncillaryInputChange(def.id, e.target.value)} className="w-24 ml-auto text-right font-mono" />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-primary bg-primary/5 sticky bottom-4 z-20 shadow-lg">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="space-y-1 flex-grow">
              <Label className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" />Server Write Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Authorize global update..." />
            </div>
            <Button onClick={handleSave} disabled={isSaving || !isPasswordValid} className="px-8 shadow-md">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save & Update Globally
            </Button>
          </div>
          {!isPasswordValid && password && <p className="text-[10px] text-destructive mt-2">Incorrect password.</p>}
          {!password && <p className="text-[10px] text-muted-foreground mt-2">Enter admin password to save.</p>}
        </CardContent>
      </Card>
    </div>
  );
}


"use client";

import React, { useState, useEffect } from 'react';
import { useSettings } from '@/context/SettingsContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Fuel, ShieldCheck, Save, RefreshCw, Loader2, AlertTriangle, Truck, Zap, Anchor, Layers, Percent, Search, Trash2, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { updateFuelSurcharges } from '@/ai/flows/update-fuel-surcharges-flow';
import { useSession } from '@/context/SessionContext';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/firebase';
import { cn } from '@/lib/utils';

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

  const handleFetchFuel = async () => {
    setIsFetchingFuel(true);
    toast({ title: "Connecting to TGE...", description: "Fetching the latest live fuel rates from the website." });
    try {
      const { update, usage } = await updateFuelSurcharges();
      addTokens(usage.totalTokens);
      
      updateGroupFuelSurcharge('pallet', update.pallet, update.lastUpdated);
      updateGroupFuelSurcharge('standard', update.road, update.lastUpdated);
      updateGroupFuelSurcharge('priority', update.air, update.lastUpdated);

      toast({
        title: "Rates Fetched",
        description: `Successfully retrieved current values. Pallet: ${update.pallet}%, Road: ${update.road}%, Air: ${update.air}%`,
      });
    } catch (error) {
      toast({
        title: "Fetch Failed",
        description: error instanceof Error ? error.message : "Could not reach TGE website. Please try manual entry.",
        variant: "destructive"
      });
    } finally {
      setIsFetchingFuel(false);
    }
  };

  const handleSave = async () => {
    if (password !== 'LCPTGE') {
      toast({ title: "Access Denied", description: "Incorrect password for server write.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    const success = await saveSettingsToServer(password);
    if (success) {
      toast({ title: "Success", description: "All surcharges have been updated globally for all users." });
    }
    setIsSaving(false);
  };

  const onFuelInputChange = (group: 'standard' | 'priority' | 'pallet', val: string) => {
    setLocalFuel(prev => ({ ...prev, [group]: val }));
    const num = parseFloat(val);
    if (!isNaN(num)) {
      updateGroupFuelSurcharge(group, num, new Date().toISOString());
    } else if (val === '') {
      updateGroupFuelSurcharge(group, 0, new Date().toISOString());
    }
  };

  const onSecurityInputChange = (val: string) => {
    setLocalSecurity(val);
    const num = parseFloat(val);
    if (!isNaN(num)) {
      setGlobalSecuritySurchargePercent(num);
    } else if (val === '') {
      setGlobalSecuritySurchargePercent(0);
    }
  };

  const onAncillaryInputChange = (surchargeId: string, val: string) => {
    setLocalAncillary(prev => ({ ...prev, [surchargeId]: val }));
    const num = parseFloat(val);
    if (!isNaN(num)) {
      ['STANDARD_ROAD', 'PRIORITY_MIXED', 'PALLET_SERVICES'].forEach(groupKey => {
        updateGroupOtherSurcharge(groupKey as any, surchargeId, num, true);
      });
    } else if (val === '') {
      ['STANDARD_ROAD', 'PRIORITY_MIXED', 'PALLET_SERVICES'].forEach(groupKey => {
        updateGroupOtherSurcharge(groupKey as any, surchargeId, 0, true);
      });
    }
  };

  const filteredAncillary = surchargeDefinitions.filter(d => 
    d.id !== 'fuel' && 
    d.id !== 'security' &&
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
              <CardDescription>
                Adjust fuel, security, and ancillary fees. Values saved here update the application for all users.
              </CardDescription>
            </div>
            <Button onClick={handleFetchFuel} disabled={isFetchingFuel} variant="outline" className="w-full md:w-auto">
              {isFetchingFuel ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Fetch Latest TGE Rates
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Fuel Surcharges */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-lg flex items-center"><Fuel className="mr-2 h-5 w-5 text-primary" />Fuel Surcharges (%)</CardTitle>
            <CardDescription>Standard percentages retrieved from TGE public site.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center text-sm font-semibold"><Truck className="mr-2 h-4 w-4 text-muted-foreground" />Express Parcels Road (Standard)</Label>
              <div className="flex items-center gap-2">
                <Input 
                  type="text" 
                  value={localFuel.standard} 
                  onChange={(e) => onFuelInputChange('standard', e.target.value)}
                  onFocus={(e) => e.target.select()}
                  className="font-mono"
                />
                <Percent className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center text-sm font-semibold"><Zap className="mr-2 h-4 w-4 text-muted-foreground" />Express Parcels Air (Priority)</Label>
              <div className="flex items-center gap-2">
                <Input 
                  type="text" 
                  value={localFuel.priority} 
                  onChange={(e) => onFuelInputChange('priority', e.target.value)}
                  onFocus={(e) => e.target.select()}
                  className="font-mono"
                />
                <Percent className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center text-sm font-semibold"><Anchor className="mr-2 h-4 w-4 text-muted-foreground" />Palletised Express</Label>
              <div className="flex items-center gap-2">
                <Input 
                  type="text" 
                  value={localFuel.pallet} 
                  onChange={(e) => onFuelInputChange('pallet', e.target.value)}
                  onFocus={(e) => e.target.select()}
                  className="font-mono"
                />
                <Percent className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            {standardFuelLastUpdated && (
              <p className="text-[10px] text-muted-foreground pt-2 italic text-right">
                Last website fetch: {format(new Date(standardFuelLastUpdated), 'dd MMM yyyy, p')}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Security Surcharge */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-lg flex items-center"><ShieldCheck className="mr-2 h-5 w-5 text-primary" />Security Surcharge (%)</CardTitle>
            <CardDescription>Global percentage applied to all Priority and Air-based products.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Global Security %</Label>
              <div className="flex items-center gap-2">
                <Input 
                  type="text" 
                  value={localSecurity} 
                  onChange={(e) => onSecurityInputChange(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  className="font-mono"
                />
                <Percent className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="p-4 bg-muted/50 rounded-md border border-dashed border-muted-foreground/30">
              <p className="text-xs text-muted-foreground leading-relaxed">
                This surcharge is applied to the sum of the Base Freight + Fuel Surcharge for all eligible services.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ancillary Fees */}
      <Card className="shadow-md overflow-hidden">
        <CardHeader className="bg-muted/30 border-b">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="text-lg">Ancillary Fees & Service Charges</CardTitle>
              <CardDescription>Adjust fixed prices for add-on services and handling fees.</CardDescription>
            </div>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search fees..." 
                className="pl-8 h-9" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[500px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px]">Fee Name</TableHead>
                  <TableHead className="hidden md:table-cell">Calculation Basis</TableHead>
                  <TableHead className="text-right">Price ($)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAncillary.length > 0 ? (
                  filteredAncillary.map(def => {
                    // Get current value from first service that has it
                    const currentValue = serviceSettings.find(s => s.surcharges.some(as => as.surchargeId === def.id))
                      ?.surcharges.find(as => as.surchargeId === def.id)?.value ?? def.defaultValue ?? 0;

                    const localVal = localAncillary[def.id] !== undefined ? localAncillary[def.id] : currentValue.toString();

                    return (
                      <TableRow key={def.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium py-3">
                          {def.name}
                          <div className="md:hidden text-[10px] text-muted-foreground mt-1 capitalize">
                            {def.type.replace(/_/g, ' ')}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell capitalize text-xs text-muted-foreground">
                          {def.type.replace(/_/g, ' ')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-muted-foreground text-xs">$</span>
                            <Input 
                              type="text" 
                              className="w-24 h-8 text-right font-mono" 
                              value={localVal}
                              onChange={(e) => onAncillaryInputChange(def.id, e.target.value)}
                              onFocus={(e) => e.target.select()}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                      No fees found matching "{searchTerm}"
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Global Save Action */}
      <Card className="border-primary bg-primary/5 sticky bottom-4 z-20 shadow-lg">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="space-y-1 flex-grow w-full md:w-auto">
              <Label htmlFor="admin-pass" className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Server Write Password
              </Label>
              <Input 
                id="admin-pass" 
                type="password" 
                placeholder="Enter password to authorize save..." 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-background"
              />
            </div>
            <Button onClick={handleSave} disabled={isSaving || password !== 'LCPTGE'} className="w-full md:w-auto px-8 h-10 shadow-md">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save All Surcharges & Update Globally
            </Button>
          </div>
          {password !== 'LCPTGE' && (
            <p className="text-[10px] text-muted-foreground mt-2 flex items-center">
              <AlertTriangle className="mr-1.5 h-3 w-3 text-amber-500" /> 
              Changes are temporary until you authorize the global update with the admin password.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

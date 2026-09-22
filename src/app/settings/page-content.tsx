"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { useSettings } from '@/context/SettingsContext';
import type { ServiceName, SurchargeDefinition, SurchargeConfigGroupKey, StateAbbreviation, QuickActionKey, UserRole, ServicePermissions, PageKey, PagePermissions, ExternalLink, ServiceSettings } from '@/lib/types';
import { ALL_SERVICES, ALL_STATES, NON_PALLET_SERVICES, LCP_SERVICES, STANDARD_ROAD_MAPPED_SERVICES, PRIORITY_MAPPED_SERVICES, STANDARD_PALLET_MAPPED_SERVICES, PALLET_LIKE_SERVICES, ALL_USER_ROLES, SECURITY_APPLICABLE_SERVICES, ALL_PAGES, ALL_TIMEZONES, DEFAULT_SERVICE_PERMISSIONS } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Fuel, Settings as SettingsIcon, Percent, PlusCircle, Edit3, Truck, Zap, Layers, ClipboardCheck, ShieldCheck, ExternalLink as ExternalLinkIcon, FileJson, Mail, Anchor, RefreshCw, Loader2, Sparkles, Users, Save, Lock, Computer, FolderOpen, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { newSurchargeSchema } from '@/lib/zodSchemas';
import { format } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import { updateFuelSurcharges, type FuelSurchargeUpdate } from '@/ai/flows/update-fuel-surcharges-flow';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/firebase';

type NewSurchargeFormValues = z.infer<typeof newSurchargeSchema>;

interface AuthUser {
  uid: string;
  email?: string;
  lastSignInTime?: string;
  creationTime?: string;
}

export default function SettingsPageContent() {
  const {
    standardFuelSurcharge,
    priorityFuelSurcharge,
    palletFuelSurcharge,
    standardFuelLastUpdated,
    priorityFuelLastUpdated,
    palletFuelLastUpdated,
    globalSecuritySurchargePercent,
    setGlobalSecuritySurchargePercent,
    updateGroupFuelSurcharge,
    surchargeDefinitions,
    serviceSettings,
    addSurchargeDefinition,
    updateGroupOtherSurcharge,
    emailQuoteTemplate,
    setEmailQuoteTemplate,
    perfectPlanPalletRate,
    setPerfectPlanPalletRate,
    perfectPlanParcelRate,
    setPerfectPlanParcelRate,
    perfectPlanSatchelRate,
    setPerfectPlanSatchelRate,
    stateEmailContacts,
    setStateEmailContact,
    saveSettingsToServer,
  } = useSettings();

  const { toast } = useToast();
  const [isFetchingFuel, setIsFetchingFuel] = useState(false);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isUsersDialogOpen, setIsUsersDialogOpen] = useState(false);
  const [savePassword, setSavePassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { role } = useAuth();

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
      toast({
        title: "Surcharge Added",
        description: `Successfully defined '${data.name}'. This surcharge will now be available in the calculator.`,
      });
      newSurchargeForm.reset();
    } else {
      toast({
        title: "Error",
        description: "A surcharge with this ID already exists. Please use a unique identifier.",
        variant: "destructive",
      });
    }
  };

  const handleGroupFuelChange = (groupType: 'standard' | 'priority' | 'pallet', value: string) => {
    const percentage = parseFloat(value);
    if (!isNaN(percentage) && percentage >= 0 && percentage <= 100) {
      updateGroupFuelSurcharge(groupType, percentage, new Date().toISOString());
    }
  };

  const handleGlobalSecuritySurchargeChange = (value: string) => {
    const percentage = parseFloat(value);
    if (!isNaN(percentage) && percentage >= 0 && percentage <= 100) {
      setGlobalSecuritySurchargePercent(percentage);
    }
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    const success = await saveSettingsToServer(savePassword);
    if (success) {
      toast({
        title: "Settings Saved to Server",
        description: "Your changes have been saved and will apply to all users on their next session.",
      });
    }
    setIsSaving(false);
  };
  
  const handleFetchLatestFuelRates = async () => {
    setIsFetchingFuel(true);
    toast({ title: "Fetching Latest Fuel Rates...", description: "Please wait, this may take a moment."});
    try {
      const { update } = await updateFuelSurcharges();
      updateGroupFuelSurcharge('pallet', update.pallet, update.lastUpdated);
      updateGroupFuelSurcharge('standard', update.road, update.lastUpdated);
      updateGroupFuelSurcharge('priority', update.air, update.lastUpdated);
      toast({ title: "Fuel Rates Updated Successfully" });
    } catch(error) {
       toast({ title: "Error Fetching Fuel Rates", variant: "destructive" });
    } finally {
      setIsFetchingFuel(false);
    }
  };

  const handleFetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const response = await fetch('/api/users');
      const data = await response.json();
      if (!response.ok) throw new Error('Failed to fetch users');
      setUsers(data);
    } catch (error) {
      toast({ title: "Error", description: `Could not fetch user list.`, variant: "destructive" });
    } finally {
      setIsLoadingUsers(false);
    }
  };

  if (role !== 'admin' && role !== 'superadmin') {
    return <div className="p-20 text-center">Unauthorized. Administrator only.</div>;
  }

  return (
    <div className="space-y-8 pb-20">
      <Card className="shadow-xl border-t-4 border-primary">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <SettingsIcon className="mr-2 h-7 w-7 text-primary" /> Application Settings
          </CardTitle>
          <CardDescription>Manage fuel surcharges, security surcharge, define other surcharges, and customize the email quote template.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle className="text-xl font-semibold flex items-center"><Mail className="mr-2 h-6 w-6 text-primary" />State Email Contacts</CardTitle>
            <CardDescription>Enter up to three email addresses for each state.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {ALL_STATES.map(state => (
                    <div key={state} className="p-4 border rounded-lg space-y-2 bg-muted/30">
                        <Label className="font-semibold text-foreground">{state}</Label>
                        {[0, 1, 2].map(index => (
                             <Input
                                key={index}
                                type="email"
                                placeholder={`Email ${index + 1}`}
                                value={stateEmailContacts[state]?.[index] || ''}
                                onChange={(e) => setStateEmailContact(state, index, e.target.value)}
                            />
                        ))}
                    </div>
                ))}
            </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold flex items-center"><Edit3 className="mr-2 h-6 w-6 text-primary" />Define New Surcharge</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1"><Label>Surcharge ID</Label><Input {...newSurchargeForm.register('id')} placeholder="e.g., remote_area_fee" /></div>
                <div className="space-y-1"><Label>Surcharge Name</Label><Input {...newSurchargeForm.register('name')} placeholder="e.g., Remote Area Fee" /></div>
                <div className="space-y-1">
                    <Label>Surcharge Type</Label>
                    <Controller name="type" control={newSurchargeForm.control} render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixed_per_shipment">Fixed Per Shipment</SelectItem>
                          <SelectItem value="fixed_per_kg">Fixed Per Kg</SelectItem>
                          <SelectItem value="percentage">Percentage of Base</SelectItem>
                        </SelectContent>
                      </Select>
                    )} />
                </div>
                <div className="space-y-1"><Label>Default Value</Label><Input type="number" step="0.01" {...newSurchargeForm.register('defaultValue')} /></div>
            </div>
            <div className="space-y-3">
              <Label className="font-semibold">Applicable Services</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4 border rounded-md max-h-60 overflow-y-auto">
                {ALL_SERVICES.map((service) => (
                  <div key={service} className="flex items-center space-x-2">
                    <Checkbox
                      id={`applicable-service-${service}`}
                      checked={(newSurchargeForm.watch('applicableServices') || []).includes(service)}
                      onCheckedChange={(checked) => {
                        const current = newSurchargeForm.getValues('applicableServices') || [];
                        const next = checked ? [...current, service] : current.filter(s => s !== service);
                        newSurchargeForm.setValue('applicableServices', next, { shouldValidate: true });
                      }}
                    />
                    <Label htmlFor={`applicable-service-${service}`} className="text-sm font-normal">{service}</Label>
                  </div>
                ))}
              </div>
            </div>
            <Button type="button" onClick={newSurchargeForm.handleSubmit(handleAddSurchargeDefinition)} className="bg-accent hover:bg-accent/90 text-accent-foreground">
              <PlusCircle className="mr-2 h-4 w-4" /> Add Surcharge Definition
            </Button>
          </form>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold flex items-center"><ShieldCheck className="mr-2 h-6 w-6 text-primary" />Global Security Surcharge</CardTitle>
        </CardHeader>
        <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center p-3 border rounded-md">
              <Label>Security Surcharge Percentage</Label>
              <div className="flex items-center gap-2">
                <Input type="number" value={globalSecuritySurchargePercent.toString()} onChange={(e) => handleGlobalSecuritySurchargeChange(e.target.value)} className="w-24" />
                <Percent className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div><CardTitle className="text-xl font-semibold flex items-center"><Fuel className="mr-2 h-6 w-6 text-primary" />Fuel Surcharges</CardTitle></div>
            <Button onClick={handleFetchLatestFuelRates} disabled={isFetchingFuel}>
              {isFetchingFuel ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4" />} Fetch Latest
            </Button>
        </CardHeader>
        <CardContent className="space-y-6">
            {['standard', 'priority', 'pallet'].map(group => (
              <div key={group} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center p-3 border rounded-md">
                <Label className="capitalize">{group} Services</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" value={(group === 'standard' ? standardFuelSurcharge : group === 'priority' ? priorityFuelSurcharge : palletFuelSurcharge).toString()} onChange={(e) => handleGroupFuelChange(group as any, e.target.value)} className="w-24" />
                  <Percent className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            ))}
        </CardContent>
      </Card>

      <Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-500">
        <CardHeader>
            <CardTitle className="flex items-center text-amber-800 dark:text-amber-200"><ShieldCheck className="mr-2"/>Save Globally</CardTitle>
        </CardHeader>
        <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="space-y-1 flex-grow">
                    <Label>Server Write Password</Label>
                    <Input id="savePassword" type="password" value={savePassword} onChange={(e) => setSavePassword(e.target.value)} placeholder="Required to persist..."/>
                </div>
                <Button onClick={handleSaveChanges} disabled={isSaving || savePassword !== 'LCPTGE'}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>} Save Settings
                </Button>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
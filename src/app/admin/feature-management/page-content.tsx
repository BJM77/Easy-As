
"use client";

import React, { useState, useMemo } from 'react';
import { useAuth, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Settings2, ShieldCheck, CheckCircle2, AlertCircle, Save, Globe, Info, PackageSearch, Truck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { collection, doc, updateDoc } from 'firebase/firestore';
import type { Company, ServiceName } from '@/lib/types';
import { ALL_SERVICES, getServiceFeatureId } from '@/lib/types';
import { Separator } from '@/components/ui/separator';

const FEATURE_GROUPS = [
  {
    title: 'Core Tools & Access',
    features: [
      { id: 'calculator', label: 'Freight Calculator' },
      { id: 'ai-guru', label: 'Perfect Plan Wizard' },
      { id: 'proposal', label: 'AI Proposal Builder' },
      { id: 'rate-card', label: 'Rate Card Generator' },
      { id: 'standard-spend-bands', label: 'Standard Spend Bands (SB 1-6)' },
      { id: 'about-tge', label: 'About TGE Page' },
    ],
  },
  {
    title: 'Advanced Comparison',
    features: [
      { id: 'sb-comparison', label: 'Spend Band Comparison' },
      { id: 'rate-comparison', label: 'Old vs New Rate Comparison' },
      { id: 'competitor-comparison', label: 'Competitor Rate Comparison (CRC)' },
      { id: 'multi', label: 'Multi-Leg Comparison' },
      { id: 'leg-discount', label: 'Target Price / Leg Discount' },
    ],
  },
  {
    title: 'Logistics & CRM',
    features: [
      { id: 'routing', label: 'AI Route Planner' },
      { id: 'live', label: 'Live Track Scan' },
      { id: 'find-it', label: 'Find It (QR Map)' },
      { id: 'grab-it', label: 'Grab It (QR Lead)' },
      { id: 'problem-log', label: 'Problem Log / Case Mgmt' },
      { id: 'location-lookup', label: 'Universal Lookup' },
      { id: 'vip', label: 'VIP Contacts' },
    ],
  },
  {
    title: 'Financial & Admin',
    features: [
      { id: 'commercials', label: 'Commercial Profit Analysis' },
      { id: 'bulk', label: 'Bulk Priority Calculator' },
      { id: 'remittance', label: 'Remittance Submission' },
      { id: 'admin-menu', label: 'Admin Dashboard Menu' },
      { id: 'status', label: 'System Status Page' },
    ],
  },
  {
    title: 'System & Data Management',
    features: [
      { id: 'manage-surcharges', label: 'Manage Surcharges' },
      { id: 'pdf-extractor', label: 'AI PDF Extractor' },
      { id: 'core-rate-uploader', label: 'Core Rate Uploader' },
      { id: 'rate-uploader', label: 'Customer Rate Uploader' },
      { id: 'csv-converter', label: 'CSV to JSON Converter' },
    ],
  },
  {
    title: 'Special Dashboard & Search Features',
    features: [
      { id: 'salesforce-search-bar', label: 'Salesforce Global Search Button' },
      { id: 'salesforce-widgets', label: 'Salesforce Dashboard Widgets' },
      { id: 'account-reports', label: 'Account-Based Reports Widget' },
      { id: 'live-rates', label: 'Fuel/Security Rates Widget' },
    ],
  }
];

export default function FeatureManagementPageContent() {
  const { role } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const companiesQuery = useMemoFirebase(() => {
    if (firestore && role === 'superadmin') {
      return collection(firestore, 'companies');
    }
    return null;
  }, [firestore, role]);

  const { data: companiesData, isLoading: isLoadingCompanies } = useCollection<Company>(companiesQuery);
  const companies = companiesData ?? [];

  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [localFeatures, setLocalFeatures] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);

  const selectedCompany = useMemo(() => 
    companies.find(c => c.id === selectedCompanyId), 
    [companies, selectedCompanyId]
  );

  // Sync local features when company changes
  React.useEffect(() => {
    if (selectedCompany) {
      setLocalFeatures(selectedCompany.enabledFeatures || {});
    } else {
      setLocalFeatures({});
    }
  }, [selectedCompany]);

  const handleToggleFeature = (featureId: string, enabled: boolean) => {
    setLocalFeatures(prev => ({ ...prev, [featureId]: enabled }));
  };

  const handleSave = async () => {
    if (!selectedCompanyId || !firestore) return;
    setIsSaving(true);

    try {
      const docRef = doc(firestore, 'companies', selectedCompanyId);
      // Hardened logic: Merge with existing features instead of overwriting the whole object
      const mergedFeatures = { ...(selectedCompany?.enabledFeatures || {}), ...localFeatures };
      await updateDoc(docRef, { enabledFeatures: mergedFeatures });
      toast({ title: 'Features Updated', description: `Enabled modules for ${selectedCompany?.name} saved successfully.` });
    } catch (error: any) {
      toast({ title: 'Save Failed', description: error.message || 'Could not save feature settings.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  if (role !== 'superadmin') {
    return (
      <Card className="m-8">
        <CardHeader><CardTitle className="text-destructive">Access Denied</CardTitle></CardHeader>
        <CardContent><p>Superadmin access is required to manage company features.</p></CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <Settings2 className="mr-2 h-7 w-7 text-primary" /> Company Feature Management
          </CardTitle>
          <CardDescription>
            Activate or deactivate specific modules and integrations for each company tenant.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-md space-y-2">
            <Label htmlFor="company-select-feature">Select Company to Manage</Label>
            <Select value={selectedCompanyId || ''} onValueChange={setSelectedCompanyId}>
              <SelectTrigger id="company-select-feature">
                <SelectValue placeholder="Choose a company..." />
              </SelectTrigger>
              <SelectContent>
                {isLoadingCompanies ? (
                  <div className="p-2 text-center"><Loader2 className="animate-spin inline mr-2 h-4 w-4"/>Loading...</div>
                ) : (
                  companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)
                )}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedCompany && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {FEATURE_GROUPS.map((group) => (
              <Card key={group.title} className="shadow-md">
                <CardHeader className="bg-muted/30 pb-3 border-b">
                  <CardTitle className="text-lg">{group.title}</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  {group.features.map((feature) => (
                    <div key={feature.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50 transition-colors">
                      <div className="space-y-0.5">
                        <Label htmlFor={`feat-${feature.id}`} className="font-semibold cursor-pointer">{feature.label}</Label>
                        <p className="text-[10px] text-muted-foreground font-mono">{feature.id}</p>
                      </div>
                      <Checkbox 
                        id={`feat-${feature.id}`} 
                        name={`feat-${feature.id}`}
                        checked={localFeatures[feature.id] !== false} // Assume TRUE if undefined
                        onCheckedChange={(checked) => handleToggleFeature(feature.id, !!checked)}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}

            {/* Visible Pricing Results Group */}
            <Card className="shadow-md">
              <CardHeader className="bg-primary/5 pb-3 border-b border-primary/10">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Truck className="h-5 w-5 text-primary" />
                  Visible Pricing Results
                </CardTitle>
                <CardDescription>Control which service results appear in calculators.</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                {ALL_SERVICES.map((serviceName) => {
                  const featureId = getServiceFeatureId(serviceName);
                  return (
                    <div key={featureId} className="flex items-center justify-between p-2 rounded hover:bg-muted/50 transition-colors">
                      <div className="space-y-0.5">
                        <Label htmlFor={`feat-${featureId}`} className="font-semibold cursor-pointer">{serviceName}</Label>
                        <p className="text-[10px] text-muted-foreground font-mono">{featureId}</p>
                      </div>
                      <Checkbox 
                        id={`feat-${featureId}`} 
                        name={`feat-${featureId}`}
                        checked={localFeatures[featureId] !== false} // Default to visible
                        onCheckedChange={(checked) => handleToggleFeature(featureId, !!checked)}
                      />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          <Card className="sticky bottom-4 z-20 border-primary bg-primary/5 shadow-2xl">
            <CardContent className="pt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center text-sm">
                <Info className="mr-2 h-4 w-4 text-blue-500" />
                <span>Managing: <strong>{selectedCompany.name}</strong></span>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button variant="outline" onClick={() => setSelectedCompanyId(null)}>Cancel</Button>
                <Button onClick={handleSave} disabled={isSaving} className="min-w-[120px]">
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Features
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!selectedCompany && !isLoadingCompanies && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border-2 border-dashed rounded-lg">
          <Globe className="h-12 w-12 mb-4 opacity-20" />
          <p>Please select a company above to configure their active features.</p>
        </div>
      )}
    </div>
  );
}

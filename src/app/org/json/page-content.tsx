
"use client";

import React, { useState, useRef } from 'react';
import { useAuth, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileJson, UploadCloud, Save, Sparkles, FileUp, CheckCircle, XCircle, Database, Hash } from 'lucide-react';
import { extractPdfData } from '@/ai/flows/extract-pdf-data-flow';
import { useSession } from '@/context/SessionContext';
import { useRateOverrides } from '@/context/RateOverrideContext';
import { transformPdfDataToAppLogic } from '@/lib/freightCalculations';
import type { RateFileType, CompanyRate } from '@/lib/types';
import * as XLSX from 'xlsx';
import { collection, query, where, doc, setDoc } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';

type TargetBU = 'B2B Standard' | 'B2B Priority' | 'B2C' | 'Pallets' | 'LCP Standard' | 'LCP Priority' | 'LCP GO Standard' | 'LCP GO Priority';

const BU_TO_FILE_MAP: Record<TargetBU, RateFileType> = {
  'B2B Standard': 'customer_b2brdex',
  'B2B Priority': 'customer_b2b_priority',
  'B2C': 'customer_b2c',
  'Pallets': 'customer_pe',
  'LCP Standard': 'customer_lcprdex',
  'LCP Priority': 'customer_lcpprio',
  'LCP GO Standard': 'customer_lcpgo',
  'LCP GO Priority': 'customer_lcpgo'
};

export default function JSONManagementPageContent() {
  const { user, profile } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { addTokens } = useSession();
  const { setRateOverride, overriddenRates } = useRateOverrides();

  const [targetBU, setTargetBU] = useState<TargetBU>('B2B Standard');
  const [headerRow, setHeaderRow] = useState<string>('1');
  const [accountNumber, setAccountNumber] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const ratesQuery = useMemoFirebase(() => {
    if (!firestore || !profile?.companyId) return null;
    return query(collection(firestore, 'companyRates'), where('companyId', '==', profile.companyId));
  }, [firestore, profile?.companyId]);

  const { data: savedRates = [], isLoading: isLoadingSaved } = useCollection<CompanyRate>(ratesQuery);

  const handleFileExtraction = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    const file = event.target.files[0];
    const fileType = file.name.split('.').pop()?.toLowerCase();
    
    setIsProcessing(true);
    const reader = new FileReader();

    if (fileType === 'pdf') {
      reader.onload = async (e) => {
        const dataUri = e.target?.result as string;
        try {
          const { result, usage } = await extractPdfData({
            pdfDataUri: dataUri,
            extractionType: 'Rate Card',
            customInstructions: `Standardize all rows. Extract 'Basic', 'Kilo Rate Thereafter', and 'Min Charge'.`
          });
          
          addTokens(usage.totalTokens);
          const transformed = transformPdfDataToAppLogic(result.extractedData, targetBU);
          setRateOverride(BU_TO_FILE_MAP[targetBU], transformed, accountNumber.trim());
          toast({ title: "Extraction Successful", description: `${targetBU} rates applied.` });
        } catch (error) {
          toast({ title: "Extraction Failed", variant: "destructive" });
        } finally {
          setIsProcessing(false);
        }
      };
      reader.readAsDataURL(file);
    } else if (['csv', 'xls', 'xlsx'].includes(fileType || '')) {
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const json = XLSX.utils.sheet_to_json<any>(workbook.Sheets[workbook.SheetNames[0]], { range: parseInt(headerRow, 10) - 1 });
          const transformed = transformPdfDataToAppLogic(json, targetBU);
          setRateOverride(BU_TO_FILE_MAP[targetBU], transformed, accountNumber.trim());
          toast({ title: "Import Successful", description: `${json.length} rows processed.` });
        } catch (error) {
          toast({ title: "Import Failed", variant: "destructive" });
        } finally {
          setIsProcessing(false);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleJsonUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        setRateOverride(BU_TO_FILE_MAP[targetBU], data, accountNumber.trim());
        toast({ title: "JSON Applied", description: `Rates updated for session.` });
      } catch (error) {
        toast({ title: "Invalid JSON", variant: "destructive" });
      }
    };
    reader.readAsText(file);
  };

  const handleSaveToFirestore = async () => {
    if (!profile?.companyId || !firestore || !user) return;
    const baseType = BU_TO_FILE_MAP[targetBU];
    const acc = accountNumber.trim();
    const rateTypeKey = acc ? `${baseType}_${acc}` : baseType;
    const data = overriddenRates[rateTypeKey];

    if (!data) {
      toast({ title: "No Data", description: "Upload or extract data first.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const token = await user.getIdToken();
      const docId = `${profile.companyId}_${rateTypeKey}`;
      const docRef = doc(firestore, 'companyRates', docId);
      
      await setDoc(docRef, {
        id: docId,
        companyId: profile.companyId,
        rateType: baseType,
        accountNumber: acc || null,
        data: data,
        updatedAt: new Date().toISOString(),
        updatedBy: user.email || user.uid
      }, { merge: true });

      toast({ title: "Saved to Server", description: "Rates are now persistent for your organization." });
    } catch (e: any) {
      toast({ title: "Save Error", description: e.message || "Could not persist rates.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <FileJson className="mr-2 h-7 w-7 text-primary" /> Contract JSON Management
          </CardTitle>
          <CardDescription>Manage company-specific contract pricing. Rates uploaded here are used in the "Customer Rates" spend band.</CardDescription>
        </CardHeader>
      </Card>

      <Card className="border-primary bg-primary/5">
        <CardHeader>
          <CardTitle className="text-xl flex items-center">
            <UploadCloud className="mr-2 h-6 w-6 text-primary" /> Rate Importer
          </CardTitle>
          <CardDescription>Populate contract rates by extracting PDFs/Spreadsheets or uploading JSON logic.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-end">
            <div className="space-y-2">
              <Label>Business Unit</Label>
              <Select value={targetBU} onValueChange={(v) => setTargetBU(v as TargetBU)}>
                <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(BU_TO_FILE_MAP).map(bu => <SelectItem key={bu} value={bu}>{bu}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Hash className="h-4 w-4 text-muted-foreground" /> Account Number (Optional)</Label>
              <Input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="e.g., 80272019" className="bg-background" />
            </div>

            <div className="space-y-2">
              <Label>Header Row (Excel/CSV)</Label>
              <Select value={headerRow} onValueChange={setHeaderRow}>
                <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 10, 19].map(r => <SelectItem key={r} value={String(r)}>Row {r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="h-12 bg-background" disabled={isProcessing}>
              {isProcessing ? <Loader2 className="animate-spin h-4 w-4" /> : <Sparkles className="mr-2 h-4 w-4 text-accent" />}
              Extract PDF/Excel
            </Button>
            <Button onClick={() => jsonInputRef.current?.click()} variant="outline" className="h-12 bg-background">
              <FileUp className="mr-2 h-4 w-4" /> Upload JSON
            </Button>
            <Button onClick={handleSaveToFirestore} className="h-12" disabled={isSaving || !overriddenRates[accountNumber ? `${BU_TO_FILE_MAP[targetBU]}_${accountNumber}` : BU_TO_FILE_MAP[targetBU]]}>
              {isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
              Persist to Server
            </Button>
          </div>
          <input type="file" ref={fileInputRef} accept=".pdf,.csv,.xls,.xlsx" className="hidden" onChange={handleFileExtraction} />
          <input type="file" ref={jsonInputRef} accept=".json" className="hidden" onChange={handleJsonUpload} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center"><Database className="mr-2 h-6 w-6 text-primary" /> Active Contract Data</CardTitle>
          <CardDescription>Currently loaded persistent and session-based rates.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {savedRates.map(rate => (
              <div key={rate.id} className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                <div>
                  <p className="font-bold text-sm uppercase">{rate.rateType.replace('customer_', '').replace(/_/g, ' ')}</p>
                  <p className="text-xs text-muted-foreground">{rate.accountNumber ? `Account: ${rate.accountNumber}` : 'Standard Contract'}</p>
                </div>
                <Badge variant="outline" className="border-green-600 text-green-600 bg-green-50">
                  <CheckCircle className="mr-1 h-3 w-3" /> {rate.data.length} records
                </Badge>
              </div>
            ))}
            {savedRates.length === 0 && <p className="text-center col-span-2 py-10 text-muted-foreground italic">No persistent contract rates found.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import React, { useState, useRef, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { UploadedRateEntry, RateComparisonItem, ServiceName, RateFileType } from '@/lib/types';
import { useSettings } from '@/context/SettingsContext';
import { useRateOverrides } from '@/context/RateOverrideContext';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/firebase';
import * as XLSX from 'xlsx';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { 
  Loader2, 
  GitCompareArrows, 
  Eraser, 
  Calculator, 
  UploadCloud, 
  FileSpreadsheet, 
  Printer, 
  User, 
  Table as TableIcon,
  Info,
  Calculator as CalcIcon
} from 'lucide-react';

const zoneIdToCodeMap: Record<string, string> = {
  "200": "SYD", "210": "ABX", "211": "CBR", "212": "NTL", "213": "WOL", "201": "NSW1", "202": "NSW2", "203": "NSW3", "204": "NSW4", "205": "NSW5", "206": "NSW6", "207": "NSW7", "208": "NSW8", "209": "NSW9",
  "300": "MEL", "301": "VIC1", "302": "VIC2",
  "400": "BNE", "410": "CNS", "411": "MKY", "412": "ROK", "413": "TSV", "414": "YORK", "401": "QLD1", "402": "QLD2", "403": "QLD3", "404": "QLD4", "405": "QLD5", "406": "QLD6", "407": "QLD7", "408": "QLD8", "409": "QLD9",
  "500": "ADL", "501": "SA1", "502": "SA2", "503": "SA3", "504": "SA4", "505": "SA5",
  "600": "PER", "601": "WA1", "602": "WA2", "603": "WA3", "604": "WA4",
  "800": "DRW", "802": "ASP", "801": "NT1",
  "700": "HBA", "704": "LST", "701": "TAS1", "702": "TAS2", "703": "TAS3",
};

const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined || isNaN(amount)) return "N/A";
    return amount.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });
};

const tgeComparisonFormSchema = z.object({
  companyName: z.string().optional(),
  spendBand: z.string().min(1, "Spend band is required."),
  sampleWeight: z.coerce.number().positive("Sample weight must be positive."),
});
type TgeComparisonFormValues = z.infer<typeof tgeComparisonFormSchema>;

export default function RateComparisonPageContent() {
  const { globalSpendBands, standardFuelSurcharge, priorityFuelSurcharge, globalSecuritySurchargePercent } = useSettings();
  const { role } = useAuth();
  const { getRateFile, isLoading: isLoadingRatesContext } = useRateOverrides();
  const { toast } = useToast();

  const [comparisonMode, setComparisonMode] = useState<'tgeIpec' | 'tgePrio'>('tgeIpec');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [tgeIpecUploadedData, setTgeIpecUploadedData] = useState<UploadedRateEntry[]>([]);
  const [tgeIpecComparisonResults, setTgeIpecComparisonResults] = useState<RateComparisonItem[]>([]);
  const [pastedTgeIpecData, setPastedTgeIpecData] = useState('');
  
  const [tgePrioUploadedData, setTgePrioUploadedData] = useState<UploadedRateEntry[]>([]);
  const [tgePrioComparisonResults, setTgePrioComparisonResults] = useState<RateComparisonItem[]>([]);
  const [pastedTgePrioData, setPastedTgePrioData] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const overallLoading = isProcessing || isLoadingRatesContext;

  const tgeIpecForm = useForm<TgeComparisonFormValues>({
    resolver: zodResolver(tgeComparisonFormSchema),
    defaultValues: { companyName: '', spendBand: globalSpendBands[0] || "1", sampleWeight: 10 }
  });
  
  const tgePrioForm = useForm<TgeComparisonFormValues>({
    resolver: zodResolver(tgeComparisonFormSchema),
    defaultValues: { companyName: '', spendBand: globalSpendBands[0] || "1", sampleWeight: 10 }
  });

  const parseVal = (v: any): number => {
    if (v === null || v === undefined) return 0;
    const clean = String(v).replace(/[^0-9.-]/g, '');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    const file = event.target.files[0];
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (comparisonMode === 'tgeIpec') {
          // RDEX Mapping (TGE BI format starts at row 19)
          const dataRows = rows.slice(18);
          const processed = dataRows.map((row, i) => {
            // Source: Index 4 (E), Destination: Index 7 (H), Basic: Index 13 (N), Freight: Index 32 (AG), Min: Index 37 (AL)
            if (!row[4] || !row[7]) return null;
            return {
              id: `file-ipec-${i}`,
              originZone: String(row[4]).trim(),
              destinationZone: String(row[7]).trim(),
              oldBasic: parseVal(row[13]),
              oldKilo: parseVal(row[32]),
              oldMin: parseVal(row[37]),
            };
          }).filter((e): e is UploadedRateEntry => e !== null);
          setTgeIpecUploadedData(processed);
        } else {
          // Priority Mapping (Format starts at row 3)
          const dataRows = rows.slice(2);
          const processed = dataRows.map((row, i) => {
            const product = String(row[1] || '').trim();
            const service = String(row[3] || '').trim();
            
            // Filter: Only Product 02 and Service 02
            if (product !== '02' || service !== '02') return null;
            if (!row[5] || !row[6]) return null;

            return {
              id: `file-prio-${i}`,
              originZone: String(row[5]).trim(),
              destinationZone: String(row[6]).trim(),
              oldBasic: parseVal(row[11]), // Column L (Index 11)
              oldKilo: parseVal(row[13]),  // Column N (Index 13)
              oldMin: parseVal(row[10]),   // Column K (Index 10)
            };
          }).filter((e): e is UploadedRateEntry => e !== null);
          setTgePrioUploadedData(processed);
        }

        toast({ title: "File Processed", description: `Data has been loaded successfully.` });
      } catch (err: any) {
        toast({ title: "File Error", description: err.message, variant: "destructive" });
      } finally {
        setIsProcessing(false);
        if (event.target) event.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handlePastedData = (data: string): UploadedRateEntry[] => {
    const rawLines = data.trim().split(/\r\n|\n/).filter(line => line.trim());
    if (rawLines.length === 0) return [];

    const entries = rawLines.map((line, i) => {
        const parts = line.split(/\t/);
        if (parts.length < 5) return null;
        
        return {
            id: `paste-h-${i}`,
            originZone: parts[0]?.trim() || '',
            destinationZone: parts[1]?.trim() || '',
            oldBasic: parseVal(parts[2]),
            oldKilo: parseVal(parts[3]), 
            oldMin: parseVal(parts[4]),
        };
    }).filter((e): e is UploadedRateEntry => e !== null);

    if (entries.length > 0) {
        toast({ title: "Data Loaded", description: `Successfully processed ${entries.length} rates.` });
    }
    return entries;
  };

  const handleTgeIpecCompare = async (data: TgeComparisonFormValues) => {
    setIsProcessing(true);
    const b2bData = getRateFile('b2brdex');
    if (!b2bData) { 
      toast({ title: "System Error", description: "RDEX rate file not loaded.", variant: "destructive" });
      setIsProcessing(false); 
      return; 
    }

    const res = tgeIpecUploadedData.map(entry => {
        const origin = zoneIdToCodeMap[entry.originZone] || entry.originZone;
        const dest = zoneIdToCodeMap[entry.destinationZone] || entry.destinationZone;
        const logicKey = `Parcel${origin}${dest}`;
        const newEntry = (b2bData as any[]).find(r => String(r.Logic).toUpperCase() === logicKey.toUpperCase());

        if (!newEntry) return { rateEntry: entry, error: "Not found" };

        const newBasic = Number(newEntry[`B${data.spendBand}`]);
        const newKilo = Number(newEntry[`K${data.spendBand}`]);
        const newMin = Number(newEntry[`M${data.spendBand}`]);

        const oldBase = Math.max(entry.oldBasic! + (entry.oldKilo! * data.sampleWeight), entry.oldMin!);
        const newBase = Math.max(newBasic + (newKilo * data.sampleWeight), newMin);
        const mult = (1 + standardFuelSurcharge/100) * (1 + globalSecuritySurchargePercent/100);

        return { 
          rateEntry: entry, 
          newBasic, 
          newKilo, 
          newMin, 
          oldCostAtSampleWeight: oldBase * mult, 
          newCostAtSampleWeight: newBase * mult, 
          costDifference: (newBase - oldBase) * mult,
          oldRateFormula: `MAX(${entry.oldBasic} + (${entry.oldKilo} * ${data.sampleWeight}), ${entry.oldMin}) * Surcharges`,
          newRateFormula: `MAX(${newBasic} + (${newKilo} * ${data.sampleWeight}), ${newMin}) * Surcharges`
        };
    });

    setTgeIpecComparisonResults(res as any);
    setIsProcessing(false);
  };

  const handleTgePrioCompare = async (data: TgeComparisonFormValues) => {
    setIsProcessing(true);
    const b2bPrioData = getRateFile('b2b_priority');
    if (!b2bPrioData) { 
      toast({ title: "System Error", description: "Priority rate file not loaded.", variant: "destructive" });
      setIsProcessing(false); 
      return; 
    }

    const res = tgePrioUploadedData.map(entry => {
        const origin = zoneIdToCodeMap[entry.originZone] || entry.originZone;
        const dest = zoneIdToCodeMap[entry.destinationZone] || entry.destinationZone;
        
        const logicKey = `02 02${origin}${dest}`;
        const newEntry = (b2bPrioData as any[]).find(r => String(r.Logic).toUpperCase() === logicKey.toUpperCase());

        if (!newEntry) return { rateEntry: entry, error: "Not found" };

        const newBasic = Number(newEntry[`B${data.spendBand}`]);
        const newKilo = Number(newEntry[`K${data.spendBand}`]);

        const oldBase = Math.max(entry.oldBasic! + (entry.oldKilo! * data.sampleWeight), entry.oldMin!);
        const newBase = newBasic + (newKilo * data.sampleWeight);
        const mult = (1 + priorityFuelSurcharge/100) * (1 + globalSecuritySurchargePercent/100);

        return { 
          rateEntry: entry, 
          newBasic, 
          newKilo, 
          oldCostAtSampleWeight: oldBase * mult, 
          newCostAtSampleWeight: newBase * mult, 
          costDifference: (newBase - oldBase) * mult,
          oldRateFormula: `MAX(${entry.oldBasic} + (${entry.oldKilo} * ${data.sampleWeight}), ${entry.oldMin}) * Surcharges`,
          newRateFormula: `(${newBasic} + (${newKilo} * ${data.sampleWeight})) * Surcharges`
        };
    });

    setTgePrioComparisonResults(res as any);
    setIsProcessing(false);
  };

  const handleClearData = () => {
    if (comparisonMode === 'tgeIpec') {
      setTgeIpecUploadedData([]);
      setTgeIpecComparisonResults([]);
      setPastedTgeIpecData('');
    } else {
      setTgePrioUploadedData([]);
      setTgePrioComparisonResults([]);
      setPastedTgePrioData('');
    }
    toast({ title: "Data Cleared" });
  };

  return (
    <div className="space-y-8 pb-20">
      <Card className="shadow-xl border-t-4 border-primary print-hide">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="text-2xl font-headline flex items-center">
                <GitCompareArrows className="mr-2 h-7 w-7 text-primary" /> 
                Rate Card Comparison
              </CardTitle>
              <CardDescription>
                Compare existing TGE BI Report rates against the new Spend Bands.
              </CardDescription>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="flex-1 md:flex-initial">
                <UploadCloud className="mr-2 h-4 w-4" /> Upload Excel/CSV
              </Button>
              <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} />
              <Button onClick={() => window.print()} variant="outline" className="flex-1 md:flex-initial">
                <Printer className="mr-2 h-4 w-4" /> Export PDF
              </Button>
              <Button onClick={handleClearData} variant="ghost" className="flex-1 md:flex-initial text-destructive hover:bg-destructive/5">
                <Eraser className="mr-2 h-4 w-4" /> Clear
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs value={comparisonMode} onValueChange={(v) => setComparisonMode(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-muted/50 mb-6 p-1 print-hide">
            <TabsTrigger value="tgeIpec" className="data-[state=active]:bg-primary data-[state=active]:text-white">RDEX Analysis</TabsTrigger>
            <TabsTrigger value="tgePrio" className="data-[state=active]:bg-primary data-[state=active]:text-white">Priority Analysis</TabsTrigger>
        </TabsList>
        
        <TabsContent value="tgeIpec" className="space-y-6">
            <Card className="shadow-md print-hide">
                <CardHeader className="bg-muted/30 border-b">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileSpreadsheet className="h-5 w-5 text-primary" />
                      Step 1: Paste or Upload RDEX Data
                    </CardTitle>
                    <CardDescription>Targeting Columns E, H, N, AG, AL starting on Row 19.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                    <Textarea 
                        value={pastedTgeIpecData} 
                        onChange={(e) => setPastedTgeIpecData(e.target.value)} 
                        placeholder="Paste grid here..." 
                        rows={8} 
                        className="font-mono text-xs" 
                    />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-t pt-6">
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2"><User className="h-4 w-4"/>Company Name</Label>
                            <Input {...tgeIpecForm.register('companyName')} placeholder="e.g. ACME Corp" />
                        </div>
                        <div className="space-y-2">
                            <Label>Spend Band</Label>
                            <Controller name="spendBand" control={tgeIpecForm.control} render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <SelectTrigger><SelectValue/></SelectTrigger>
                                  <SelectContent>{globalSpendBands.map(b=><SelectItem key={b} value={b}>SB {b}</SelectItem>)}</SelectContent>
                                </Select>
                            )} />
                        </div>
                        <div className="space-y-2">
                            <Label>Weight (kg)</Label>
                            <Input type="number" {...tgeIpecForm.register('sampleWeight')} />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button 
                        type="button" 
                        variant="secondary" 
                        onClick={() => setTgeIpecUploadedData(handlePastedData(pastedTgeIpecData))} 
                        disabled={!pastedTgeIpecData.trim()}
                      >
                        Process Paste
                      </Button>
                      <Button 
                        onClick={tgeIpecForm.handleSubmit(handleTgeIpecCompare)} 
                        disabled={overallLoading || tgeIpecUploadedData.length === 0}
                      >
                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
                        Compare ({tgeIpecUploadedData.length} lines)
                      </Button>
                    </div>
                </CardContent>
            </Card>

            {tgeIpecComparisonResults.length > 0 && (
                <Card className="shadow-lg overflow-hidden border-none" id="print-area">
                    <CardHeader className="bg-primary text-primary-foreground">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-lg">RDEX Comparison Analysis: {tgeIpecForm.getValues('companyName') || 'General'}</CardTitle>
                        <Badge variant="outline" className="text-white border-white">SB {tgeIpecForm.getValues('spendBand')} @ {tgeIpecForm.getValues('sampleWeight')}kg</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0 overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-muted/50">
                              <TableRow>
                                <TableHead className="font-bold">Lane (From &gt; To)</TableHead>
                                <TableHead className="text-right font-bold">Old Total</TableHead>
                                <TableHead className="text-right font-bold">New Total</TableHead>
                                <TableHead className="text-right font-bold">Diff</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                                {tgeIpecComparisonResults.map((item, idx) => (
                                  <TableRow key={idx} className="hover:bg-muted/30">
                                      <TableCell className="font-mono text-xs">
                                        {zoneIdToCodeMap[item.rateEntry.originZone] || item.rateEntry.originZone} &gt; {zoneIdToCodeMap[item.rateEntry.destinationZone] || item.rateEntry.destinationZone}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <Popover>
                                          <PopoverTrigger asChild>
                                            <Button variant="ghost" size="sm" className="h-auto p-0 font-mono text-xs text-muted-foreground underline decoration-dotted underline-offset-4">
                                              {formatCurrency(item.oldCostAtSampleWeight)}
                                            </Button>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-80 p-3 bg-slate-900 text-white border-none shadow-2xl">
                                            <div className="space-y-2">
                                              <p className="text-[10px] font-bold uppercase text-slate-400 tracking-widest flex items-center gap-1.5"><CalcIcon className="h-3 w-3"/> Old Calculation Sum</p>
                                              <p className="font-mono text-[11px] leading-relaxed text-blue-200">{item.oldRateFormula}</p>
                                            </div>
                                          </PopoverContent>
                                        </Popover>
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <Popover>
                                          <PopoverTrigger asChild>
                                            <Button variant="ghost" size="sm" className="h-auto p-0 font-mono font-bold text-primary underline decoration-dotted underline-offset-4">
                                              {formatCurrency(item.newCostAtSampleWeight)}
                                            </Button>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-80 p-3 bg-slate-900 text-white border-none shadow-2xl">
                                            <div className="space-y-2">
                                              <p className="text-[10px] font-bold uppercase text-slate-400 tracking-widest flex items-center gap-1.5"><CalcIcon className="h-3 w-3"/> New Calculation Sum</p>
                                              <p className="font-mono text-[11px] leading-relaxed text-blue-200">{item.newRateFormula}</p>
                                            </div>
                                          </PopoverContent>
                                        </Popover>
                                      </TableCell>
                                      <TableCell className={cn("text-right font-mono font-bold", (item.costDifference || 0) < 0 ? "text-green-600" : "text-destructive")}>
                                        {formatCurrency(item.costDifference)}
                                      </TableCell>
                                  </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}
        </TabsContent>

        <TabsContent value="tgePrio" className="space-y-6">
            <Card className="shadow-md print-hide">
                <CardHeader className="bg-muted/30 border-b">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileSpreadsheet className="h-5 w-5 text-primary" />
                      Step 1: Paste or Upload Priority Data
                    </CardTitle>
                    <CardDescription>Targeting Columns F, G, L, N starting on Row 3 (Index 2).</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                    <Textarea 
                        value={pastedTgePrioData} 
                        onChange={(e) => setPastedTgePrioData(e.target.value)} 
                        placeholder="Paste Priority grid here..." 
                        rows={8} 
                        className="font-mono text-xs" 
                    />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-t pt-6">
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2"><User className="h-4 w-4"/>Company Name</Label>
                            <Input {...tgePrioForm.register('companyName')} placeholder="e.g. ACME Corp" />
                        </div>
                        <div className="space-y-2">
                            <Label>Spend Band</Label>
                            <Controller name="spendBand" control={tgePrioForm.control} render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <SelectTrigger><SelectValue/></SelectTrigger>
                                  <SelectContent>{globalSpendBands.map(b=><SelectItem key={b} value={b}>SB {b}</SelectItem>)}</SelectContent>
                                </Select>
                            )} />
                        </div>
                        <div className="space-y-2">
                            <Label>Weight (kg)</Label>
                            <Input type="number" {...tgePrioForm.register('sampleWeight')} />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button 
                        type="button" 
                        variant="secondary" 
                        onClick={() => setTgePrioUploadedData(handlePastedData(pastedTgePrioData))} 
                        disabled={!pastedTgePrioData.trim()}
                      >
                        Process Paste
                      </Button>
                      <Button 
                        onClick={tgePrioForm.handleSubmit(handleTgePrioCompare)} 
                        disabled={overallLoading || tgePrioUploadedData.length === 0}
                      >
                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
                        Compare ({tgePrioUploadedData.length} lines)
                      </Button>
                    </div>
                </CardContent>
            </Card>
            {tgePrioComparisonResults.length > 0 && (
                <Card className="shadow-lg overflow-hidden border-none" id="print-area-prio">
                    <CardHeader className="bg-primary text-primary-foreground">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-lg">Priority Comparison Analysis: {tgePrioForm.getValues('companyName') || 'General'}</CardTitle>
                        <Badge variant="outline" className="text-white border-white">SB {tgePrioForm.getValues('spendBand')} @ {tgePrioForm.getValues('sampleWeight')}kg</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0 overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-muted/50">
                              <TableRow>
                                <TableHead className="font-bold">Lane (From &gt; To)</TableHead>
                                <TableHead className="text-right font-bold">Old Total</TableHead>
                                <TableHead className="text-right font-bold">New Total</TableHead>
                                <TableHead className="text-right font-bold">Diff</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                                {tgePrioComparisonResults.map((item, idx) => (
                                  <TableRow key={idx} className="hover:bg-muted/30">
                                      <TableCell className="font-mono text-xs">
                                        {zoneIdToCodeMap[item.rateEntry.originZone] || item.rateEntry.originZone} &gt; {zoneIdToCodeMap[item.rateEntry.destinationZone] || item.rateEntry.destinationZone}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <Popover>
                                          <PopoverTrigger asChild>
                                            <Button variant="ghost" size="sm" className="h-auto p-0 font-mono text-xs text-muted-foreground underline decoration-dotted underline-offset-4">
                                              {formatCurrency(item.oldCostAtSampleWeight)}
                                            </Button>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-80 p-3 bg-slate-900 text-white border-none shadow-2xl">
                                            <div className="space-y-2">
                                              <p className="text-[10px] font-bold uppercase text-slate-400 tracking-widest flex items-center gap-1.5"><CalcIcon className="h-3 w-3"/> Old Calculation Sum</p>
                                              <p className="font-mono text-[11px] leading-relaxed text-blue-200">{item.oldRateFormula}</p>
                                            </div>
                                          </PopoverContent>
                                        </Popover>
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <Popover>
                                          <PopoverTrigger asChild>
                                            <Button variant="ghost" size="sm" className="h-auto p-0 font-mono font-bold text-primary underline decoration-dotted underline-offset-4">
                                              {formatCurrency(item.newCostAtSampleWeight)}
                                            </Button>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-80 p-3 bg-slate-900 text-white border-none shadow-2xl">
                                            <div className="space-y-2">
                                              <p className="text-[10px] font-bold uppercase text-slate-400 tracking-widest flex items-center gap-1.5"><CalcIcon className="h-3 w-3"/> New Calculation Sum</p>
                                              <p className="font-mono text-[11px] leading-relaxed text-blue-200">{item.newRateFormula}</p>
                                            </div>
                                          </PopoverContent>
                                        </Popover>
                                      </TableCell>
                                      <TableCell className={cn("text-right font-mono font-bold", (item.costDifference || 0) < 0 ? "text-green-600" : "text-destructive")}>
                                        {formatCurrency(item.costDifference)}
                                      </TableCell>
                                  </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

"use client";

import React, { useState, useRef, useMemo } from 'react';
import { useAuth } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  UploadCloud, 
  Save, 
  FileSpreadsheet, 
  Database, 
  Lock,
  Search,
  Info
} from 'lucide-react';
import { useRateOverrides } from '@/context/RateOverrideContext';
import type { RASRateEntry } from '@/lib/types';
import * as XLSX from 'xlsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

type TargetService = 'IPEC' | 'Priority' | 'Both';

export default function UpdateRasPageContent() {
  const { user, actualRole } = useAuth();
  const { rasData = [] } = useRateOverrides();
  const { toast } = useToast();
  
  const [targetService, setTargetService] = useState<TargetService>('Both');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [password, setPassword] = useState('');
  const [headerRow, setHeaderRow] = useState('1');
  
  const [importedData, setImportedData] = useState<RASRateEntry[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    const file = event.target.files[0];
    setFileName(file.name);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const dataArr = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(dataArr, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const range = parseInt(headerRow, 10) - 1;
        const rawJson = XLSX.utils.sheet_to_json<any>(worksheet, { range });

        if (rawJson.length === 0) {
            throw new Error("The selected file contains no data rows.");
        }

        const findColumn = (hints: string[]) => {
            const firstRow = rawJson[0];
            return Object.keys(firstRow).find(key => 
                hints.some(hint => key.toLowerCase().includes(hint.toLowerCase()))
            );
        };

        const colPostcode = findColumn(['Postcode', 'PC', 'P/Code']);
        const colSuburb = findColumn(['Suburb', 'Town', 'Locality']);
        const colPrice = findColumn(['Price', 'Surcharge', 'Rate', 'Amount', 'Charge']);

        if (!colPostcode || !colSuburb || !colPrice) {
            throw new Error(`Columns not identified. Found: ${Object.keys(rawJson[0]).join(', ')}. Need Postcode, Suburb, and Price.`);
        }

        const currentRas: RASRateEntry[] = JSON.parse(JSON.stringify(rasData));
        const updatedRas = [...currentRas];

        rawJson.forEach(row => {
            const pc = parseInt(String(row[colPostcode]), 10);
            const sub = String(row[colSuburb]).trim().toUpperCase();
            const val = parseFloat(String(row[colPrice]).replace(/[^0-9.-]/g, '')) || 0;

            if (isNaN(pc)) return;

            let existing = updatedRas.find(r => r.postcode === pc && r.suburb.trim().toUpperCase() === sub);

            if (existing) {
                if (targetService === 'IPEC' || targetService === 'Both') existing.ipec = val;
                if (targetService === 'Priority' || targetService === 'Both') existing.prio = val;
            } else {
                updatedRas.push({
                    postcode: pc,
                    suburb: sub,
                    ipec: (targetService === 'IPEC' || targetService === 'Both') ? val : 0,
                    prio: (targetService === 'Priority' || targetService === 'Both') ? val : 0
                });
            }
        });

        setImportedData(updatedRas);
        toast({ title: "File Processed", description: `Merged ${rawJson.length} rows into database.` });
      } catch (error: any) {
        toast({ title: "Import Error", description: error.message, variant: "destructive" });
      } finally {
        setIsProcessing(false);
        if (event.target) event.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSave = async () => {
    if (!importedData || !user) return;
    if (password !== 'LCPTGE') {
        toast({ title: "Authorization Failed", description: "Incorrect server write password.", variant: "destructive" });
        return;
    }

    setIsSaving(true);
    try {
        const token = await user.getIdToken();
        const response = await fetch('/api/update-rate-file', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                fileName: 'ras.json',
                fileContentString: JSON.stringify(importedData, null, 2)
            })
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || result.details);

        toast({ title: "Save Successful", description: "RAS database has been updated globally." });
        setImportedData(null);
        setFileName(null);
        setPassword('');
    } catch (error: any) {
        toast({ title: "Save Failed", description: error.message, variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
  };

  const filteredPreview = useMemo(() => {
    if (!importedData) return [];
    if (!searchTerm) return importedData.slice(0, 100);
    return importedData.filter(r => 
        r.suburb.toLowerCase().includes(searchTerm.toLowerCase()) || 
        r.postcode.toString().includes(searchTerm)
    ).slice(0, 100);
  }, [importedData, searchTerm]);

  if (actualRole !== 'superadmin') {
    return <div className="p-20 text-center">Unauthorized. Superadmin access only.</div>;
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20">
      <Card className="shadow-xl border-t-4 border-primary">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start gap-4">
            <div>
              <CardTitle className="text-2xl font-headline flex items-center">
                <Database className="mr-2 h-7 w-7 text-primary" /> Update Remote Area Surcharges
              </CardTitle>
              <CardDescription>
                Bulk update RAS rates for IPEC and Priority. Select target network then upload Excel/CSV.
              </CardDescription>
            </div>
            <Badge variant="outline" className="bg-primary/5 text-primary">Master Data: ras.json</Badge>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 shadow-md h-fit">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-primary"/> Import Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Target Network</Label>
              <Select value={targetService} onValueChange={(v) => setTargetService(v as TargetService)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Both">Both (Full List Update)</SelectItem>
                  <SelectItem value="IPEC">IPEC Only (Standard)</SelectItem>
                  <SelectItem value="Priority">Priority Only (Express)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Header Row Starts At</Label>
              <Select value={headerRow} onValueChange={setHeaderRow}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 10, 19].map(r => <SelectItem key={r} value={String(r)}>Row {r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="pt-2">
                <Button 
                    onClick={() => fileInputRef.current?.click()} 
                    disabled={isProcessing} 
                    variant="outline" 
                    className="w-full h-24 border-dashed border-2 flex flex-col gap-2"
                >
                    {isProcessing ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <UploadCloud className="h-8 w-8 text-primary" />}
                    <div className="text-center">
                        <p className="text-sm font-bold">{fileName || "Click to Upload File"}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">Excel (.xlsx) or CSV (.csv)</p>
                    </div>
                </Button>
                <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} />
            </div>

            {importedData && (
                <div className="space-y-4 pt-4 border-t">
                    <div className="space-y-1">
                        <Label className="flex items-center gap-2"><Lock className="h-3 w-3" /> Server Write Password</Label>
                        <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Required to save..." />
                    </div>
                    <Button onClick={handleSave} disabled={isSaving || password !== 'LCPTGE'} className="w-full">
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <Save className="h-4 w-4 mr-2" />}
                        Apply Changes to Server
                    </Button>
                </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 shadow-md">
          <CardHeader className="bg-muted/30 border-b">
            <div className="flex justify-between items-center">
                <div>
                    <CardTitle className="text-lg">Database Preview</CardTitle>
                    <CardDescription>{importedData ? "Previewing merged results..." : `Viewing current production data (${rasData.length} records).`}</CardDescription>
                </div>
                <div className="relative w-48">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <Input placeholder="Filter..." className="pl-7 h-8 text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0 z-10">
                  <TableRow>
                    <TableHead>Postcode</TableHead>
                    <TableHead>Suburb</TableHead>
                    <TableHead className="text-right">IPEC ($)</TableHead>
                    <TableHead className="text-right">Priority ($)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPreview.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{r.postcode}</TableCell>
                      <TableCell className="font-bold text-xs">{r.suburb}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-blue-600">{r.ipec.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-cyan-600">{r.prio.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                  {filteredPreview.length === 0 && (
                      <TableRow>
                          <TableCell colSpan={4} className="text-center py-20 text-muted-foreground italic">No data to display. Upload a file to see preview.</TableCell>
                      </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
          <CardFooter className="bg-muted/10 border-t py-2">
            <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 uppercase font-black tracking-widest">
                <Info className="h-3 w-3" /> Showing top 100 results only.
            </p>
          </CardFooter>
        </Card>
      </div>

      <Alert className="bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-800">Merge Strategy Info</AlertTitle>
          <AlertDescription className="text-blue-700 text-xs">
              This tool matches rows by Postcode + Suburb. If you select "IPEC Only", Priority rates for those locations are preserved. New locations are added automatically.
          </AlertDescription>
      </Alert>
    </div>
  );
}

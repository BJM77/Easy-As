"use client";

import React, { useState, useRef, useMemo, useEffect } from 'react';
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
import { verifyAdminPassword } from '@/ai/flows/admin-auth-flow';

type TargetService = 'IPEC' | 'Priority' | 'Both';

export default function UpdateRasPageContent() {
  const { user, actualRole } = useAuth();
  const { rasData = [] } = useRateOverrides();
  const { toast } = useToast();
  
  const [targetService, setTargetService] = useState<TargetService>('Both');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [password, setPassword] = useState('');
  const [isPasswordValid, setIsPasswordValid] = useState(false);
  const [headerRow, setHeaderRow] = useState('1');
  const [importedData, setImportedData] = useState<RASRateEntry[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

        if (rawJson.length === 0) throw new Error("File contains no data.");

        const findColumn = (hints: string[]) => {
            const firstRow = rawJson[0];
            return Object.keys(firstRow).find(key => 
                hints.some(hint => key.toLowerCase().includes(hint.toLowerCase()))
            );
        };

        const colPostcode = findColumn(['Postcode', 'PC', 'P/Code']);
        const colSuburb = findColumn(['Suburb', 'Town', 'Locality']);
        const colPrice = findColumn(['Price', 'Surcharge', 'Rate', 'Amount', 'Charge']);

        if (!colPostcode || !colSuburb || !colPrice) throw new Error("Could not identify required columns.");

        const updatedRas: RASRateEntry[] = JSON.parse(JSON.stringify(rasData));

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
        toast({ title: "File Processed" });
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
    if (!importedData || !user || !isPasswordValid) return;
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
        if (!response.ok) throw new Error("Server rejected update.");
        toast({ title: "Save Successful" });
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
    const data = importedData || rasData;
    if (!searchTerm) return data.slice(0, 100);
    return data.filter(r => 
        r.suburb.toLowerCase().includes(searchTerm.toLowerCase()) || 
        r.postcode.toString().includes(searchTerm)
    ).slice(0, 100);
  }, [importedData, rasData, searchTerm]);

  if (actualRole !== 'superadmin') {
    return <div className="p-20 text-center">Unauthorized.</div>;
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20">
      <Card className="shadow-xl border-t-4 border-primary">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start gap-4">
            <div>
              <CardTitle className="text-2xl font-headline flex items-center">
                <Database className="mr-2 h-7 w-7 text-primary" /> Update RAS Surcharges
              </CardTitle>
              <CardDescription>Bulk update Remote Area Surcharge database.</CardDescription>
            </div>
            <Badge variant="outline">ras.json</Badge>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="h-fit">
          <CardHeader><CardTitle className="text-lg">Settings</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Target Network</Label>
              <Select value={targetService} onValueChange={(v) => setTargetService(v as TargetService)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Both">Both</SelectItem>
                  <SelectItem value="IPEC">IPEC</SelectItem>
                  <SelectItem value="Priority">Priority</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => fileInputRef.current?.click()} disabled={isProcessing} variant="outline" className="w-full border-dashed h-20 flex flex-col gap-1">
                {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <UploadCloud className="h-5 w-5" />}
                <span className="text-xs font-bold">{fileName || "Upload Excel/CSV"}</span>
            </Button>
            <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} />

            {importedData && (
                <div className="space-y-3 pt-4 border-t">
                    <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-black">Admin Auth</Label>
                        <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password..." className="h-8" />
                    </div>
                    <Button onClick={handleSave} disabled={isSaving || !isPasswordValid} className="w-full h-9">
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <Save className="h-4 w-4 mr-2" />} Save Database
                    </Button>
                </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="bg-muted/30 border-b flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Database Preview</CardTitle>
            <Input placeholder="Filter..." className="w-48 h-8 text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader><TableRow><TableHead>PC</TableHead><TableHead>Suburb</TableHead><TableHead className="text-right">IPEC</TableHead><TableHead className="text-right">Prio</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filteredPreview.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{r.postcode}</TableCell>
                      <TableCell className="font-bold text-[10px]">{r.suburb}</TableCell>
                      <TableCell className="text-right font-mono text-xs">${r.ipec.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">${r.prio.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

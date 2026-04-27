"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UploadCloud, FileJson, Download, Eye, Search, MapPin, ArrowRight, PlusCircle, Trash2, Save, FileType } from 'lucide-react';
import { useRateOverrides } from '@/context/RateOverrideContext';
import type { RateFileType, RateData } from '@/lib/types';
import * as XLSX from 'xlsx';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter
} from "@/components/ui/alert-dialog";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogContent } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';

const zoneIdToCodeMap: Record<string, string> = {
  "200": "SYD", "210": "ABX", "211": "CBR", "212": "NTL", "213": "WOL",
  "201": "NSW1", "202": "NSW2", "203": "NSW3", "204": "NSW4", "205": "NSW5",
  "206": "NSW6", "207": "NSW7", "208": "NSW8", "209": "NSW9", "300": "MEL",
  "301": "VIC1", "302": "VIC2", "400": "BNE", "410": "CNS", "411": "MKY",
  "412": "ROK", "413": "TSV", "414": "YORK", "401": "QLD1", "402": "QLD2",
  "403": "QLD3", "404": "QLD4", "405": "QLD5", "406": "QLD6", "407": "QLD7",
  "408": "QLD8", "409": "QLD9", "500": "ADL", "501": "SA1", "502": "SA2",
  "503": "SA3", "504": "SA4", "505": "SA5", "600": "PER", "601": "WA1",
  "602": "WA2", "603": "WA3", "604": "WA4", "800": "DRW", "802": "ASP",
  "801": "NT1", "700": "HBA", "704": "LST", "701": "TAS1", "702": "TAS2", "703": "TAS3",
};

interface CustomColumnMapping {
  id: string;
  jsonKey: string;
  excelMapping: string;
  placeholder?: string;
}

interface SavedLayout {
  name: string;
  mapping: CustomColumnMapping[];
}

type NamingMode = 'main' | 'customer';

interface ConverterState {
  title: string;
  baseFileType: string;
  namingMode: NamingMode;
  excelPreviewData: any[][];
  excelFileName: string;
  isProcessingExcel: boolean;
  columnMapping: CustomColumnMapping[];
  startRow: string;
  jsonContent: string;
  numericalZones: boolean;
  savedLayouts: SavedLayout[];
  isSaveLayoutOpen: boolean;
  newLayoutName: string;
  selectedLayoutToLoad: string;
}

const getColumnLetter = (n: number): string => {
  let letter = '';
  while (n >= 0) {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
};

const columnIndexes = Array.from({ length: 100 }, (_, i) => getColumnLetter(i));

let mappingIdCounter = 0;
const generateMappingId = () => `custom-${Date.now()}-${mappingIdCounter++}`;

const createInitialConverterState = (
  title: string,
  baseFileType: string,
  startRow: string,
  columnMapping: CustomColumnMapping[],
  numericalZones: boolean,
  namingMode: NamingMode = 'customer'
): ConverterState => ({
  title,
  baseFileType,
  namingMode,
  excelPreviewData: [],
  excelFileName: '',
  isProcessingExcel: false,
  columnMapping,
  startRow,
  jsonContent: '',
  numericalZones,
  savedLayouts: [],
  isSaveLayoutOpen: false,
  newLayoutName: '',
  selectedLayoutToLoad: '',
});

const initialConverterStates: Record<string, ConverterState> = {
  ipec: createInitialConverterState('B2B Standard (RDEX)', 'b2brdex', '2', [
    { id: generateMappingId(), jsonKey: 'Logic', excelMapping: 'Parcel{F}{G}', placeholder: 'Logic (Parcel+From+To)' },
    { id: generateMappingId(), jsonKey: 'B1', excelMapping: '{L}', placeholder: 'Basic Charge' },
    { id: generateMappingId(), jsonKey: 'K1', excelMapping: '{N}', placeholder: 'Kilo Rate' },
    { id: generateMappingId(), jsonKey: 'M1', excelMapping: '{K}', placeholder: 'Min Charge' }
  ], true),
  lcprdex: createInitialConverterState('LCP Standard (LCPRDEX)', 'lcprdex', '2', [
    { id: generateMappingId(), jsonKey: 'Logic', excelMapping: 'LCPRDEX{B}{C}', placeholder: 'Logic (LCPRDEX+From+To)' },
    { id: generateMappingId(), jsonKey: 'LCPRDEXBasic', excelMapping: '{E}', placeholder: 'Basic Charge' },
    { id: generateMappingId(), jsonKey: 'LCPRDEXKg', excelMapping: '{J}', placeholder: 'Kilo Rate' }
  ], true),
  priority: createInitialConverterState('B2B Priority', 'b2b_priority', '2', [
    { id: generateMappingId(), jsonKey: 'Logic', excelMapping: '02 02{F}{G}', placeholder: 'Logic (02 02+From+To)' },
    { id: generateMappingId(), jsonKey: 'B1', excelMapping: '{L}', placeholder: 'Basic Charge' },
    { id: generateMappingId(), jsonKey: 'K1', excelMapping: '{N}', placeholder: 'Kilo Rate' }
  ], true),
  lcpgo: createInitialConverterState('LCP GO (Tiered)', 'lcpgo', '2', [
    { id: generateMappingId(), jsonKey: 'Logic', excelMapping: 'GoOvernight{F}{G}', placeholder: 'Logic (GoOvernight/GoOff Peak + From + To)' },
    { id: generateMappingId(), jsonKey: 'Go1', excelMapping: '{R}', placeholder: '1kg Rate' },
    { id: generateMappingId(), jsonKey: 'Go3', excelMapping: '{T}', placeholder: '3kg Rate' },
    { id: generateMappingId(), jsonKey: 'Go5', excelMapping: '{V}', placeholder: '5kg Rate' },
    { id: generateMappingId(), jsonKey: 'Go10', excelMapping: '{X}', placeholder: '10kg Rate' }
  ], true),
  b2c: createInitialConverterState('B2C Rates', 'b2c', '2', [
    { id: generateMappingId(), jsonKey: 'Logic', excelMapping: 'B2CStandard{F}{G}', placeholder: 'Logic (B2CStandard+From+To)' },
    { id: generateMappingId(), jsonKey: 'b2c1', excelMapping: '{R}', placeholder: '1kg Rate' },
    { id: generateMappingId(), jsonKey: 'b2c3', excelMapping: '{T}', placeholder: '3kg Rate' },
    { id: generateMappingId(), jsonKey: 'b2c5', excelMapping: '{V}', placeholder: '5kg Rate' },
    { id: generateMappingId(), jsonKey: 'kg', excelMapping: '{X}', placeholder: 'Over 5kg Rate' }
  ], false),
  pe: createInitialConverterState('Pallet Rates', 'pe', '2', [
    { id: generateMappingId(), jsonKey: 'Logic', excelMapping: 'ParcelPallets{F}{G}', placeholder: 'Logic (ParcelPallets+From+To)' },
    { id: generateMappingId(), jsonKey: 'From', excelMapping: '{F}', placeholder: 'Origin PE Zone' },
    { id: generateMappingId(), jsonKey: 'To', excelMapping: '{G}', placeholder: 'Dest PE Zone' },
    { id: generateMappingId(), jsonKey: 'EBasic', excelMapping: '{L}', placeholder: 'Express Basic' },
    { id: generateMappingId(), jsonKey: 'Eminimum', excelMapping: '{K}', placeholder: 'Express Min' },
    { id: generateMappingId(), jsonKey: 'E0 - 250', excelMapping: '{N}', placeholder: 'Express Kilo' }
  ], false),
  west_east: createInitialConverterState('WA PE Special', 'west_east', '2', [
    { id: generateMappingId(), jsonKey: 'To', excelMapping: '{G}', placeholder: 'Dest City Name' },
    { id: generateMappingId(), jsonKey: 'Basic', excelMapping: '{L}', placeholder: 'Basic Charge' },
    { id: generateMappingId(), jsonKey: 'Minimum', excelMapping: '{K}', placeholder: 'Min Charge' },
    { id: generateMappingId(), jsonKey: '0-99999KGS', excelMapping: '{N}', placeholder: 'Kilo Rate' }
  ], false),
};

export default function CsvConverterPageContent() {
  const { toast } = useToast();
  const { setRateOverride } = useRateOverrides();
  const [isJsonViewerOpen, setIsJsonViewerOpen] = useState(false);
  const [jsonViewerContent, setJsonViewerContent] = useState('');
  const [accordionState, setAccordionState] = useState<string | string[]>(['ipec']);
  const [converters, setConverters] = useState<Record<string, ConverterState>>(initialConverterStates);
  const [zoneSearch, setZoneSearch] = useState('');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    try {
      const storedLayoutsRaw = localStorage.getItem('tgeJsonCreatorLayouts');
      if (storedLayoutsRaw) {
        const allStoredLayouts = JSON.parse(storedLayoutsRaw);
        setConverters(prev => {
          const newConverters = { ...prev };
          for (const key in newConverters) {
            if (allStoredLayouts[key]) {
              newConverters[key].savedLayouts = allStoredLayouts[key];
            }
          }
          return newConverters;
        });
      }
    } catch (e) {
      console.error("Failed to load layouts from localStorage:", e);
    }
  }, []);

  const updateConverterState = (key: string, updates: Partial<ConverterState>) => {
    setConverters(prev => ({ ...prev, [key]: { ...prev[key], ...updates } }));
  };

  const getFinalFileType = (base: string, mode: NamingMode): RateFileType => {
    if (mode === 'customer') {
      if (base === 'pe') return 'customer_pe';
      if (base === 'west_east') return 'customer_west_east';
      return `customer_${base}` as RateFileType;
    }
    if (base === 'pe') return 'pe1'; 
    return base as RateFileType;
  };

  const getFinalFileName = (base: string, mode: NamingMode): string => {
    if (mode === 'customer') {
      if (base === 'pe') return 'customer_pe.json';
      if (base === 'west_east') return 'customer_west_east.json';
      return `customer_${base}.json`;
    }
    if (base === 'pe') return 'pe1.json'; 
    return `${base}.json`;
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, converterKey: string) => {
    if (!event.target.files || event.target.files.length === 0) return;
    const file = event.target.files[0];
    updateConverterState(converterKey, { isProcessingExcel: true, excelFileName: file.name, excelPreviewData: [], jsonContent: '' });
  
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: "array" });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
            updateConverterState(converterKey, { excelPreviewData: jsonData, isProcessingExcel: false });
        } catch (e) {
            toast({ title: "Excel Reading Error", description: "Could not read the Excel file.", variant: "destructive" });
            updateConverterState(converterKey, { isProcessingExcel: false });
        }
    };
    reader.readAsArrayBuffer(file);
    if(event.target) event.target.value = '';
  };
  
  const handleProcessMappedData = (converterKey: string) => {
    const converter = converters[converterKey];
    const { excelPreviewData, startRow, columnMapping, baseFileType, namingMode, numericalZones } = converter;
    if (excelPreviewData.length === 0) { toast({ title: "No Data", description: "Upload an Excel file first.", variant: "destructive" }); return; }
    const startRowIndex = parseInt(startRow, 10) - 1;
    if (isNaN(startRowIndex) || startRowIndex < 0 || startRowIndex >= excelPreviewData.length) { toast({ title: "Invalid Start Row", variant: "destructive" }); return; }
    
    try {
        const dataRows = excelPreviewData.slice(startRowIndex);
        const transformedData = dataRows.map(row => {
            if (!row || !Array.isArray(row)) return null;
            const entry: Record<string, any> = {};
            let hasData = false;
            columnMapping.forEach(mapItem => {
                if (mapItem.jsonKey.trim()) {
                    let processedValue = mapItem.excelMapping;
                    const columnPlaceholders = mapItem.excelMapping.match(/{([A-Z]+)}/g) || [];
                    
                    const placeholderValues: Record<string, string> = {};

                    columnPlaceholders.forEach(placeholder => {
                        const colLetter = placeholder.replace(/[{}]/g, '');
                        const colIndex = columnIndexes.indexOf(colLetter);
                        let cellValue = (colIndex !== -1 && row[colIndex] !== undefined) ? String(row[colIndex]) : '';
                        
                        if (numericalZones) {
                          cellValue = zoneIdToCodeMap[cellValue] || cellValue;
                        }
                        
                        placeholderValues[placeholder] = cellValue;
                        if(cellValue) hasData = true;
                    });
                    
                    for (const placeholder in placeholderValues) {
                        processedValue = processedValue.replace(new RegExp(`\\${placeholder}`, 'g'), placeholderValues[placeholder]);
                    }

                    const numValue = parseFloat(processedValue.replace(/[^0-9.-]/g, ''));
                    if (!isNaN(numValue) && /^[0-9,$. -]+$/.test(processedValue)) entry[mapItem.jsonKey.trim()] = numValue;
                    else entry[mapItem.jsonKey.trim()] = processedValue;
                }
            });
            return hasData ? entry : null;
        }).filter(item => item !== null && Object.keys(item).length > 0);
        
        if (transformedData.length > 0) {
            const jsonString = JSON.stringify(transformedData, null, 2);
            updateConverterState(converterKey, { jsonContent: jsonString });
            const finalFileType = getFinalFileType(baseFileType, namingMode);
            setRateOverride(finalFileType, transformedData as RateData);
            toast({ title: 'Success', description: `${transformedData.length} rows processed and applied as ${finalFileType} override.` });
        } else { throw new Error("No valid data rows could be parsed."); }
    } catch (e) { toast({ title: "Processing Error", description: e instanceof Error ? e.message : "An error occurred.", variant: "destructive" }); }
  };
  
  const handleAddMapping = (converterKey: string) => {
    updateConverterState(converterKey, { columnMapping: [...converters[converterKey].columnMapping, { id: generateMappingId(), jsonKey: '', excelMapping: '' }] });
  };
  
  const handleRemoveMapping = (converterKey: string, id: string) => {
    const { columnMapping } = converters[converterKey];
    if (columnMapping.length > 1) {
      updateConverterState(converterKey, { columnMapping: columnMapping.filter(m => m.id !== id) });
    }
  };
  
  const handleMappingChange = (converterKey: string, id: string, field: 'jsonKey' | 'excelMapping', value: string) => {
    const { columnMapping } = converters[converterKey];
    updateConverterState(converterKey, { columnMapping: columnMapping.map(m => m.id === id ? { ...m, [field]: value } : m) });
  };

  const handleDownloadJson = (jsonContent: string, fileName: string) => {
    if (!jsonContent) return;
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); 
    a.href = url; 
    a.download = fileName;
    document.body.appendChild(a); 
    a.click(); 
    document.body.removeChild(a); 
    URL.revokeObjectURL(url);
  };
  
  const handleSaveLayout = (converterKey: string) => {
    const converter = converters[converterKey];
    if (!converter.newLayoutName.trim()) { toast({ title: 'Layout Name Required', variant: 'destructive' }); return; }
    const newLayout: SavedLayout = { name: converter.newLayoutName, mapping: converter.columnMapping };
    const newLayouts = [...converter.savedLayouts.filter(l => l.name !== converter.newLayoutName), newLayout].slice(-3);
    
    updateConverterState(converterKey, { savedLayouts: newLayouts, isSaveLayoutOpen: false, newLayoutName: '' });

    try {
        const allLayoutsRaw = localStorage.getItem('tgeJsonCreatorLayouts');
        const allLayouts = allLayoutsRaw ? JSON.parse(allLayoutsRaw) : {};
        allLayouts[converterKey] = newLayouts;
        localStorage.setItem('tgeJsonCreatorLayouts', JSON.stringify(allLayouts));
    } catch (e) { console.error("Could not save layout:", e); }
    toast({ title: 'Layout Saved', description: `Layout "${converter.newLayoutName}" saved.` });
  };

  const handleLoadLayout = (converterKey: string, layoutName: string) => {
    const converter = converters[converterKey];
    const layoutToLoad = converter.savedLayouts.find(l => l.name === layoutName);
    if (layoutToLoad) {
      updateConverterState(converterKey, { columnMapping: layoutToLoad.mapping, selectedLayoutToLoad: layoutName });
      toast({ title: 'Layout Loaded', description: `Layout "${layoutName}" applied.` });
    }
  };

  const filteredZones = useMemo(() => {
    if (!zoneSearch) return [];
    return Object.entries(zoneIdToCodeMap).filter(([id, code]) => 
      id.includes(zoneSearch) || code.toLowerCase().includes(zoneSearch.toLowerCase())
    );
  }, [zoneSearch]);

  if (!isMounted) return <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

  return (
    <div className="space-y-8 pb-20">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl md:text-3xl font-bold font-headline flex items-center">
            <FileJson className="mr-2 h-7 w-7 text-primary" /> JSON Creator
          </CardTitle>
          <CardDescription>Convert Excel rate cards into the JSON format required for the application.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg md:text-xl font-bold font-headline flex items-center"><MapPin className="mr-2 h-5 w-5 text-primary"/>Zone ID Reference</CardTitle>
          <CardDescription>Look up numeric zone IDs to see their application codes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-grow">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search ID (e.g. 200) or Code (e.g. SYD)..." className="pl-8" value={zoneSearch} onChange={e => setZoneSearch(e.target.value)} />
            </div>
            <Button variant="ghost" onClick={() => setZoneSearch('')}>Clear</Button>
          </div>
          {filteredZones.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {filteredZones.map(([id, code]) => (
                <Badge key={id} variant="secondary" className="text-sm py-1">
                  <span className="font-mono text-primary mr-2">{id}</span>
                  <ArrowRight className="h-3 w-3 mr-2 text-muted-foreground inline" />
                  <span className="font-bold">{code}</span>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      <Accordion type="multiple" value={Array.isArray(accordionState) ? accordionState : [accordionState]} onValueChange={setAccordionState} className="space-y-4">
        {Object.entries(converters).map(([key, converter]) => (
            <AccordionItem value={key} key={key} className="border rounded-lg bg-card">
              <AccordionTrigger className="flex w-full items-center justify-between p-4 cursor-pointer hover:no-underline">
                <CardTitle className="text-lg font-semibold">{converter.title}</CardTitle>
              </AccordionTrigger>
              <AccordionContent className="pt-0 px-4 pb-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                    <div className="space-y-2">
                      <Label htmlFor={`${key}-naming-mode`} className="flex items-center gap-2"><FileType className="h-4 w-4 text-primary"/>Naming Mode</Label>
                      <Select value={converter.namingMode} onValueChange={(v) => updateConverterState(key, { namingMode: v as NamingMode })}>
                        <SelectTrigger id={`${key}-naming-mode`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="customer">On behalf of Customer (customer_ prefix)</SelectItem>
                          <SelectItem value="main">Main Core Data (original name)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`${key}-excel-upload`} className="font-medium">Upload Excel Rate Card</Label>
                      <Input id={`${key}-excel-upload`} type="file" accept=".xlsx, .xls" onChange={(e) => handleFileUpload(e, key)} disabled={converter.isProcessingExcel} />
                    </div>
                  </div>

                  {converter.isProcessingExcel && <div className="flex items-center text-muted-foreground py-4"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Reading file...</div>}
                  
                  {converter.excelPreviewData.length > 0 && (
                    <Card className="my-4 bg-muted/30">
                      <CardHeader><CardTitle className="text-base">Field Mapper Configuration</CardTitle></CardHeader>
                      <CardContent className="space-y-4">
                         <div className="flex flex-wrap items-center gap-6">
                           <div className="space-y-1 w-24"><Label>Start Row</Label><Input value={converter.startRow} onChange={e => updateConverterState(key, { startRow: e.target.value })} type="number" /></div>
                            <div className="flex items-center space-x-2">
                              <Switch id={`numerical-zones-${key}`} checked={converter.numericalZones} onCheckedChange={(checked) => updateConverterState(key, { numericalZones: checked })} />
                              <Label htmlFor={`numerical-zones-${key}`}>Translate Numeric Zones (e.g. 200 → SYD)</Label>
                            </div>
                         </div>
                         <div className="space-y-3">
                           {converter.columnMapping.map((mapping) => (
                             <div key={mapping.id} className="flex items-end gap-2 p-2 border rounded bg-background">
                               <div className="flex-grow space-y-1">
                                 <Label className="text-xs text-muted-foreground">JSON Key</Label>
                                 <Input value={mapping.jsonKey} onChange={(e) => handleMappingChange(key, mapping.id, 'jsonKey', e.target.value)} placeholder={mapping.placeholder} className="h-8 text-sm" />
                               </div>
                               <div className="flex-grow space-y-1">
                                 <Label className="text-xs text-muted-foreground">Excel Mapping (e.g. {getColumnLetter(0)} or Parcel{getColumnLetter(5)}{getColumnLetter(6)})</Label>
                                 <Input value={mapping.excelMapping} onChange={(e) => handleMappingChange(key, mapping.id, 'excelMapping', e.target.value)} className="h-8 text-sm" />
                               </div>
                               <Button variant="ghost" size="icon" onClick={() => handleRemoveMapping(key, mapping.id)} disabled={converter.columnMapping.length <= 1} className="h-8 w-8"><Trash2 className="h-4 w-4 text-destructive"/></Button>
                             </div>
                           ))}
                         </div>
                         <div className="flex gap-2 items-center flex-wrap">
                            <Button onClick={() => handleAddMapping(key)} variant="outline" size="sm"><PlusCircle className="mr-2 h-4 w-4"/>Add Field</Button>
                            <Button onClick={() => updateConverterState(key, { isSaveLayoutOpen: true })} variant="outline" size="sm"><Save className="mr-2 h-4 w-4"/>Save Layout</Button>
                             <Select onValueChange={(layoutName) => handleLoadLayout(key, layoutName)} value={converter.selectedLayoutToLoad}>
                              <SelectTrigger className="h-9 w-[180px] text-xs"><SelectValue placeholder="Load a layout..."/></SelectTrigger>
                              <SelectContent>{converter.savedLayouts.map(l => <SelectItem key={l.name} value={l.name}>{l.name}</SelectItem>)}</SelectContent>
                            </Select>
                         </div>
                         <Button onClick={() => handleProcessMappedData(key)} className="w-full sm:w-auto bg-primary text-primary-foreground font-bold">Process & Apply Overrides</Button>
                         <h4 className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground pt-2">File Preview (First 25 rows)</h4>
                          <ScrollArea className="h-64 border rounded-md bg-background"><div className="relative w-full overflow-auto"><Table className="text-xs table-fixed border"><TableHeader><TableRow>{columnIndexes.slice(0, Math.max(26, (converter.excelPreviewData[0]?.length || 0))).map(c => <TableHead key={c} className="p-1 border text-center font-bold bg-muted/50">{c}</TableHead>)}</TableRow></TableHeader><TableBody>{converter.excelPreviewData.slice(0, 25).map((row, rowIndex) => (<TableRow key={rowIndex} className="hover:bg-muted/30 transition-colors"><TableCell className="p-1 text-center font-mono text-muted-foreground border bg-muted/10">{rowIndex + 1}</TableCell>{columnIndexes.slice(0, Math.max(26, (converter.excelPreviewData[0]?.length || 0))).map((c, cellIndex) => <TableCell key={cellIndex} className="p-1 whitespace-nowrap border">{String(row[cellIndex] || '')}</TableCell>)}</TableRow>))}</TableBody></Table></div></ScrollArea>
                      </CardContent>
                    </Card>
                  )}
                  {converter.jsonContent && (
                    <div className="flex flex-col sm:flex-row gap-2 items-end mt-4">
                      <div className="flex-grow space-y-1">
                        <Label>Export Filename</Label>
                        <Input value={getFinalFileName(converter.baseFileType, converter.namingMode)} readOnly />
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <Button variant="outline" onClick={() => handleDownloadJson(converter.jsonContent, getFinalFileName(converter.baseFileType, converter.namingMode))} className="w-full sm:w-auto"><Download className="mr-2 h-4 w-4" /> Download JSON</Button>
                        <Button variant="ghost" onClick={() => { setJsonViewerContent(converter.jsonContent); setIsJsonViewerOpen(true); }} className="w-full sm:w-auto"><Eye className="mr-2 h-4 w-4" /> View</Button>
                      </div>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
        ))}
      </Accordion>

      <AlertDialog open={isJsonViewerOpen} onOpenChange={setIsJsonViewerOpen}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader><AlertDialogTitle>Generated JSON Output</AlertDialogTitle><AlertDialogDescription>This is the JSON generated from your mapping. It has been applied as an override for this session.</AlertDialogDescription></AlertDialogHeader>
          <ScrollArea className="h-[60vh] w-full rounded-md border p-4 bg-background font-mono"><pre className="text-xs whitespace-pre-wrap">{jsonViewerContent}</pre></ScrollArea>
          <AlertDialogFooter><AlertDialogAction onClick={() => setIsJsonViewerOpen(false)}>Close</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {Object.entries(converters).map(([key, converter]) => (
        <Dialog key={`dialog-${key}`} open={converter.isSaveLayoutOpen} onOpenChange={(open) => updateConverterState(key, { isSaveLayoutOpen: open })}>
          <DialogContent>
            <DialogHeader><DialogTitle>Save Mapping Layout</DialogTitle><DialogDescription>Give this layout a name to save it for future use with {converter.title}.</DialogDescription></DialogHeader>
            <div className="py-4"><Label htmlFor={`layout-name-${key}`}>Layout Name</Label><Input id={`layout-name-${key}`} value={converter.newLayoutName} onChange={e => updateConverterState(key, { newLayoutName: e.target.value })} autoFocus /></div>
            <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={() => handleSaveLayout(key)}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      ))}
    </div>
  );
}

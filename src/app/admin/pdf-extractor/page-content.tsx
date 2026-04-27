"use client";

import React, { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileText, UploadCloud, Download, Sparkles, FileJson, CheckCircle2, RefreshCw, Info, ListOrdered } from 'lucide-react';
import { extractPdfData, type ExtractPdfOutput } from '@/ai/flows/extract-pdf-data-flow';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSession } from '@/context/SessionContext';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { transformPdfDataToAppLogic } from '@/lib/freightCalculations';
import * as XLSX from 'xlsx';

type TargetBU = 'B2B Standard' | 'B2B Priority' | 'B2C' | 'Pallets' | 'LCP Standard' | 'LCP Priority' | 'LCP GO Standard' | 'LCP GO Priority';

export default function PdfExtractorPageContent() {
  const { toast } = useToast();
  const { addTokens } = useSession();
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractPdfOutput | null>(null);
  const [extractionType, setExtractionType] = useState<string>('Rate Card');
  const [customInstructions, setCustomInstructions] = useState('');
  const [targetBU, setTargetBU] = useState<TargetBU>('B2B Standard');
  const [headerRow, setHeaderRow] = useState<string>('1');
  const [formattedData, setFormattedData] = useState<any[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    const file = event.target.files[0];
    const fileType = file.name.split('.').pop()?.toLowerCase();
    
    const allowedTypes = ['pdf', 'csv', 'xls', 'xlsx'];
    if (!fileType || !allowedTypes.includes(fileType)) {
      toast({ title: "Invalid File", description: "Please upload a PDF, Excel, or CSV document.", variant: "destructive" });
      return;
    }

    setFileName(file.name);
    setResult(null);
    setFormattedData(null);
    setIsProcessing(true);

    const reader = new FileReader();
    
    if (fileType === 'pdf') {
      reader.onload = async (e) => {
        const dataUri = e.target?.result as string;
        try {
          const { result: aiResult, usage } = await extractPdfData({
            pdfDataUri: dataUri,
            extractionType: extractionType as any,
            customInstructions: customInstructions || "Standardize all rows. Extract 'Basic', 'Kilo Rate Thereafter', and 'Min Charge'."
          });
          
          addTokens(usage.totalTokens);
          setResult(aiResult);
          toast({ title: "Extraction Complete", description: "Data has been extracted from the PDF." });
        } catch (error) {
          console.error("PDF extraction failed:", error);
          toast({ 
            title: "Extraction Failed", 
            description: error instanceof Error ? error.message : "AI could not process this PDF.", 
            variant: "destructive" 
          });
        } finally {
          setIsProcessing(false);
        }
      };
      reader.readAsDataURL(file);
    } else {
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          
          const headerRowIndex = parseInt(headerRow, 10) - 1;
          const json = XLSX.utils.sheet_to_json(worksheet, { range: headerRowIndex });
          
          setResult({
            extractedData: json,
            summary: `Successfully parsed ${json.length} rows from ${fileType.toUpperCase()} starting at row ${headerRow}.`
          });
          toast({ title: "Parsing Complete", description: `${json.length} rows loaded from ${file.name}.` });
        } catch (error) {
          toast({ title: "File Error", description: "Could not read the spreadsheet data. Ensure the Header Row is correct.", variant: "destructive" });
        } finally {
          setIsProcessing(false);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const transformToAppFormat = () => {
    if (!result || !result.extractedData) return;
    
    const raw = Array.isArray(result.extractedData) ? result.extractedData : [result.extractedData];
    const transformed = transformPdfDataToAppLogic(raw, targetBU);

    setFormattedData(transformed);
    toast({ title: "Formatting Complete", description: `Data converted to ${targetBU} structure.` });
  };

  const getTargetFileName = () => {
    const map: Record<TargetBU, string> = {
      'B2B Standard': 'customer_b2brdex',
      'B2B Priority': 'customer_b2b_priority',
      'B2C': 'customer_b2c',
      'Pallets': 'customer_pe',
      'LCP Standard': 'customer_lcprdex',
      'LCP Priority': 'customer_lcpprio',
      'LCP GO Standard': 'customer_lcpgo',
      'LCP GO Priority': 'customer_lcpgo'
    };
    return map[targetBU] + '.json';
  };

  const handleDownloadJson = (isFormatted: boolean = false) => {
    const dataToSave = isFormatted ? formattedData : result?.extractedData;
    if (!dataToSave) return;
    
    const dataStr = JSON.stringify(dataToSave, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const finalFileName = isFormatted ? getTargetFileName() : `extracted_${fileName?.replace(/\.[^/.]+$/, '') || 'data'}.json`;
    
    link.download = finalFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <FileText className="mr-2 h-7 w-7 text-primary" /> AI Data Extractor
          </CardTitle>
          <CardDescription>
            Upload a PDF, Excel, or CSV Rate Card and have the AI/Logic extract its content into a structured format optimized for "Customer Rates".
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Extraction Type (PDF Only)</Label>
              <Select value={extractionType} onValueChange={setExtractionType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Rate Card">Rate Card (Table)</SelectItem>
                  <SelectItem value="Invoice">Invoice Details</SelectItem>
                  <SelectItem value="Consignment Note">Label/Connote Details</SelectItem>
                  <SelectItem value="General">General Extraction</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Target Business Unit (For Formatting)</Label>
              <Select value={targetBU} onValueChange={(v) => setTargetBU(v as TargetBU)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="B2B Standard">B2B Standard (Road Express)</SelectItem>
                  <SelectItem value="B2B Priority">B2B Priority</SelectItem>
                  <SelectItem value="B2C">B2C</SelectItem>
                  <SelectItem value="Pallets">Pallets</SelectItem>
                  <SelectItem value="LCP Standard">LCP Standard</SelectItem>
                  <SelectItem value="LCP Priority">LCP Priority</SelectItem>
                  <SelectItem value="LCP GO Standard">LCP GO Standard</SelectItem>
                  <SelectItem value="LCP GO Priority">LCP GO Priority</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <ListOrdered className="h-4 w-4 text-muted-foreground" />
                Header Row Starts at (XLS/CSV)
              </Label>
              <Select value={headerRow} onValueChange={headerRow => setHeaderRow(headerRow)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[...Array(50)].map((_, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>Row {i + 1}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground italic">
                Set this to the row where the column titles actually appear.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Custom Instructions (PDF Only)</Label>
              <Textarea 
                placeholder="e.g., Only extract rates for Sydney zones..."
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                rows={4}
              />
            </div>
            <Separator />
            <div className="space-y-4 pt-2">
              <Button 
                onClick={() => fileInputRef.current?.click()} 
                disabled={isProcessing} 
                className="w-full h-24 border-dashed border-2 flex-col gap-2"
                variant="outline"
              >
                {isProcessing ? (
                  <Loader2 className="h-8 w-8 animate-spin" />
                ) : (
                  <UploadCloud className="h-8 w-8 text-primary" />
                )}
                <span>{fileName ? `Change File (${fileName})` : 'Upload PDF, Excel, or CSV'}</span>
              </Button>
              <Input 
                id="file-upload" 
                type="file" 
                accept=".pdf,.csv,.xls,.xlsx" 
                className="hidden" 
                onChange={handleFileUpload} 
                ref={fileInputRef} 
              />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <Sparkles className="mr-2 h-5 w-5 text-accent" />
                Extraction Results
              </div>
              {result && !formattedData && (
                <Button size="sm" variant="secondary" onClick={transformToAppFormat}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Format for Customer Rates
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isProcessing ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse">Processing your document...</p>
              </div>
            ) : result ? (
              <Tabs defaultValue={formattedData ? "formatted" : "json"} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="json">
                    <FileJson className="mr-2 h-4 w-4" /> Raw JSON
                  </TabsTrigger>
                  <TabsTrigger value="formatted" disabled={!formattedData}>
                    <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" /> App Logic JSON
                  </TabsTrigger>
                  <TabsTrigger value="summary">
                    <Info className="mr-2 h-4 w-4" /> Summary
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="json" className="mt-4">
                  <ScrollArea className="h-[500px] w-full rounded-md border bg-muted/30 p-4">
                    <pre className="text-xs whitespace-pre-wrap font-mono">
                      {JSON.stringify(result.extractedData, null, 2)}
                    </pre>
                  </ScrollArea>
                  <div className="mt-4 flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleDownloadJson(false)}>
                      <Download className="mr-2 h-4 w-4" /> Download Raw JSON
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="formatted" className="mt-4">
                  <div className="mb-4">
                    <Badge variant="outline" className="mb-2">Target File: {getTargetFileName()}</Badge>
                    <p className="text-xs text-muted-foreground">
                      This data is formatted with logic keys (e.g. ParcelB2BStandardPERNSW4) and spend band fields (B1, K1, M1). 
                      Download and upload to <strong>Customer Rate Uploader</strong> to enable in the calculator.
                    </p>
                  </div>
                  <ScrollArea className="h-[430px] w-full rounded-md border bg-green-50/10 dark:bg-green-950/10 p-4">
                    <pre className="text-xs whitespace-pre-wrap font-mono">
                      {JSON.stringify(formattedData, null, 2)}
                    </pre>
                  </ScrollArea>
                  <div className="mt-4 flex justify-end gap-2">
                    <Button variant="default" size="sm" onClick={() => handleDownloadJson(true)}>
                      <Download className="mr-2 h-4 w-4" /> Download Logic-Ready JSON
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="summary" className="mt-4">
                  <div className="p-4 bg-muted/30 rounded-md border text-sm leading-relaxed whitespace-pre-wrap">
                    {result.summary}
                  </div>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <FileText className="h-12 w-12 mb-4 opacity-20" />
                <p>No document processed yet. Upload a file to begin.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

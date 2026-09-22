"use client";

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Info, Trash2, CheckCircle, XCircle, FileJson, Layers, Database, Loader2 } from 'lucide-react';
import { useRateOverrides } from '@/context/RateOverrideContext';
import type { RateFileType, RateData } from '@/lib/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

const fileNameToRateTypeMap: Record<string, { type: RateFileType, label: string }> = {
  'b2brdex.json': { type: 'b2brdex', label: 'Core B2B Standard' },
  'b2b_priority.json': { type: 'b2b_priority', label: 'Core B2B Priority' },
  'b2c.json': { type: 'b2c', label: 'Core B2C Rates' },
  'lcprdex.json': { type: 'lcprdex', label: 'Core LCP Standard' },
  'lcpprio.json': { type: 'lcpprio', label: 'Core LCP Priority' },
  'lcpgo.json': { type: 'lcpgo', label: 'Core LCP GO (Tiered)' },
  'pe1.json': { type: 'pe1', label: 'Pallet SB1' },
  'pe2.json': { type: 'pe2', label: 'Pallet SB2' },
  'pe3.json': { type: 'pe3', label: 'Pallet SB3' },
  'pe4.json': { type: 'pe4', label: 'Pallet SB4' },
  'pe5.json': { type: 'pe5', label: 'Pallet SB5' },
  'pallet6.json': { type: 'pallet6', label: 'Pallet SB6' },
  'PEZones.json': { type: 'pezone', label: 'Pallet Zone Lookups' },
  'regionallookup.json': { type: 'regionallookup', label: 'B2C Journey Mapping' },
  'west_east.json': { type: 'west_east', label: 'WA Special Rates' },
  'ras.json': { type: 'ras', label: 'Remote Area Surcharges' },
  'postcodes.json': { type: 'postcodes', label: 'Postcode Database' },
  'locations.json': { type: 'locations', label: 'Lookup Depot Data' },
};

export default function RateUploaderPageContent() {
  const { toast } = useToast();
  const { 
    clearAllOverrides, 
    isLoading, 
    getRateFile,
    overriddenRates,
  } = useRateOverrides();
  
  const [isDataViewerOpen, setIsDataViewerOpen] = useState(false);
  const [dataViewerContent, setDataViewerContent] = useState('');
  const [dataViewerTitle, setDataViewerTitle] = useState('');

  const handleClearLocalStorage = () => {
    clearAllOverrides();
    toast({
        title: 'Overrides Cleared',
        description: 'Temporary session overrides removed. Core server files are active.',
    });
  };

  const showDataInDialog = (title: string, data: RateData | undefined) => {
    setDataViewerContent(data ? JSON.stringify(data, null, 2) : "No data loaded.");
    setDataViewerTitle(title);
    setIsDataViewerOpen(true);
  };

  const fileStatuses = useMemo(() => {
    return Object.keys(fileNameToRateTypeMap).map(name => {
      const config = fileNameToRateTypeMap[name];
      const data = getRateFile(config.type);
      const isOverridden = overriddenRates[config.type] !== undefined;
      return { name, label: config.label, data, isOverridden };
    });
  }, [getRateFile, overriddenRates]);

  return (
    <div className="space-y-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <Database className="mr-2 h-7 w-7 text-primary" /> Core System Rates
          </CardTitle>
          <CardDescription>
            View the status of the central pricing database. Files must be named exactly as shown below when uploading an `all.zip` override in the header.
          </CardDescription>
        </CardHeader>
        <CardContent>
             <Button onClick={handleClearLocalStorage} variant="outline" size="sm" disabled={Object.keys(overriddenRates).length === 0}>
                <Trash2 className="mr-2 h-4 w-4" /> Clear Session Overrides
            </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle>Naming Convention & Status</CardTitle>
            <CardDescription>Click a file name to inspect its current content.</CardDescription>
        </CardHeader>
        <CardContent>
             {isLoading ? (
               <div className="flex justify-center p-10"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>
             ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {fileStatuses.map(file => (
                  <div key={file.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border">
                    <div>
                      <Button variant="link" className="p-0 h-auto font-bold text-sm" onClick={() => showDataInDialog(file.name, file.data)}>
                        {file.label}
                      </Button>
                      <code className="block text-[10px] text-muted-foreground mt-0.5">{file.name}</code>
                    </div>
                    <div className="flex items-center gap-2">
                      {file.isOverridden && <Badge variant="default" className="bg-blue-600 text-[10px]">Overridden</Badge>}
                      {file.data && Array.isArray(file.data) && file.data.length > 0 ? (
                        <Badge variant="outline" className="text-green-600 border-green-600 bg-green-50 text-[10px]">
                          <CheckCircle className="mr-1 h-3 w-3" /> {file.data.length} records
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-destructive border-destructive bg-destructive/5 text-[10px]">
                          <XCircle className="mr-1 h-3 w-3" /> Missing
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
        </CardContent>
      </Card>
      
      <AlertDialog open={isDataViewerOpen} onOpenChange={setIsDataViewerOpen}>
        <AlertDialogContent className="max-w-4xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Data Inspector: {dataViewerTitle}</AlertDialogTitle>
          </AlertDialogHeader>
          <ScrollArea className="h-[60vh] w-full rounded-md border p-4 bg-background font-mono">
            <pre className="text-[10px] whitespace-pre-wrap">{dataViewerContent}</pre>
          </ScrollArea>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setIsDataViewerOpen(false)}>Close Inspector</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

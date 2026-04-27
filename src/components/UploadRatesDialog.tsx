
"use client";

import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, UploadCloud, Loader2 } from 'lucide-react';
import type { RateFileType, RateData } from '@/lib/types';
import JSZip from 'jszip';
import { useRateOverrides } from '@/context/RateOverrideContext';

interface UploadRatesDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const fileNameToRateTypeMap: Record<string, RateFileType> = {
  'b2c.json': 'b2c',
  'regionallookup.json': 'regionallookup',
  'lcprdex.json': 'lcprdex',
  'lcpprio.json': 'lcpprio',
  'lcpgo.json': 'lcpgo',
  'b2b_std.json': 'b2b_std',
  'b2b_priority.json': 'b2b_priority',
  'b2brdex.json': 'b2brdex',
  'PEZones.json': 'pezone',
  'pe1.json': 'pe1',
  'pe2.json': 'pe2',
  'pe3.json': 'pe3',
  'pe4.json': 'pe4',
  'pe5.json': 'pe5',
  'pallet6.json': 'pallet6',
  'west_east.json': 'west_east',
  'ras.json': 'ras',
};

export default function UploadRatesDialog({ isOpen, onOpenChange }: UploadRatesDialogProps) {
  const { toast } = useToast();
  const { setRateOverride } = useRateOverrides();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    const file = event.target.files[0];
    setIsUploading(true);

    if (file.name.endsWith('.zip')) {
      await processZipFile(file);
    } else {
      toast({ title: "Unsupported File", description: "Please upload a .zip file containing your rate files.", variant: "destructive" });
    }

    setIsUploading(false);
    if(event.target) event.target.value = '';
  };
  
  const processZipFile = async (file: File) => {
    toast({ title: 'Processing Zip File...', description: 'Extracting and applying overrides.' });
    try {
      const zip = new JSZip();
      const content = await zip.loadAsync(file);
      let successfulUploads = 0;
      let failedUploads = 0;

      const allFileNamesInZip = Object.keys(content.files);

      for (const fileName of allFileNamesInZip) {
          const rateType = fileNameToRateTypeMap[fileName];
          if (rateType) {
              try {
                  const fileContent = await content.file(fileName)!.async('string');
                  const data = JSON.parse(fileContent) as RateData;
                  setRateOverride(rateType, data);
                  successfulUploads++;
              } catch (error) {
                  console.error(`Failed to process ${fileName} from zip:`, error);
                  failedUploads++;
              }
          }
      }

      if (successfulUploads > 0) {
        let description = `${successfulUploads} core rate file(s) have been loaded for this session.`;
        if (failedUploads > 0) {
          description += ` ${failedUploads} failed to process.`;
        }
        toast({ title: 'Upload Complete', description });
        onOpenChange(false);
      } else {
        toast({ title: 'No Core Files Found', description: 'The zip did not contain any recognized core rate files.', variant: 'default' });
      }
    } catch (error) {
      toast({ title: 'Zip Processing Error', description: 'Could not read or process the zip file.', variant: 'destructive' });
    }
  };
  
  const handleBypass = () => {
    sessionStorage.setItem('rate_upload_popup_bypassed', 'true');
    onOpenChange(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-3">
             <AlertTriangle className="h-8 w-8 text-destructive" />
             <div>
                <DialogTitle>Core Rates Missing</DialogTitle>
                <DialogDescription>
                    Essential pricing files are empty. Please upload a rates `.zip` file to enable calculations.
                </DialogDescription>
             </div>
          </div>
        </DialogHeader>
        <div className="py-4 space-y-4">
            <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="w-full">
                {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <UploadCloud className="mr-2 h-4 w-4"/>}
                Upload Rates (.zip)
            </Button>
            <Input id="rate-upload-input" type="file" accept=".zip" className="hidden" onChange={handleFileUpload} ref={fileInputRef} />
        </div>
        <DialogFooter className="sm:justify-start">
            <Button type="button" variant="ghost" onClick={handleBypass}>
              Continue without Uploading
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

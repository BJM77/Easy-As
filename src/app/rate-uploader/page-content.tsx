"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Info, CheckCircle, XCircle, Loader2, UploadCloud, Trash2, Save } from 'lucide-react';
import { useRateOverrides } from '@/context/RateOverrideContext';
import type { RateFileType, RateData } from '@/lib/types';
import JSZip from 'jszip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

const customerRateFiles: { name: string, rateType: RateFileType, label: string }[] = [
  { name: 'customer_b2brdex.json', rateType: 'customer_b2brdex', label: 'B2B Standard' },
  { name: 'customer_b2b_priority.json', rateType: 'customer_b2b_priority', label: 'B2B Priority' },
  { name: 'customer_pe.json', rateType: 'customer_pe', label: 'Pallet Rates' },
  { name: 'customer_b2c.json', rateType: 'customer_b2c', label: 'B2C' },
  { name: 'customer_lcpgo.json', rateType: 'customer_lcpgo', label: 'LCP GO' },
  { name: 'customer_lcprdex.json', rateType: 'customer_lcprdex', label: 'LCP Standard' },
  { name: 'customer_lcpprio.json', rateType: 'customer_lcpprio', label: 'LCP Priority' },
  { name: 'customer_west_east.json', rateType: 'customer_west_east', label: 'WA PE Special' },
  { name: 'customer_b2bsatchel.json', rateType: 'customer_b2bsatchel', label: 'B2B Satchel' },
];

export default function CustomerRateUploaderPageContent() {
  const { toast } = useToast();
  const { 
    clearAllOverrides, 
    getRateFile,
    setRateOverride,
    overriddenRates,
  } = useRateOverrides();
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingToServer, setIsSavingToServer] = useState(false);
  const [savePassword, setSavePassword] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    const file = event.target.files[0];
    setIsUploading(true);

    if (file.name.endsWith('.zip')) {
        await processZipFile(file);
    } else {
        toast({ title: "Unsupported File", description: "Please upload a .zip file containing recognized customer rate files.", variant: "destructive" });
    }
    
    setIsUploading(false);
    if(event.target) event.target.value = ''; // Reset file input
  };
  
  const processZipFile = async (file: File) => {
    toast({ title: 'Processing Zip File...', description: 'Extracting and applying customer rate overrides.' });
    try {
        const zip = new JSZip();
        const content = await zip.loadAsync(file);
        
        let successfulUploads = 0;
        let failedUploads = 0;

        const allFileNamesInZip = Object.keys(content.files);
        
        for (const fileName of allFileNamesInZip) {
            const customerRateFile = customerRateFiles.find(f => f.name === fileName);
            if (customerRateFile) {
                try {
                    const fileContent = await content.file(fileName)!.async('string');
                    const data = JSON.parse(fileContent) as RateData;
                    setRateOverride(customerRateFile.rateType, data);
                    successfulUploads++;
                } catch (error) {
                    console.error(`Failed to process ${fileName} from zip:`, error);
                    failedUploads++;
                }
            }
        }
        
        if (successfulUploads > 0) {
          let description = `${successfulUploads} customer rate file(s) overridden for this session.`;
          if (failedUploads > 0) description += ` ${failedUploads} failed.`;
          toast({ title: 'Zip Upload Complete', description });
        } else {
          toast({ title: 'No Recognition', description: 'The uploaded zip did not contain any recognized customer_*.json files.', variant: 'default' });
        }

    } catch (error) {
        toast({ title: 'Zip Processing Error', description: 'Could not read or process the zip file.', variant: 'destructive' });
    }
  };
  
  const handleSaveAllToServer = async () => {
    if (!savePassword) {
      toast({ title: "Password Required", description: "Enter server password to save.", variant: "destructive" });
      return;
    }

    setIsSavingToServer(true);
    let successCount = 0;
    let failCount = 0;

    for (const file of customerRateFiles) {
      const data = overriddenRates[file.rateType];
      if (data) {
        try {
          const response = await fetch('/api/update-rate-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: file.name,
              fileContentString: JSON.stringify(data, null, 2),
              password: savePassword
            }),
          });
          if (response.ok) successCount++;
          else failCount++;
        } catch (e) {
          failCount++;
        }
      }
    }

    if (successCount > 0) {
      toast({ title: "Saved to Server", description: `Successfully persisted ${successCount} files to the server.` });
    } else if (failCount > 0) {
      toast({ title: "Save Failed", description: "Could not persist rates to the server. Incorrect password or server error.", variant: "destructive" });
    }
    setIsSavingToServer(false);
  };

  const handleClearCustomerOverrides = () => {
    let clearedCount = 0;
    customerRateFiles.forEach(file => {
      if (overriddenRates[file.rateType]) {
        setRateOverride(file.rateType, null);
        clearedCount++;
      }
    });
    if (clearedCount > 0) {
      toast({ title: "Customer Rates Cleared", description: "All customer-specific rate overrides have been cleared." });
    }
  };


  return (
    <div className="space-y-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <Info className="mr-2 h-7 w-7 text-primary" /> Customer Rate Uploader
          </CardTitle>
          <CardDescription>
            Upload a .zip file containing your `customer_*.json` files. These files populate the "Customer Rates" spend band for your organization.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-2">
                <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                    {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <UploadCloud className="mr-2 h-4 w-4"/>}
                    Upload Customer Rates (.zip)
                </Button>
                <input id="customer-rate-upload" type="file" accept=".zip" className="hidden" onChange={handleFileUpload} ref={fileInputRef} />
                <Button onClick={handleClearCustomerOverrides} variant="destructive" size="sm" disabled={Object.keys(overriddenRates).length === 0}>
                    <Trash2 className="mr-2 h-4 w-4" /> Clear Session Overrides
                </Button>
            </div>

            <Separator />

            <div className="bg-muted/30 p-4 rounded-lg space-y-4 border border-dashed">
                <h3 className="font-bold flex items-center gap-2 text-primary">
                    <Save className="h-5 w-5" />
                    Persist to Server
                </h3>
                <p className="text-sm text-muted-foreground">
                    Saving to server makes these contract rates permanent for your organization across all sessions.
                </p>
                <div className="flex flex-col sm:flex-row items-end gap-2 max-w-md">
                    <div className="space-y-1 flex-grow w-full">
                        <Label htmlFor="save-password">Server Write Password</Label>
                        <Input 
                            id="save-password" 
                            type="password" 
                            value={savePassword} 
                            onChange={e => setSavePassword(e.target.value)} 
                            placeholder="Enter password to save..."
                        />
                    </div>
                    <Button 
                        onClick={handleSaveAllToServer} 
                        disabled={isSavingToServer || !savePassword || Object.keys(overriddenRates).length === 0}
                        className="w-full sm:w-auto"
                    >
                        {isSavingToServer ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <Save className="h-4 w-4 mr-2" />}
                        Save to Server
                    </Button>
                </div>
            </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle>Naming Convention & Status</CardTitle>
            <CardDescription>The zip must contain JSON files named exactly as shown below.</CardDescription>
        </CardHeader>
        <CardContent>
             <div className="space-y-2">
                {customerRateFiles.map(file => {
                  const data = getRateFile(file.rateType);
                  const isOverridden = overriddenRates[file.rateType] !== undefined;

                  return (
                      <div key={file.name} className="flex items-center justify-between p-3 rounded-md bg-muted/50 border">
                        <div>
                            <p className="font-bold text-sm">{file.label}</p>
                            <code className="text-[10px] text-muted-foreground">{file.name}</code>
                        </div>
                        <div className="flex items-center gap-2">
                          {isOverridden && (
                             <Badge variant="default" className="bg-blue-600">
                               <CheckCircle className="mr-1.5 h-3 w-3" /> Session Overridden
                             </Badge>
                          )}
                          {data && Array.isArray(data) && data.length > 0 ? (
                            <Badge variant="outline" className="text-green-600 border-green-600 bg-green-50">
                              <CheckCircle className="mr-1.5 h-3 w-3" /> Persistent Data Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              <XCircle className="mr-1.5 h-3 w-3" /> No Data Found
                            </Badge>
                          )}
                        </div>
                      </div>
                  );
                })}
              </div>
        </CardContent>
      </Card>
    </div>
  );
}


"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Key, Save, Trash2, ExternalLink, CheckCircle, XCircle, Loader2, UploadCloud, Lock, Unlock } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { Separator } from './ui/separator';
import { useRateOverrides } from '@/context/RateOverrideContext';
import JSZip from 'jszip';
import type { RateFileType, RateData } from '@/lib/types';
import { Checkbox } from './ui/checkbox';
import { useSettings } from '@/context/SettingsContext';

interface ApiKeysDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const GEMINI_API_KEY_KEY = 'gemini_api_key_override';
const MAPS_DIRECTIONS_API_KEY_KEY = 'maps_directions_api_key_override';
const LCP_SESSION_KEY = 'lcp_rates_unlocked';
const LCP_PASSWORD = 'TGELCP';


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
  // "Customer Rates" files
  'customer_b2c.json': 'customer_b2c',
  'customer_b2b_priority.json': 'customer_b2b_priority',
  'customer_b2brdex.json': 'customer_b2brdex',
  'customer_pe.json': 'customer_pe',
  'customer_lcpgo.json': 'customer_lcpgo',
  'customer_lcprdex.json': 'customer_lcprdex',
  'customer_lcpprio.json': 'customer_lcpprio',
  'customer_west_east.json': 'customer_west_east',
  'customer_b2bsatchel.json': 'customer_b2bsatchel',
};


export default function ApiKeysDialog({
  isOpen,
  onOpenChange,
}: ApiKeysDialogProps) {
  const { toast } = useToast();
  const { setRateOverride } = useRateOverrides();
  const { showLcpRates, setShowLcpRates } = useSettings();

  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [mapsApiKey, setMapsApiKey] = useState('');
  const [isVerifying, setIsVerifying] = useState<Record<string, boolean>>({});
  const [verificationStatus, setVerificationStatus] = useState<Record<string, 'valid' | 'invalid' | null>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [lcpUnlockChecked, setLcpUnlockChecked] = useState(false);
  const [lcpPassword, setLcpPassword] = useState('');


  useEffect(() => {
    if (isOpen) {
      const storedGemini = localStorage.getItem(GEMINI_API_KEY_KEY) || '';
      const storedMaps = localStorage.getItem(MAPS_DIRECTIONS_API_KEY_KEY) || '';
      setGeminiApiKey(storedGemini);
      setMapsApiKey(storedMaps);
      setVerificationStatus({}); // Reset status on open
      setLcpUnlockChecked(showLcpRates); // Sync with context
      setLcpPassword('');
    }
  }, [isOpen, showLcpRates]);

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      let shouldReload = false;
      
      const currentGemini = localStorage.getItem(GEMINI_API_KEY_KEY) || '';
      if (geminiApiKey && geminiApiKey !== currentGemini) {
        localStorage.setItem(GEMINI_API_KEY_KEY, geminiApiKey);
        shouldReload = true;
      } else if (!geminiApiKey && currentGemini) {
        localStorage.removeItem(GEMINI_API_KEY_KEY);
        shouldReload = true;
      }

      const currentMaps = localStorage.getItem(MAPS_DIRECTIONS_API_KEY_KEY) || '';
      if (mapsApiKey && mapsApiKey !== currentMaps) {
        localStorage.setItem(MAPS_DIRECTIONS_API_KEY_KEY, mapsApiKey);
        shouldReload = true;
      } else if (!mapsApiKey && currentMaps) {
        localStorage.removeItem(MAPS_DIRECTIONS_API_KEY_KEY);
        shouldReload = true;
      }
      
      let lcpStatusChanged = false;
      if (lcpUnlockChecked) {
        if (lcpPassword === LCP_PASSWORD) {
          if (!showLcpRates) {
            setShowLcpRates(true);
            lcpStatusChanged = true;
          }
        } else if (lcpPassword) { // only show error if they typed a password
          toast({ title: 'Incorrect LCP Password', description: 'LCP rates remain locked.', variant: 'destructive'});
        }
      } else {
        if (showLcpRates) {
          setShowLcpRates(false);
          lcpStatusChanged = true;
        }
      }
      
      shouldReload = shouldReload || lcpStatusChanged;

      toast({
        title: 'Settings Updated',
        description:
          'Your local settings have been updated.',
      });

      // Close the dialog
      onOpenChange(false);

      if (shouldReload) {
         setTimeout(() => {
            window.location.reload();
          }, 1500);
      }
    } catch (error) {
      toast({
        title: 'Error Saving Settings',
        description:
          'Could not save settings to local storage.',
        variant: 'destructive',
      });
    }
  };

  const handleClear = () => {
    localStorage.removeItem(GEMINI_API_KEY_KEY);
    localStorage.removeItem(MAPS_DIRECTIONS_API_KEY_KEY);
    sessionStorage.removeItem(LCP_SESSION_KEY);
    setGeminiApiKey('');
    setMapsApiKey('');
    setShowLcpRates(false);
    toast({
      title: 'Local Overrides Cleared',
      description:
        'Your local API keys and LCP access have been removed. The page will reload.',
    });
    onOpenChange(false);
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };
  
  const handleVerifyKey = async (keyType: 'gemini' | 'maps') => {
    setIsVerifying(prev => ({ ...prev, [keyType]: true }));
    setVerificationStatus(prev => ({ ...prev, [keyType]: null }));
    
    let keyToCheck = keyType === 'gemini' ? geminiApiKey : mapsApiKey;
    let isValid = false;

    try {
        if (keyType === 'gemini') {
            isValid = keyToCheck.startsWith('AIzaSy');
            if (!isValid) throw new Error("Invalid format");
        } else if (keyType === 'maps') {
            const response = await fetch(`https://maps.googleapis.com/maps/api/directions/json?origin=Sydney&destination=Melbourne&key=${keyToCheck}`);
            const data = await response.json();
            isValid = data.status === 'OK' || data.status === 'ZERO_RESULTS';
            if(!isValid) {
                 console.error("Maps API Key Verification Error:", data);
            }
        }
        setVerificationStatus(prev => ({ ...prev, [keyType]: 'valid' }));
    } catch (error) {
        setVerificationStatus(prev => ({ ...prev, [keyType]: 'invalid' }));
    } finally {
        setIsVerifying(prev => ({ ...prev, [keyType]: false }));
    }
  };
  
   const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    const file = event.target.files[0];
    setIsUploading(true);

    if (file.name.endsWith('.zip')) {
        await processZipFile(file);
    } else if (file.name.endsWith('.json')) {
        await processJsonFile(file);
    } else {
        toast({ title: "Unsupported File", description: "Please upload a .zip or .json file.", variant: "destructive" });
    }
    
    setIsUploading(false);
    if(event.target) event.target.value = ''; // Reset file input
  };
  
  const processZipFile = async (file: File) => {
    toast({ title: 'Processing Zip File...', description: 'Extracting and applying overrides.' });
    try {
        const zip = new JSZip();
        const content = await zip.loadAsync(file);
        
        let successfulUploads = 0;
        let failedUploads = 0;
        let keysApplied = false;

        const apiKeysFile = content.file('api_keys.json');
        if (apiKeysFile) {
            try {
                const apiKeysContent = await apiKeysFile.async('string');
                const apiKeys = JSON.parse(apiKeysContent);
                if (apiKeys.gemini_api_key_override) localStorage.setItem(GEMINI_API_KEY_KEY, apiKeys.gemini_api_key_override);
                if (apiKeys.maps_directions_api_key_override) localStorage.setItem(MAPS_DIRECTIONS_API_KEY_KEY, apiKeys.maps_directions_api_key_override);
                keysApplied = true;
            } catch (e) {
                console.error("Failed to parse or apply api_keys.json:", e);
                toast({ title: 'API Key Error', description: 'Could not process api_keys.json from the zip.', variant: 'destructive'});
            }
        }

        const allFileNamesInZip = Object.keys(content.files);
        
        for (const fullFileName of allFileNamesInZip) {
            // Support naming convention: "Service Name - Account.json"
            const parts = fullFileName.split(' - ');
            const baseFileName = parts[0] + (parts.length > 1 ? '.json' : '');
            const accountNumber = parts.length > 1 ? parts[1].replace('.json', '') : undefined;

            const rateType = fileNameToRateTypeMap[baseFileName] || fileNameToRateTypeMap[fullFileName];
            if (rateType) {
                try {
                    const fileContent = await content.file(fullFileName)!.async('string');
                    const data = JSON.parse(fileContent) as RateData;
                    setRateOverride(rateType, data, accountNumber);
                    successfulUploads++;
                } catch (error) {
                    console.error(`Failed to process ${fullFileName} from zip:`, error);
                    failedUploads++;
                }
            }
        }


        let description = `${successfulUploads} rate file(s) overridden.`;
        if (failedUploads > 0) description += ` ${failedUploads} failed.`;
        
        toast({ title: 'Zip Upload Complete', description });

        if (keysApplied) {
          toast({ title: 'Reloading...', description: 'Reloading page to apply new API keys.' });
          onOpenChange(false);
          setTimeout(() => window.location.reload(), 1500);
        }

    } catch (error) {
        toast({ title: 'Zip Processing Error', description: 'Could not read or process the zip file.', variant: 'destructive' });
    }
  };

  const processJsonFile = async (file: File) => {
    // Support naming convention: "Service Name - Account.json"
    const parts = file.name.split(' - ');
    const baseFileName = parts[0] + (parts.length > 1 ? '.json' : '');
    const accountNumber = parts.length > 1 ? parts[1].replace('.json', '') : undefined;

    const rateType = fileNameToRateTypeMap[baseFileName] || fileNameToRateTypeMap[file.name];
    if (!rateType) {
        toast({ title: 'Unknown File', description: `The file "${file.name}" is not a recognized rate file.`, variant: 'destructive' });
        return;
    }
    try {
        const content = await file.text();
        const data = JSON.parse(content) as RateData;
        setRateOverride(rateType, data, accountNumber);
        toast({ title: 'Override Applied', description: `Rates for ${file.name} applied.` });
    } catch (error) {
        toast({ title: 'JSON Error', description: `Could not parse the file "${file.name}".`, variant: 'destructive' });
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Key className="mr-2 h-5 w-5 text-primary" />
            Manage Local Overrides
          </DialogTitle>
          <DialogDescription>
            Provide your own API keys or upload rate files. These settings are stored locally in your browser and will override application defaults for your session only.
          </DialogDescription>
        </DialogHeader>
        
        <Separator/>

        <div className="py-2 space-y-4">
            <h3 className="text-md font-semibold flex items-center"><UploadCloud className="mr-2 h-4 w-4"/>Upload Rates</h3>
             <div className="space-y-1">
                <Label htmlFor="rate-file-upload">Upload Zip or Individual JSON Files</Label>
                <p className="text-[10px] text-muted-foreground pb-1 italic">Supports "Service Name - Account.json" format.</p>
                <Input id="rate-file-upload" type="file" accept=".zip,.json" onChange={handleFileUpload} disabled={isUploading} />
                 {isUploading && <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Processing file...</div>}
            </div>
        </div>

        <Separator/>
        
        <form onSubmit={handleSave} className="space-y-4">
          <div className="py-2 space-y-4">
            <h3 className="text-md font-semibold">LCP Rate Access</h3>
             <div className="flex items-center space-x-2">
                <Checkbox
                  id="lcp-unlock-checkbox"
                  checked={lcpUnlockChecked}
                  onCheckedChange={() => setLcpUnlockChecked(!lcpUnlockChecked)}
                />
                <Label htmlFor="lcp-unlock-checkbox">Show LCP Services</Label>
              </div>
              {lcpUnlockChecked && (
                <div className="space-y-1 pl-6">
                  <Label htmlFor="lcp-password">LCP Password</Label>
                  <Input
                    id="lcp-password"
                    type="password"
                    value={lcpPassword}
                    onChange={(e) => setLcpPassword(e.target.value)}
                    placeholder="Enter LCP password..."
                    autoComplete="current-password"
                  />
                </div>
              )}
          </div>


          <Separator/>

          <div className="py-2 space-y-4">
            <h3 className="text-md font-semibold">API Keys</h3>
            <div className="space-y-1">
              <Label htmlFor="gemini-key" className="flex items-center">
                Gemini API Key
                 <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-xs text-primary hover:underline flex items-center"
                >
                  Get from Google AI Studio <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="gemini-key"
                  type="password"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder="Enter your Gemini API key..."
                  autoComplete="current-password"
                />
                 <Button type="button" variant="outline" size="sm" onClick={() => handleVerifyKey('gemini')} disabled={!geminiApiKey || isVerifying['gemini']}>
                    {isVerifying['gemini'] ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : (
                        verificationStatus['gemini'] === 'valid' ? <CheckCircle className="h-4 w-4 text-green-500" /> :
                        verificationStatus['gemini'] === 'invalid' ? <XCircle className="h-4 w-4 text-destructive" /> : 'Verify'
                    )}
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="maps-key" className="flex items-center">
                Google Directions API Key
                <a
                  href="https://console.cloud.google.com/google/maps-apis/credentials"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-xs text-primary hover:underline flex items-center"
                >
                  Get from GCP Console <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </Label>
               <div className="flex items-center gap-2">
                  <Input
                    id="maps-key"
                    type="password"
                    value={mapsApiKey}
                    onChange={(e) => setMapsApiKey(e.target.value)}
                    placeholder="Enter your Google Maps API key..."
                    autoComplete="current-password"
                  />
                   <Button type="button" variant="outline" size="sm" onClick={() => handleVerifyKey('maps')} disabled={!mapsApiKey || isVerifying['maps']}>
                      {isVerifying['maps'] ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : (
                          verificationStatus['maps'] === 'valid' ? <CheckCircle className="h-4 w-4 text-green-500" /> :
                          verificationStatus['maps'] === 'invalid' ? <XCircle className="h-4 w-4 text-destructive" /> : 'Verify'
                      )}
                  </Button>
              </div>
              <Alert variant="destructive" className="mt-2">
                  <AlertDescription>
                      <strong>Important:</strong> For the Route Map to work, you MUST enable a <strong>Billing Account</strong> for your project in the Google Cloud Console. You also need to enable the <strong>"Directions API"</strong> and the <strong>"Maps Embed API"</strong>.
                  </AlertDescription>
              </Alert>
            </div>
          </div>
          <DialogFooter className="pt-4 sm:justify-between">
            <Button type="button" variant="destructive" onClick={handleClear} className="w-full sm:w-auto">
              <Trash2 className="mr-2 h-4 w-4" /> Clear Local Overrides
            </Button>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-2 sm:mt-0">
               <DialogClose asChild>
                  <Button type="button" variant="secondary" className="w-full sm:w-auto">
                    Close
                  </Button>
                </DialogClose>
                <Button type="submit" className="w-full sm:w-auto">
                  <Save className="mr-2 h-4 w-4" /> Save Settings
                </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

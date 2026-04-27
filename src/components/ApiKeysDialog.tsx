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
import { Key, Save, Trash2, ExternalLink, CheckCircle, XCircle, Loader2, UploadCloud, Lock, Sparkles } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { Separator } from './ui/separator';
import { useRateOverrides } from '@/context/RateOverrideContext';
import JSZip from 'jszip';
import type { RateFileType, RateData } from '@/lib/types';
import { Checkbox } from './ui/checkbox';
import { useSettings } from '@/context/SettingsContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface ApiKeysDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const GEMINI_API_KEY_KEY = 'gemini_api_key_override';
const MAPS_DIRECTIONS_API_KEY_KEY = 'maps_directions_api_key_override';
const LCP_PASSWORD = 'TGELCP';

const fuzzyServiceMap: Record<string, RateFileType> = {
  'B2B STANDARD': 'customer_b2brdex',
  'B2B STD': 'customer_b2brdex',
  'IPEC STD': 'customer_b2brdex',
  'IPEC STANDARD': 'customer_b2brdex',
  'ROAD EXPRESS': 'customer_b2brdex',
  'B2B PRIORITY': 'customer_b2b_priority',
  'PRIORITY': 'customer_b2b_priority',
  'B2C': 'customer_b2c',
  'B2C STANDARD': 'customer_b2c',
  'B2C PRIO': 'customer_b2c',
  'PALLETS': 'customer_pe',
  'PALLET': 'customer_pe',
  'PE': 'customer_pe',
  'LCP GO': 'customer_lcpgo',
  'LCP STANDARD': 'customer_lcprdex',
  'LCP STD': 'customer_lcprdex',
  'LCP PRIO': 'customer_lcpprio',
  'LCP PRIORITY': 'customer_lcpprio',
  'WA SPECIAL': 'customer_west_east',
  'WA PE SPECIAL': 'customer_west_east',
};

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

export default function ApiKeysDialog({ isOpen, onOpenChange }: ApiKeysDialogProps) {
  const { toast } = useToast();
  const { setRateOverride } = useRateOverrides();
  const { showLcpRates, setShowLcpRates } = useSettings();

  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [mapsApiKey, setMapsApiKey] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [lcpUnlockChecked, setLcpUnlockChecked] = useState(false);
  const [lcpPassword, setLcpPassword] = useState('');

  useEffect(() => {
    if (isOpen) {
      setGeminiApiKey(localStorage.getItem(GEMINI_API_KEY_KEY) || '');
      setMapsApiKey(localStorage.getItem(MAPS_DIRECTIONS_API_KEY_KEY) || '');
      setLcpUnlockChecked(showLcpRates);
      setLcpPassword('');
    }
  }, [isOpen, showLcpRates]);

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      let shouldReload = false;
      const currentGemini = localStorage.getItem(GEMINI_API_KEY_KEY) || '';
      if (geminiApiKey !== currentGemini) {
        if (geminiApiKey) localStorage.setItem(GEMINI_API_KEY_KEY, geminiApiKey);
        else localStorage.removeItem(GEMINI_API_KEY_KEY);
        shouldReload = true;
      }
      const currentMaps = localStorage.getItem(MAPS_DIRECTIONS_API_KEY_KEY) || '';
      if (mapsApiKey !== currentMaps) {
        if (mapsApiKey) localStorage.setItem(MAPS_DIRECTIONS_API_KEY_KEY, mapsApiKey);
        else localStorage.removeItem(MAPS_DIRECTIONS_API_KEY_KEY);
        shouldReload = true;
      }
      
      if (lcpUnlockChecked && lcpPassword === LCP_PASSWORD) setShowLcpRates(true);
      else if (!lcpUnlockChecked) setShowLcpRates(false);

      toast({ title: 'Settings Updated' });
      onOpenChange(false);
      if (shouldReload) setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      toast({ title: 'Error Saving Settings', variant: 'destructive' });
    }
  };

  const handleClear = () => {
    localStorage.removeItem(GEMINI_API_KEY_KEY);
    localStorage.removeItem(MAPS_DIRECTIONS_API_KEY_KEY);
    setShowLcpRates(false);
    toast({ title: 'Overrides Cleared', description: 'Reloading...' });
    onOpenChange(false);
    setTimeout(() => window.location.reload(), 1000);
  };

  const resolveRateType = (fileName: string): { type: RateFileType | null, accountNumber?: string } => {
    const nameOnly = fileName.replace('.json', '');
    const parts = nameOnly.split(' - ');
    const servicePart = parts[0].toUpperCase().trim();
    const accountNumber = parts.length > 1 ? parts[1].trim() : undefined;

    const exactMatch = fileNameToRateTypeMap[fileName];
    if (exactMatch) return { type: exactMatch, accountNumber };

    const fuzzyMatch = fuzzyServiceMap[servicePart];
    if (fuzzyMatch) return { type: fuzzyMatch, accountNumber };

    return { type: null };
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.length) return;
    setIsUploading(true);
    const file = event.target.files[0];

    try {
      if (file.name.endsWith('.zip')) {
        const zip = await JSZip.loadAsync(file);
        let count = 0;
        for (const name of Object.keys(zip.files)) {
          if (zip.files[name].dir) continue;
          const { type, accountNumber } = resolveRateType(name);
          if (type) {
            const content = await zip.file(name)!.async('string');
            setRateOverride(type, JSON.parse(content), accountNumber);
            count++;
          }
        }
        toast({ title: 'Zip Processed', description: `Linked ${count} rate files.` });
      } else if (file.name.endsWith('.json')) {
        const { type, accountNumber } = resolveRateType(file.name);
        if (type) {
          const content = await file.text();
          setRateOverride(type, JSON.parse(content), accountNumber);
          toast({ title: 'JSON Linked', description: `Rates applied to ${type}.` });
        } else {
          toast({ title: 'Unknown File', description: 'Could not map this file to a service category.', variant: 'destructive' });
        }
      }
    } catch (e) {
      toast({ title: 'Upload Error', description: 'Check that your files are valid JSON.', variant: 'destructive' });
    } finally {
      setIsUploading(false);
      if (event.target) event.target.value = '';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="flex items-center gap-2 font-headline uppercase tracking-tight">
            <Key className="h-5 w-5 text-primary" /> 
            Local Session Overrides
          </DialogTitle>
          <DialogDescription className="font-headline">
            Apply temporary API keys or JSON rate cards to your current session.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-grow px-6 pb-6">
          <div className="space-y-6">
            <div className="space-y-4 pt-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <UploadCloud className="h-4 w-4" /> 
                Pricing Data Injection
              </h3>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Upload Rate Cards (.zip or .json)</Label>
                <Input type="file" accept=".zip,.json" onChange={handleFileUpload} disabled={isUploading} className="h-12 border-dashed border-2 cursor-pointer" />
                <div className="bg-muted/30 p-3 rounded border border-border/50 text-[10px] leading-relaxed text-muted-foreground font-headline">
                    <p className="font-black uppercase text-primary mb-1">PRO TIPS:</p>
                    <p>• Name files naturally: <code className="bg-background px-1 rounded border">B2B Standard.json</code> or <code className="bg-background px-1 rounded border">Priority - 8027.json</code>.</p>
                    <p>• Use Zip to upload multiple categories at once.</p>
                    <p>• Use "Customer Rates" spend band in calculators to activate these files.</p>
                </div>
              </div>
            </div>
            <Separator />
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Lock className="h-4 w-4" /> 
                Feature Unlocks
              </h3>
              <div className="flex items-center space-x-2">
                <Checkbox id="lcp" checked={lcpUnlockChecked} onCheckedChange={(val) => setLcpUnlockChecked(!!val)} />
                <Label htmlFor="lcp" className="font-headline text-sm font-bold">Show LCP Network Services</Label>
              </div>
              {lcpUnlockChecked && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground">Unlock Password</Label>
                    <Input type="password" value={lcpPassword} onChange={e => setLcpPassword(e.target.value)} placeholder="Enter code..." className="h-9" />
                </div>
              )}
            </div>
            <Separator />
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                API Configuration
              </h3>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Gemini API Key</Label>
                <Input type="password" value={geminiApiKey} onChange={e => setGeminiApiKey(e.target.value)} className="h-9 font-mono" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Google Maps Embed Key</Label>
                <Input type="password" value={mapsApiKey} onChange={e => setMapsApiKey(e.target.value)} className="h-9 font-mono" />
              </div>
            </div>
          </div>
        </ScrollArea>
        <DialogFooter className="p-6 bg-muted/30 border-t flex justify-between gap-2">
          <Button variant="destructive" onClick={handleClear} size="sm" className="font-headline font-bold uppercase text-[10px] tracking-widest">
            <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Reset Environment
          </Button>
          <div className="flex gap-2">
            <DialogClose asChild><Button variant="ghost" size="sm" className="font-headline">Cancel</Button></DialogClose>
            <Button onClick={handleSave} size="sm" className="font-headline font-bold uppercase text-[10px] tracking-widest">
                <Save className="mr-1.5 h-3.5 w-3.5" /> Apply Overrides
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
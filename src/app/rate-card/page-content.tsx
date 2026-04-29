"use client";

import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Search, 
  Printer, 
  Download, 
  FileJson, 
  FileSpreadsheet, 
  RefreshCw, 
  Table as TableIcon,
  ShieldCheck,
  Lock,
  Loader2,
  AlertTriangle,
  Info
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRateOverrides } from '@/context/RateOverrideContext';
import { useSettings } from '@/context/SettingsContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type ServiceName, type PostcodeData, ALL_SERVICES } from '@/lib/types';
import { verifyAdminPassword } from '@/ai/flows/admin-auth-flow';

export default function RateCardPageContent() {
  const { toast } = useToast();
  const { getRateFile, isLoading: areRatesLoading } = useRateOverrides();
  const { showLcpRates, setShowLcpRates } = useSettings();

  const [selectedService, setSelectedService] = useState<ServiceName>('B2B Std');
  const [rateData, setRateData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [lcpPassword, setLcpPassword] = useState('');
  const [isPasswordValid, setIsPasswordValid] = useState(false);
  const [allPostcodes, setAllPostcodes] = useState<PostcodeData[]>([]);

  useEffect(() => {
    const validate = async () => {
      if (!lcpPassword) {
        setIsPasswordValid(false);
        return;
      }
      const isValid = await verifyAdminPassword(lcpPassword);
      setIsPasswordValid(isValid);
    };
    const timer = setTimeout(validate, 300);
    return () => clearTimeout(timer);
  }, [lcpPassword]);

  useEffect(() => {
    const fetchRates = async () => {
      setIsLoading(true);
      try {
        const data = await getRateFile(selectedService);
        setRateData(Array.isArray(data) ? data : []);
      } catch (e) {
        toast({ title: "Load Error", description: "Could not fetch rate card.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    fetchRates();
  }, [selectedService, getRateFile, toast]);

  useEffect(() => {
    const fetchPostcodes = async () => {
      try {
        const res = await fetch('/api/postcodes');
        const data = await res.json();
        setAllPostcodes(data);
      } catch (e) {
        console.error("Failed to load postcodes for rate card display.");
      }
    };
    fetchPostcodes();
  }, []);

  const handleLcpUnlock = async () => {
    const isValid = await verifyAdminPassword(lcpPassword);
    if (isValid) {
      setShowLcpRates(true);
      toast({ title: "LCP Rates Unlocked", description: "LCP services are now available." });
      setLcpPassword('');
    } else {
      toast({ title: "Incorrect Password", variant: "destructive" });
    }
  };

  const filteredRates = rateData.filter(row => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      String(row.Origin || '').toLowerCase().includes(s) ||
      String(row.Dest || '').toLowerCase().includes(s) ||
      String(row.Zone || '').toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20">
      <Card className="shadow-xl border-t-4 border-primary">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start gap-4">
            <div>
              <CardTitle className="text-2xl font-headline flex items-center">
                <TableIcon className="mr-2 h-7 w-7 text-primary" /> Global Rate Explorer
              </CardTitle>
              <CardDescription>View production base rates and zone configurations.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
                <Select value={selectedService} onValueChange={(v) => setSelectedService(v as ServiceName)}>
                    <SelectTrigger className="w-64 h-9">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {ALL_SERVICES.map(s => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => window.print()}><Printer className="h-4 w-4"/></Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {!showLcpRates && selectedService.startsWith('LCP') ? (
          <Card className="border-dashed border-2 bg-muted/20">
              <CardContent className="flex flex-col items-center justify-center py-20 space-y-6">
                  <div className="p-4 rounded-full bg-primary/10">
                      <Lock className="h-10 w-10 text-primary" />
                  </div>
                  <div className="text-center space-y-1">
                      <h3 className="text-xl font-bold">LCP Rates Locked</h3>
                      <p className="text-sm text-muted-foreground">Admin authorization required to view internal LCP rate cards.</p>
                  </div>
                  <div className="flex flex-col w-full max-w-xs gap-3">
                      <Input type="password" value={lcpPassword} onChange={e => setLcpPassword(e.target.value)} placeholder="Enter Admin Password..." className="text-center" />
                      <Button onClick={handleLcpUnlock} disabled={!isPasswordValid} className="w-full">
                          <ShieldCheck className="mr-2 h-4 w-4" /> Unlock LCP Service Cards
                      </Button>
                  </div>
              </CardContent>
          </Card>
      ) : (
          <Card className="shadow-md">
            <CardHeader className="bg-muted/30 border-b flex flex-row items-center justify-between py-3">
                <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono text-[10px]">{filteredRates.length} Rows</Badge>
                </div>
                <div className="relative w-64">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input placeholder="Filter by origin, dest, or zone..." className="pl-8 h-8 text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <ScrollArea className="h-[600px]">
                    <Table>
                        <TableHeader className="bg-muted/50 sticky top-0 z-10 shadow-sm">
                            <TableRow>
                                <TableHead className="w-32">Origin</TableHead>
                                <TableHead className="w-32">Destination</TableHead>
                                <TableHead className="text-center">Zone</TableHead>
                                <TableHead className="text-right">Basic ($)</TableHead>
                                <TableHead className="text-right">Kilo ($)</TableHead>
                                <TableHead className="text-right">Min ($)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={6} className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary opacity-20" /></TableCell></TableRow>
                            ) : filteredRates.length > 0 ? (
                                filteredRates.map((row, i) => (
                                    <TableRow key={i}>
                                        <TableCell className="font-bold text-xs uppercase">{row.Origin}</TableCell>
                                        <TableCell className="font-bold text-xs uppercase">{row.Dest}</TableCell>
                                        <TableCell className="text-center font-mono text-[10px] text-muted-foreground">{row.Zone}</TableCell>
                                        <TableCell className="text-right font-mono text-xs">${(row.Basic || row.B1 || 0).toFixed(2)}</TableCell>
                                        <TableCell className="text-right font-mono text-xs">${(row.Kilo || row.K1 || 0).toFixed(2)}</TableCell>
                                        <TableCell className="text-right font-mono text-xs">${(row.Min || row.M1 || 0).toFixed(2)}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={6} className="text-center py-20 text-muted-foreground italic">No matching rates found.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </CardContent>
          </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle className="text-xs font-bold uppercase tracking-widest">Rate Consistency</AlertTitle>
              <AlertDescription className="text-[11px] leading-relaxed">
                  These rates are the base inputs for all calculations. Surcharges (Fuel & Security) are applied on top of these values in the final calculator output.
              </AlertDescription>
          </Alert>
          <div className="flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold uppercase tracking-widest"><Download className="mr-2 h-3.5 w-3.5" /> CSV</Button>
              <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold uppercase tracking-widest"><FileJson className="mr-2 h-3.5 w-3.5" /> JSON</Button>
          </div>
      </div>
    </div>
  );
}

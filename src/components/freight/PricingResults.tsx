"use client";

import type { CalculatedPriceItem, ServiceName, IntelliSendResult, RateFileType } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { PackageCheck, AlertTriangle, Tag, Fuel, PlusCircle, Info, Briefcase, MapPin, Percent, Shield, Mail, Banknote, PercentIcon, Calculator, Weight, RefreshCw, Sparkles, AlertCircle, Computer, HardDrive } from 'lucide-react';
import { Separator } from '../ui/separator';
import { Badge } from '../ui/badge';
import { Button } from '@/components/ui/button';
import { useState, useEffect, useMemo } from 'react';
import CalculationBreakdownDialog from './CalculationBreakdownDialog';
import { cn } from '@/lib/utils';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Phone, User, Clock, Mail as MailIcon, ShieldCheck, MapPin as MapPinIcon } from 'lucide-react';
import OptimizedRateDisplay from './OptimizedRateDisplay';
import { useRateOverrides } from '@/context/RateOverrideContext';
import { useAuth } from '@/firebase';
import { isServiceEnabledForCompany, normalizeServiceName } from '@/lib/utils';

interface PricingResultsProps {
  results: CalculatedPriceItem[];
  optimizedResult: IntelliSendResult | null;
  onOpenEmailQuoteDialog: (serviceResult: CalculatedPriceItem) => void;
  onUpdateWeight: (newWeight: number) => void;
  initialWeight: number;
  showLcpRates: boolean;
  selectedSpendBand: string;
}

const formatCurrency = (amount: number | null) => {
  if (amount === null || isNaN(amount)) return "N/A";
  return amount.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });
};

const getServiceCardClasses = (serviceName: string, isApplicable: boolean): string => {
    if (!isApplicable) {
        return 'bg-muted/30 border-muted opacity-60';
    }
    if (serviceName.includes('Pallet') || serviceName.includes('WA PE Special')) {
        return 'border-blue-200 bg-blue-50/10 dark:bg-blue-900/10';
    }
    if (serviceName.includes('B2B Standard') || serviceName.includes('B2B Std')) {
        return 'border-green-200 bg-green-50/10 dark:bg-green-900/10';
    }
    if (serviceName.includes('B2B Priority')) {
        return 'border-cyan-200 bg-cyan-50/10 dark:bg-cyan-900/10';
    }
    if (serviceName.includes('B2C')) {
        return 'border-amber-200 bg-amber-50/10 dark:bg-amber-900/10';
    }
    if (serviceName.includes('LCP')) {
        return 'border-orange-200 bg-orange-50/10 dark:bg-orange-900/10';
    }
    return 'border-border bg-card';
};

export default function PricingResults({ results, optimizedResult, onOpenEmailQuoteDialog, onUpdateWeight, initialWeight, showLcpRates, selectedSpendBand }: PricingResultsProps) {
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);
  const [selectedResultForBreakdown, setSelectedResultForBreakdown] = useState<CalculatedPriceItem | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [isAgentDialogOpen, setIsAgentDialogOpen] = useState(false);
  const [quickWeight, setQuickWeight] = useState<number | string>(initialWeight);
  const { company, role } = useAuth();

  const isCustomerRates = selectedSpendBand === 'Customer Rates';

  useEffect(() => {
    setQuickWeight(initialWeight);
  }, [initialWeight]);

  const handleOpenBreakdown = (result: CalculatedPriceItem) => {
    setSelectedResultForBreakdown(result);
    setIsBreakdownOpen(true);
  };
  
  const handleQuickWeightInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuickWeight(e.target.value);
  };

  const handleQuickWeightUpdate = () => {
    const numValue = parseFloat(String(quickWeight));
    if (!isNaN(numValue) && numValue > 0) {
      onUpdateWeight(numValue);
    }
  };

  const { locationsData } = useRateOverrides();
  
  const destinationPostcode = useMemo(() => {
    if (!results || results.length === 0) return null;
    return results[0].destinationLocation?.postcode;
  }, [results]);

  const nearbyAgents = useMemo(() => {
    if (!destinationPostcode || !locationsData) return [];
    const targetPC = Number(destinationPostcode);
    if (isNaN(targetPC)) return [];

    return locationsData.filter(loc => {
        const address = loc["BUSINESS ADDRESS"] || "";
        const pcMatch = address.match(/\b\d{4}\b/g);
        if (!pcMatch) return false;
        const locPC = parseInt(pcMatch[pcMatch.length - 1], 10);
        return Math.abs(locPC - targetPC) <= 20;
    });
  }, [destinationPostcode, locationsData]);

  const filteredResults = useMemo(() => {
    return results.filter(res => {
        // Correctly normalize to handle feature flag checks
        const baseServiceName = normalizeServiceName(res.serviceName);
        return isServiceEnabledForCompany(baseServiceName, company, role);
    });
  }, [results, company, role]);
  
  const hasAnyOptimizedResult = optimizedResult && (
    optimizedResult.bestStdResult ||
    optimizedResult.bestPrioResult ||
    optimizedResult.bestPalletResult ||
    (showLcpRates && (optimizedResult.lcpGoStdPrice || optimizedResult.lcpGoPriorityPrice)) ||
    optimizedResult.b2cStdPrice ||
    optimizedResult.b2cPriorityPrice
  );
  
  if (filteredResults.length === 0) {
      return (
      <Card className="mt-4 shadow-lg border-destructive/30 bg-destructive/5">
        <CardHeader>
          <CardTitle className="text-xl font-headline flex items-center text-destructive">
            <AlertCircle className="mr-2 h-6 w-6"/>
            {isCustomerRates ? "No Contract Data Provided" : "No Services Available"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm font-headline">
            {isCustomerRates 
              ? "No contract results to display. Please ensure you have uploaded or extracted JSON logic files for specific business units in the JSON Management section."
              : "No services were available to quote for the entered details."
            }
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="space-y-1">
            <h2 className="text-xl font-bold font-headline flex items-center gap-2">
                <Calculator className="h-6 w-6 text-primary" /> 
                {isCustomerRates ? "Contract Quotes" : "Pricing Schedule"}
            </h2>
            <p className="text-xs text-muted-foreground font-headline">Prices below reflect current surcharges and regional zones.</p>
        </div>
        <div className="flex items-center gap-2 bg-muted/30 p-2 rounded-lg border">
            <Label htmlFor="quick-weight-update" className="text-[10px] font-black font-headline uppercase tracking-widest text-muted-foreground">Update Wt (kg):</Label>
            <Input 
                id="quick-weight-update"
                type="number"
                value={quickWeight}
                onChange={handleQuickWeightInputChange}
                className="w-20 h-8 font-headline text-center"
            />
            <Button onClick={handleQuickWeightUpdate} size="icon" className="h-8 w-8" variant="ghost">
                <RefreshCw className="h-4 w-4" />
            </Button>
        </div>
    </div>

    {hasAnyOptimizedResult && !isCustomerRates && (
       <OptimizedRateDisplay
            optimizedResult={optimizedResult}
            onOpenBreakdown={handleOpenBreakdown}
            showLcpRates={true}
       />
    )}

    <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {filteredResults.map((result, idx) => {
        const securitySurchargeDetails = result.otherSurcharges.find(s => s.id === 'security' || s.id === 'manual_security');
        const rasSurchargeDetails = result.otherSurcharges.find(s => s.id === 'remote_area_surcharge');
        const otherFilteredSurcharges = result.otherSurcharges.filter(s => 
          s.id !== 'security' && 
          s.id !== 'manual_security' &&
          s.id !== 'remote_area_surcharge'
        );

        return (
          <Card key={`${result.serviceName}-${idx}`} className={cn('shadow-md flex flex-col transition-all hover:shadow-lg', getServiceCardClasses(result.serviceName, result.isApplicable))}>
            <CardHeader className="pb-4 p-5">
              <div className="flex justify-between items-start mb-2">
                <button 
                  onClick={() => handleOpenBreakdown(result)} 
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity disabled:no-underline disabled:cursor-not-allowed group" 
                  disabled={!result.isApplicable}
                >
                  <CardTitle className="text-base font-bold font-headline tracking-tight group-hover:text-primary transition-colors">
                    {result.serviceName}
                  </CardTitle>
                </button>
                {result.isApplicable ? (
                    <Badge className="font-headline text-base bg-primary text-primary-foreground">{formatCurrency(result.finalPrice)}</Badge>
                ) : (
                     <Badge variant="outline" className="text-[10px] font-headline uppercase font-black text-destructive border-destructive">N/A</Badge>
                )}
              </div>
              
              <div className="flex flex-wrap gap-1.5">
                {result.accountNumber && (
                    <Badge variant="secondary" className="text-[9px] font-headline h-4 uppercase tracking-tighter bg-primary/10 text-primary">
                        ACC: {result.accountNumber}
                    </Badge>
                )}
                {result.chargeableWeight > 0 && (
                    <Badge variant="outline" className="text-[9px] h-4 font-headline font-normal">CW: {result.chargeableWeight.toFixed(2)}kg</Badge>
                )}
                {result.chargeZoneUsed && result.chargeZoneUsed !== "N/A" && (
                    <Badge variant="outline" className="text-[9px] h-4 font-headline font-normal">Zone: {result.chargeZoneUsed}</Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-3 px-5 pb-5 flex-grow text-sm">
              {result.remarks.length > 0 && (
                <div className="text-xs text-muted-foreground font-headline italic mb-2 p-2 bg-muted/20 rounded border-l-2 border-primary/20">
                  {result.remarks.join('. ')}
                </div>
              )}
              
              {result.isApplicable && (
                <>
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-muted-foreground flex items-center gap-1.5 font-headline text-xs"><Tag className="h-3.5 w-3.5" /> Base Freight</span>
                    <span className="font-bold font-headline">{formatCurrency(result.baseRate)}</span>
                  </div>
                  
                  <div className="space-y-1 pt-1">
                    <p className="text-[10px] font-black font-headline uppercase tracking-widest text-muted-foreground mb-1">Surcharges & Extras</p>
                    <div className="space-y-1.5 pl-1 border-l">
                      <div className="flex justify-between items-center">
                        <span className="flex items-center gap-1.5 text-muted-foreground text-xs font-headline">
                          <Fuel className="h-3 w-3" /> Fuel ({result.fuelSurchargePercentApplied?.toFixed(1)}%)
                        </span>
                        <span className="font-headline">{formatCurrency(result.fuelSurchargeAmount)}</span>
                      </div>
                      
                      {securitySurchargeDetails && (
                        <div className="flex justify-between items-center">
                          <span className="flex items-center gap-1.5 text-muted-foreground text-xs font-headline">
                            <Shield className="h-3 w-3" /> Security ({result.securitySurchargePercentApplied?.toFixed(1)}%)
                          </span>
                          <span className="font-headline">{formatCurrency(securitySurchargeDetails.amount)}</span>
                        </div>
                      )}
                      
                      {rasSurchargeDetails && (
                        <div className="flex justify-between items-center">
                          <span className="flex items-center gap-1.5 text-muted-foreground text-xs font-headline">
                            <MapPin className="h-3 w-3" /> Remote Area
                          </span>
                          <span className="font-headline">{formatCurrency(rasSurchargeDetails.amount)}</span>
                        </div>
                      )}

                      {otherFilteredSurcharges.map(s => (
                        <div key={s.id} className="flex justify-between items-center">
                          <span className="text-muted-foreground text-xs font-headline">{s.name}</span>
                          <span className="font-headline">{formatCurrency(s.amount)}</span>
                        </div>
                      ))}

                      {result.totalExtrasAmount > 0 && (
                        <div className="flex justify-between items-center text-primary font-medium">
                          <span className="flex items-center gap-1.5 text-xs font-headline"><Briefcase className="h-3 w-3" /> Manual Extras</span>
                          <span className="font-headline">{formatCurrency(result.totalExtrasAmount)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator className="my-2" />

                  <div className="space-y-1">
                    {result.additionalMarkupAmount !== null && result.additionalMarkupAmount !== 0 && (
                      <div className="flex justify-between items-center text-muted-foreground">
                        <span className="flex items-center gap-1.5 text-xs font-headline"><PercentIcon className="h-3 w-3" /> Additional Markup ({result.additionalMarkupPercentApplied}%)</span>
                        <span className="font-bold font-headline">{formatCurrency(result.additionalMarkupAmount)}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between items-center font-bold text-foreground">
                      <span className="text-xs font-headline">Subtotal (ex GST)</span>
                      <span className="font-headline">{formatCurrency(result.subTotalBeforeGST)}</span>
                    </div>

                    {result.gstAmount !== null && result.gstAmount !== 0 && (
                      <div className="flex justify-between items-center text-muted-foreground">
                        <span className="flex items-center gap-1.5 text-xs font-headline"><Banknote className="h-3 w-3" /> GST (10%)</span>
                        <span className="font-bold font-headline">{formatCurrency(result.gstAmount)}</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>

            {result.isApplicable && (
              <CardFooter 
                className="p-0 border-t cursor-pointer hover:bg-primary transition-colors group/footer overflow-hidden rounded-b-md"
                onClick={() => onOpenEmailQuoteDialog(result)}
                role="button"
                tabIndex={0}
              >
                <div className="flex justify-between items-center w-full px-5 py-3">
                  <span className="text-sm font-black font-headline uppercase tracking-widest text-primary group-hover/footer:text-white transition-colors flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email Quote
                  </span>
                  <span className="text-base font-bold font-headline text-primary group-hover/footer:text-white transition-colors tabular-nums">{formatCurrency(result.finalPrice)}</span>
                </div>
              </CardFooter>
            )}
          </Card>
        );
      })}
    </div>

    {nearbyAgents.length > 0 && (
        <div className="mt-10 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-sm font-black font-headline flex items-center gap-2 text-primary uppercase tracking-[0.2em]">
                    <MapPin className="h-5 w-5 text-accent" />
                    Destination Agents & Branches
                </h3>
                <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-tighter bg-accent/5 text-accent border-accent/20">
                    Proximity: +/- 20 Postcodes
                </Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {nearbyAgents.map((agent, i) => (
                    <Card 
                        key={i} 
                        className="bg-muted/10 border-dashed border-muted-foreground/20 hover:border-accent/50 transition-all shadow-sm cursor-pointer hover:bg-accent/5 group/agent"
                        onClick={() => {
                            setSelectedAgent(agent);
                            setIsAgentDialogOpen(true);
                        }}
                    >
                        <CardHeader className="p-4 pb-2">
                            <CardTitle className="text-[11px] font-black uppercase tracking-tight leading-tight text-foreground group-hover/agent:text-accent transition-colors">
                                {agent["BUSINESS NAME"]}
                            </CardTitle>
                            <CardDescription className="text-[9px] font-headline uppercase font-bold text-accent/70">
                                Unit: {agent["BUSINESS UNIT"]} • Area: {agent["AREA SERVICED"]}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <div className="flex items-start gap-2 text-muted-foreground">
                                <p className="text-[10px] font-headline leading-relaxed italic">
                                    {agent["BUSINESS ADDRESS"]}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )}

    <CalculationBreakdownDialog 
      isOpen={isBreakdownOpen}
      onOpenChange={setIsBreakdownOpen}
      result={selectedResultForBreakdown}
    />

    <Dialog open={isAgentDialogOpen} onOpenChange={setIsAgentDialogOpen}>
        <DialogContent className="max-w-md bg-card border-2 border-accent/20">
            <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                    <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center border border-accent/20">
                        <MapPinIcon className="h-5 w-5 text-accent" />
                    </div>
                    <div className="text-left">
                        <DialogTitle className="text-lg font-black uppercase tracking-tight font-headline">{selectedAgent?.["BUSINESS NAME"]}</DialogTitle>
                        <DialogDescription className="text-xs font-bold font-headline text-accent/70 uppercase tracking-widest">{selectedAgent?.["BUSINESS UNIT"]} • {selectedAgent?.["AREA SERVICED"]}</DialogDescription>
                    </div>
                </div>
            </DialogHeader>

            <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <Label className="text-[9px] uppercase font-black text-muted-foreground tracking-widest">Site Manager</Label>
                        <p className="text-sm font-bold flex items-center gap-2"><User className="h-3.5 w-3.5 text-primary" /> {selectedAgent?.["SITE MANAGER"] || "N/A"}</p>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[9px] uppercase font-black text-muted-foreground tracking-widest">Escalation Point</Label>
                        <p className="text-sm font-bold flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> {selectedAgent?.["ESCALATION POINT"] || "N/A"}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 bg-muted/30 p-3 rounded-lg border">
                    <div className="space-y-1">
                        <Label className="text-[9px] uppercase font-black text-muted-foreground tracking-widest">Address</Label>
                        <p className="text-xs italic leading-relaxed">{selectedAgent?.["BUSINESS ADDRESS"]}</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <Label className="text-[9px] uppercase font-black text-muted-foreground tracking-widest">Office Number</Label>
                        <p className="text-sm font-bold flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-accent" /> {selectedAgent?.["OFFICE NUMBER"] || "N/A"}</p>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[9px] uppercase font-black text-muted-foreground tracking-widest">Manager Mobile</Label>
                        <p className="text-sm font-bold flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-accent" /> {selectedAgent?.["MANAGER MOBILE NUMBER"] || "N/A"}</p>
                    </div>
                </div>

                <div className="space-y-1">
                    <Label className="text-[9px] uppercase font-black text-muted-foreground tracking-widest">Email Address</Label>
                    <p className="text-sm font-bold flex items-center gap-2 text-primary underline"><MailIcon className="h-3.5 w-3.5" /> {selectedAgent?.["EMAIL ADDRESS"] || "N/A"}</p>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <Label className="text-[9px] uppercase font-black text-muted-foreground tracking-widest">Hours of Operation</Label>
                        <p className="text-[10px] font-bold flex items-center gap-2"><Clock className="h-3 w-3 text-muted-foreground" /> {selectedAgent?.["HOURS OF OPERATIONS"] || "N/A"}</p>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[9px] uppercase font-black text-muted-foreground tracking-widest">Collections / Drop-off</Label>
                        <p className="text-[10px] font-bold flex items-center gap-2"><Clock className="h-3 w-3 text-muted-foreground" /> {selectedAgent?.["COLLECTION / DROP OFF TIMES"] || "N/A"}</p>
                    </div>
                </div>
            </div>

            <DialogFooter>
                <DialogClose asChild>
                    <Button className="w-full font-black uppercase tracking-widest text-[10px] h-9">Close Contact Info</Button>
                </DialogClose>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}

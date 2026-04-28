"use client";

import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Sparkles, Clock, ChevronDown, ChevronUp, Calculator, Percent, ExternalLink, AlertTriangle } from 'lucide-react';
import type { CalculatedPriceItem, UserRole } from '@/lib/types';
import { isServiceEnabledForCompany, normalizeServiceName } from '@/lib/utils';
import { useAuth } from '@/firebase';
import { useRateOverrides } from '@/context/RateOverrideContext';
import { cn, formatCurrency } from '@/lib/utils';

const ResultRow = ({ result, isLowest }: { result: CalculatedPriceItem, isLowest: boolean }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <>
            <TableRow 
                className={cn("cursor-pointer transition-colors", isLowest ? "bg-green-50/30" : "hover:bg-muted/50")}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <TableCell className="font-medium font-headline">
                    <div className="flex items-center gap-2">
                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        {result.serviceName}
                        {isLowest && <Badge variant="outline" className="text-green-600 border-green-600 h-4 uppercase tracking-tighter text-[8px] font-headline">Lowest</Badge>}
                    </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground font-headline">
                    {result.chargeZoneUsed && result.chargeZoneUsed !== 'N/A' ? result.chargeZoneUsed : ''}
                </TableCell>
                <TableCell className="text-right font-bold text-primary font-headline">{formatCurrency(result.finalPrice)}</TableCell>
            </TableRow>
            {isExpanded && (
                <TableRow className="bg-muted/20 animate-in fade-in slide-in-from-top-1">
                    <TableCell colSpan={3} className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            <div className="space-y-2 border-r pr-4">
                                <h4 className="font-bold font-headline flex items-center gap-1.5 uppercase text-muted-foreground tracking-widest text-[9px]"><Calculator className="h-3 w-3" /> Base Calculation</h4>
                                <p className="font-mono bg-background p-2 rounded border border-dashed leading-relaxed text-[10px]">{result.calculationFormula || 'Standard Rate Lookup'}</p>
                                <div className="flex justify-between font-bold font-headline pt-1"><span>Base Rate:</span><span>{formatCurrency(result.baseRate)}</span></div>
                            </div>
                            <div className="space-y-2">
                                <h4 className="font-bold font-headline flex items-center gap-1.5 uppercase text-muted-foreground tracking-widest text-[9px]"><Percent className="h-3 w-3" /> Surcharges & Markup</h4>
                                <div className="space-y-1.5 font-headline">
                                    <div className="flex justify-between"><span>Fuel ({result.fuelSurchargePercentApplied}%):</span><span>{formatCurrency(result.fuelSurchargeAmount)}</span></div>
                                    
                                    {/* Map through all other surcharges (Security, Remote Area, etc) */}
                                    {result.otherSurcharges && result.otherSurcharges.map((s, i) => {
                                        const isSecurity = s.id === 'security';
                                        return (
                                            <div key={i} className="flex justify-between text-muted-foreground">
                                                <span>{s.name}{isSecurity && result.securitySurchargePercentApplied ? ` (${result.securitySurchargePercentApplied}%)` : ''}:</span>
                                                <span>{formatCurrency(s.amount)}</span>
                                            </div>
                                        );
                                    })}

                                    {result.additionalMarkupAmount !== null && result.additionalMarkupAmount > 0 && (
                                        <div className="flex justify-between"><span>Markup ({result.additionalMarkupPercentApplied}%):</span><span>{formatCurrency(result.additionalMarkupAmount)}</span></div>
                                    )}
                                    <div className="flex justify-between border-t pt-1 font-bold"><span>Total (inc. GST):</span><span>{formatCurrency(result.finalPrice)}</span></div>
                                </div>
                            </div>
                        </div>
                    </TableCell>
                </TableRow>
            )}
        </>
    );
};

export default function QuickQuoteResultsDialog({ 
  isOpen, 
  onOpenChange, 
  results, 
  onGoToFullCalculator, 
  role 
}: { 
  isOpen: boolean, 
  onOpenChange: (open: boolean) => void, 
  results: CalculatedPriceItem[], 
  onGoToFullCalculator: () => void, 
  role: UserRole 
}) {
  const { company } = useAuth();
  const { isAnyFileLoaded } = useRateOverrides();

  // Normalize and filter based on organizational features
  const filteredResults = useMemo(() => {
    if (!results) return [];
    return results.filter(res => {
        const canonicalName = normalizeServiceName(res.serviceName);
        return isServiceEnabledForCompany(canonicalName, company, role);
    });
  }, [results, company, role]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 text-xl font-headline">
            <Sparkles className="h-5 w-5 text-accent" /> 
            Quick Quote Results
            <div className={cn(
              "h-2.5 w-2.5 rounded-full ml-1",
              isAnyFileLoaded ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"
            )} title={isAnyFileLoaded ? "Pricing Data Loaded" : "No Pricing Data Loaded"} />
          </DialogTitle>
          <DialogDescription className="font-headline">Instant pricing insights. Expand rows for mathematical breakdowns.</DialogDescription>
        </DialogHeader>
        
        <div className="flex-grow overflow-y-auto py-4 space-y-6">
          <div className="border rounded-md overflow-hidden bg-card">
            {filteredResults.length > 0 ? (
                <Table>
                    <TableBody>
                        {filteredResults.map((res, idx) => (
                            <ResultRow key={idx} result={res} isLowest={idx === 0} />
                        ))}
                    </TableBody>
                </Table>
            ) : (
                <div className="p-8 text-center text-muted-foreground italic flex flex-col items-center gap-3 font-headline">
                    <AlertTriangle className="h-10 w-10 opacity-20" />
                    <p>No applicable services found for this weight/lane.</p>
                    <p className="text-[10px] uppercase font-black text-muted-foreground not-italic">Check your organizational service permissions or data files.</p>
                </div>
            )}
          </div>
        </div>

        <DialogFooter className="sm:justify-between flex-row gap-3 pt-4 border-t shrink-0">
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onGoToFullCalculator} className="font-headline">
                <ExternalLink className="mr-2 h-4 w-4" /> Full Calculator
            </Button>
          </div>
          <DialogClose asChild><Button size="sm" className="font-headline">Close</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

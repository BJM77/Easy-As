
"use client";

import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Sparkles, Clock, ChevronDown, ChevronUp, Save, Calculator, Percent, Loader2, ArrowRightLeft, AlertTriangle } from 'lucide-react';
import type { QuoteAgentOutput, ServiceName } from '@/lib/types';
import { isServiceEnabledForCompany } from '@/lib/utils';
import { useAuth, useFirestore, setDocumentNonBlocking } from '@/firebase';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { cn, formatCurrency } from '@/lib/utils';
import { useRouter } from 'next/navigation';

const ResultRow = ({ result, isLowest }: { result: any, isLowest: boolean }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const breakdown = result.breakdown;

    return (
        <>
            <TableRow 
                className={cn("cursor-pointer transition-colors", isLowest ? "bg-green-50/30" : "hover:bg-muted/50")}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        {result.serviceName}
                        {isLowest && <Badge variant="outline" className="text-green-600 border-green-600 h-4 uppercase tracking-tighter text-[8px]">Lowest</Badge>}
                    </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground"><Clock className="inline mr-1 h-3 w-3" />{result.transitTime || 'N/A'}</TableCell>
                <TableCell className="text-right font-bold text-primary">{formatCurrency(result.price)}</TableCell>
            </TableRow>
            {isExpanded && breakdown && (
                <TableRow className="bg-muted/20 animate-in fade-in slide-in-from-top-1">
                    <TableCell colSpan={3} className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            <div className="space-y-2 border-r pr-4">
                                <h4 className="font-bold flex items-center gap-1.5 uppercase text-muted-foreground tracking-widest text-[9px]"><Calculator className="h-3 w-3" /> Base Calculation</h4>
                                <p className="font-mono bg-background p-2 rounded border border-dashed leading-relaxed text-[10px]">{breakdown.formula}</p>
                                <div className="flex justify-between font-bold pt-1"><span>Calculated Base:</span><span>{formatCurrency(breakdown.baseRate)}</span></div>
                            </div>
                            <div className="space-y-2">
                                <h4 className="font-bold flex items-center gap-1.5 uppercase text-muted-foreground tracking-widest text-[9px]"><Percent className="h-3 w-3" /> Surcharges</h4>
                                <div className="space-y-1.5">
                                    <div className="flex justify-between"><span>Fuel:</span><span>{formatCurrency(breakdown.fuelSurcharge)}</span></div>
                                    <div className="flex justify-between border-t pt-1 font-bold"><span>GST (10%):</span><span>{formatCurrency(breakdown.gst)}</span></div>
                                </div>
                            </div>
                        </div>
                    </TableCell>
                </TableRow>
            )}
        </>
    );
};

export default function AiQuoteResultsDialog({ isOpen, onOpenChange, data }: { isOpen: boolean, onOpenChange: (open: boolean) => void, data: QuoteAgentOutput | null }) {
  const router = useRouter();
  const { user, profile, company } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [quoteId, setQuoteId] = useState<string | null>(null);

  const sortedResults = useMemo(() => {
    if (!data?.results) return [];
    
    // FILTER: Ensure AI results only show services enabled for this company
    const filtered = data.results.filter(res => {
        // Need to strip "Customer " prefix if present for feature check
        const baseServiceName = res.serviceName.replace(/^Customer\s+/, '') as ServiceName;
        return isServiceEnabledForCompany(baseServiceName, company);
    });

    return [...filtered].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
  }, [data?.results, company]);

  const handleSaveQuote = async () => {
    if (!user || !profile || !firestore || !data) return;
    setIsSaving(true);
    try {
        const quoteRef = doc(collection(firestore, 'ai_quotes'));
        const payload = { 
            id: quoteRef.id, 
            userId: user.uid, 
            companyId: profile.companyId, 
            query: data.summary.split('\n')[0], 
            results: data.results, 
            structuredInput: data.resolvedInput,
            status: 'draft',
            version: 'v2.5',
            warnings: data.warnings || [],
            createdAt: serverTimestamp() 
        };
        
        setDocumentNonBlocking(quoteRef, payload, { merge: false });
        setQuoteId(quoteRef.id);
        toast({ title: "Quote Saved", description: "This insight is now persistent in your workspace." });
    } finally { setIsSaving(false); }
  };

  const handleRehydrate = () => {
    if (!data?.resolvedInput) {
        toast({ title: "Cannot Rehydrate", description: "This quote does not contain structured form data.", variant: "destructive" });
        return;
    }
    // Set sessionStorage for the calculator to pick up
    const rehydrateData = {
        ...data.resolvedInput,
        aiQuoteId: quoteId || undefined, // Link if saved
    };
    sessionStorage.setItem('rehydration_state', JSON.stringify(rehydrateData));
    router.push('/calculator');
    onOpenChange(false);
    toast({ title: "Rehydrating Form", description: "Loading quote data into the calculator..." });
  };

  if (!data) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 text-xl"><Sparkles className="h-5 w-5 text-accent" /> AI Quote Insight</DialogTitle>
          <DialogDescription>Natural language intelligence. Expand rows for mathematical breakdowns.</DialogDescription>
        </DialogHeader>
        
        <div className="flex-grow overflow-y-auto py-4 space-y-6">
          {data.warnings && data.warnings.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3 flex gap-2 text-xs text-amber-800">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <div className="space-y-1">
                      <p className="font-bold">Accuracy Notice:</p>
                      <ul className="list-disc list-inside">
                          {data.warnings.map((w, i) => <li key={i}>{w}</li>)}
                      </ul>
                  </div>
              </div>
          )}

          <div className="bg-primary/5 p-4 rounded-lg border border-primary/10 leading-relaxed text-sm whitespace-pre-wrap italic">
            "{data.summary}"
          </div>
          
          <div className="border rounded-md overflow-hidden bg-card">
            {sortedResults.length > 0 ? (
                <Table>
                    <TableBody>
                        {sortedResults.map((res, idx) => (
                            <ResultRow key={idx} result={res} isLowest={idx === 0} />
                        ))}
                    </TableBody>
                </Table>
            ) : (
                <div className="p-8 text-center text-muted-foreground italic flex flex-col items-center gap-2">
                    <AlertTriangle className="h-8 w-8 opacity-20" />
                    <p>No results available. Certain pricing categories may be restricted for your organization.</p>
                </div>
            )}
          </div>
        </div>

        <DialogFooter className="sm:justify-between flex-row gap-3 pt-4 border-t shrink-0">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleSaveQuote} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <Save className="mr-2 h-4 w-4" />} Save
            </Button>
            <Button variant="secondary" size="sm" onClick={handleRehydrate} disabled={!data.resolvedInput}>
                <ArrowRightLeft className="mr-2 h-4 w-4" /> Edit in Calculator
            </Button>
          </div>
          <DialogClose asChild><Button size="sm">Dismiss</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


"use client";

import React from 'react';
import type { CalculatedPriceItem } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calculator, FileJson, Info } from 'lucide-react';
import { Separator } from '../ui/separator';

interface CalculationBreakdownDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  result: CalculatedPriceItem | null;
}

const formatCurrency = (amount: number | null) => {
  if (amount === null || isNaN(amount)) return "N/A";
  return amount.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });
};

export default function CalculationBreakdownDialog({ isOpen, onOpenChange, result }: CalculationBreakdownDialogProps) {
  if (!result) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Calculator className="mr-2 h-5 w-5 text-primary" />
            Calculation Breakdown
          </DialogTitle>
          <DialogDescription>
            For service: <strong>{result.serviceName}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-2">
          
          <div className="space-y-1">
            <h4 className="text-sm font-semibold">Base Freight Calculation</h4>
            <div className="p-3 bg-muted rounded-md text-sm">
                <p><strong>Chargeable Weight:</strong> {result.chargeableWeight.toFixed(2)} kg</p>
                <p><strong>Lookup Key Used:</strong> {result.chargeZoneUsed || 'N/A'}</p>
                <p><strong>Formula:</strong></p>
                <pre className="mt-1 p-2 text-xs bg-background rounded whitespace-pre-wrap"><code>{result.calculationFormula || "No formula available. Might be a tiered rate or manual entry."}</code></pre>
                <p className="mt-2"><strong>Resulting Base Rate:</strong> <span className="font-semibold">{formatCurrency(result.baseRate)}</span></p>
            </div>
          </div>

          {result.otherSurcharges.length > 0 && (
             <div className="space-y-1">
                <h4 className="text-sm font-semibold">Applied Surcharges</h4>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Surcharge</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow>
                            <TableCell>Fuel Surcharge ({result.fuelSurchargePercentApplied?.toFixed(2) || '0.00'}%)</TableCell>
                            <TableCell className="text-right">{formatCurrency(result.fuelSurchargeAmount)}</TableCell>
                        </TableRow>
                        {result.otherSurcharges.map(surcharge => (
                           <TableRow key={surcharge.id}>
                               <TableCell>{surcharge.name}</TableCell>
                               <TableCell className="text-right">{formatCurrency(surcharge.amount)}</TableCell>
                           </TableRow>
                        ))}
                    </TableBody>
                </Table>
             </div>
          )}

          <div className="space-y-1">
            <h4 className="text-sm font-semibold">Final Price Calculation</h4>
            <div className="p-3 bg-muted rounded-md text-sm space-y-1">
                <div className="flex justify-between"><span>Base Rate:</span> <span>{formatCurrency(result.baseRate)}</span></div>
                <div className="flex justify-between"><span>+ Total Surcharges:</span> <span>{formatCurrency(result.totalSurcharges)}</span></div>
                <div className="flex justify-between"><span>+ Item Extras:</span> <span>{formatCurrency(result.totalExtrasAmount)}</span></div>
                <Separator />
                <div className="flex justify-between font-medium"><span>Subtotal (Pre-Markup):</span> <span>{formatCurrency(result.subTotalBeforeMarkupAndGST)}</span></div>
                {result.additionalMarkupAmount !== null && result.additionalMarkupAmount > 0 && (
                     <div className="flex justify-between"><span>+ Markup ({result.additionalMarkupPercentApplied?.toFixed(2) || '0.00'}%):</span> <span>{formatCurrency(result.additionalMarkupAmount)}</span></div>
                )}
                 <div className="flex justify-between font-medium"><span>Subtotal (Pre-GST):</span> <span>{formatCurrency(result.subTotalBeforeGST)}</span></div>
                 {result.gstAmount !== null && result.gstAmount > 0 && (
                     <div className="flex justify-between"><span>+ GST (10%):</span> <span>{formatCurrency(result.gstAmount)}</span></div>
                 )}
                 <Separator />
                 <div className="flex justify-between text-lg font-bold text-primary"><span>Final Total:</span> <span>{formatCurrency(result.finalPrice)}</span></div>
            </div>
          </div>
          
          {result.rateEntryUsed && (
            <div className="space-y-1">
                <h4 className="text-sm font-semibold flex items-center"><FileJson className="mr-2 h-4 w-4" />Raw Rate Entry Used</h4>
                <ScrollArea className="max-h-40 w-full rounded-md border bg-background">
                    <pre className="p-2 text-xs whitespace-pre-wrap">{JSON.stringify(result.rateEntryUsed, null, 2)}</pre>
                </ScrollArea>
            </div>
          )}
          
          {result.remarks.length > 0 && (
             <div className="space-y-1">
                <h4 className="text-sm font-semibold flex items-center"><Info className="mr-2 h-4 w-4"/>Remarks</h4>
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/50 rounded-md text-xs text-amber-800 dark:text-amber-200">
                    <ul className="list-disc list-inside">
                        {result.remarks.map((remark, idx) => <li key={idx}>{remark}</li>)}
                    </ul>
                </div>
            </div>
          )}

        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

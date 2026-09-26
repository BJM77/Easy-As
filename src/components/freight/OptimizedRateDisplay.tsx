"use client";

import type { CalculatedPriceItem, IntelliSendResult } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Truck, Zap, Anchor, Box, Rocket, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OptimizedRateDisplayProps {
    optimizedResult: IntelliSendResult | null;
    onOpenBreakdown: (result: CalculatedPriceItem) => void;
    showLcpRates: boolean;
}

const formatCurrency = (amount: number | null) => {
  if (amount === null || isNaN(amount)) return "N/A";
  return amount.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });
};

const SingleOptimizedRate = ({ title, icon, result, onOpenBreakdown }: { title: string, icon: React.ReactNode, result: CalculatedPriceItem | null | undefined, onOpenBreakdown: (res: CalculatedPriceItem) => void }) => {
  if (!result || !result.isApplicable || result.finalPrice === null) return null;

  return (
    <div className="flex-shrink-0 min-w-[140px] p-2 bg-background border rounded-md shadow-sm group hover:border-primary/50 transition-colors">
      <p className="text-[10px] font-black font-headline uppercase tracking-widest text-muted-foreground flex items-center mb-1">
        {icon}
        <span className="truncate ml-1">{title}</span>
      </p>
      <div className="flex flex-col">
        <p className="text-base font-bold font-headline text-primary tabular-nums">{formatCurrency(result.finalPrice)}</p>
        <button 
          onClick={() => onOpenBreakdown(result)} 
          className="text-[9px] text-left font-headline text-muted-foreground hover:text-primary transition-colors underline decoration-dotted"
        >
          {result.serviceName}
        </button>
      </div>
    </div>
  );
};

const MiniRate = ({ title, icon, price }: { title: string, icon: React.ReactNode, price: number | null | undefined }) => {
    if (price === null || price === undefined) return null;
    return (
        <div className="flex-shrink-0 min-w-[120px] p-2 bg-background border rounded-md shadow-sm border-dashed">
            <p className="text-[9px] font-bold font-headline uppercase tracking-tighter text-muted-foreground flex items-center mb-0.5">
                {icon}
                <span className="truncate ml-1">{title}</span>
            </p>
            <p className="text-sm font-bold font-headline text-foreground">{formatCurrency(price)}</p>
        </div>
    );
};


export default function OptimizedRateDisplay({ optimizedResult, onOpenBreakdown, showLcpRates }: OptimizedRateDisplayProps) {
    if (!optimizedResult) return null;

    return (
        <Card className="mt-4 shadow-md border-l-4 border-accent bg-accent/5 overflow-hidden">
             <CardHeader className="pb-2 p-4">
                <CardTitle className="text-sm font-bold font-headline flex items-center text-primary uppercase tracking-widest">
                    <Sparkles className="mr-2 h-4 w-4 text-accent" />
                    Best Rates Overview
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide no-scrollbar">
                  <SingleOptimizedRate title="Standard" icon={<Truck className="h-3 w-3" />} result={optimizedResult.bestStdResult} onOpenBreakdown={onOpenBreakdown} />
                  <SingleOptimizedRate title="Priority" icon={<Zap className="h-3 w-3 text-cyan-600" />} result={optimizedResult.bestPrioResult} onOpenBreakdown={onOpenBreakdown} />
                  <SingleOptimizedRate title="Pallet" icon={<Anchor className="h-3 w-3 text-blue-600" />} result={optimizedResult.bestPalletResult} onOpenBreakdown={onOpenBreakdown} />
                  
                  {showLcpRates && (
                    <>
                        <MiniRate title="GO Std" icon={<Rocket className="h-3 w-3 text-orange-600"/>} price={optimizedResult.lcpGoStdPrice} />
                        <MiniRate title="GO Prio" icon={<Rocket className="h-3 w-3 text-orange-600"/>} price={optimizedResult.lcpGoPriorityPrice} />
                    </>
                  )}
                  
                  <MiniRate title="B2C Std" icon={<Box className="h-3 w-3 text-amber-600"/>} price={optimizedResult.b2cStdPrice} />
                  <MiniRate title="B2C Prio" icon={<Box className="h-3 w-3 text-amber-600"/>} price={optimizedResult.b2cPriorityPrice} />
                </div>
                {optimizedResult.combinationText && (
                  <p className="text-[10px] text-muted-foreground mt-2 italic flex items-center gap-1.5 font-headline">
                    <Info className="h-3 w-3" />
                    Optimization Logic: {optimizedResult.combinationText}
                  </p>
                )}
            </CardContent>
        </Card>
    );
}
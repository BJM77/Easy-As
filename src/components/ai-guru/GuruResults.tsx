
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { BarChart, Package, Info } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface GuruResultsProps {
  analysis: any;
  pricingByOrigin: any[];
}

export default function GuruResults({ analysis, pricingByOrigin }: GuruResultsProps) {
  const getVarianceDisplay = (savings: number | null) => {
    if (savings === null) return null;
    const colorClass = savings >= 0 ? 'text-green-600' : 'text-red-600';
    const formatted = Math.abs(savings).toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });
    return (
      <span className={`text-[10px] font-bold ${colorClass}`}>
        ({savings >= 0 ? '+' : '-'}{formatted})
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart className="h-5 w-5 text-primary" />
            Spend Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-[10px] uppercase font-bold text-muted-foreground">Recommended Band</p>
            <p className="text-2xl font-bold text-primary">SB {analysis.recommendedSpendBand}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-muted-foreground">Est. Monthly Spend</p>
            <p className="text-2xl font-bold">{analysis.calculatedMonthlySpend.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-muted-foreground">Analysis Source</p>
            <Badge variant="outline" className="mt-1">{analysis.spendSource}</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {pricingByOrigin.map((originData, originIndex) => (
          <div key={originIndex} className="space-y-4">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Package className="h-6 w-6 text-primary" />
              Proposed Routes from {originData.originName}
            </h3>
            {originData.results.map((destResult: any, destIndex: number) => (
              <Card key={destIndex}>
                <CardHeader className="p-3 bg-muted/30 border-b">
                  <CardTitle className="text-sm font-bold">{destResult.destination}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/10">
                        <TableHead className="text-[10px] uppercase">Service</TableHead>
                        <TableHead className="text-[10px] uppercase text-right">Weight</TableHead>
                        <TableHead className="text-[10px] uppercase text-right">Target</TableHead>
                        <TableHead className="text-[10px] uppercase text-right">TGE Price</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {destResult.legs.map((leg: any, legIndex: number) => (
                        <TableRow key={legIndex} className="hover:bg-muted/5 transition-colors">
                          <TableCell className="font-semibold text-xs">{leg.serviceName}</TableCell>
                          <TableCell className="text-right text-xs font-mono">{leg.weight}kg</TableCell>
                          <TableCell className="text-right text-xs font-mono text-muted-foreground">
                            {leg.targetPrice.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-col items-end">
                              <span className="font-bold text-sm text-primary">
                                {leg.tgePrice ? leg.tgePrice.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' }) : 'N/A'}
                              </span>
                              {getVarianceDisplay(leg.savings)}
                              {leg.calculationFormula && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger className="text-[9px] text-muted-foreground hover:text-foreground cursor-help truncate max-w-[120px]">
                                      {leg.calculationFormula}
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs text-[10px] font-mono">
                                      {leg.calculationFormula}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

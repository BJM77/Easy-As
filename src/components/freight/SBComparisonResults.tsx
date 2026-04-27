
"use client";

import type { SBComparisonResult } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PackageCheck, AlertTriangle, Info, DollarSign, Weight, Fuel, PlusCircle as SurchargeIcon, MapPin } from 'lucide-react';
import { Badge } from '../ui/badge';

interface SBComparisonResultsProps {
  results: SBComparisonResult[];
}

const formatCurrency = (amount: number | null) => {
  if (amount === null || isNaN(amount)) return "N/A";
  return amount.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });
};

export default function SBComparisonResults({ results }: SBComparisonResultsProps) {
  if (!results || results.length === 0) {
    return (
      <Card className="mt-4 shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-headline flex items-center"><Info className="mr-2 h-5 w-5 text-primary"/>No Results</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No comparison data available. Please complete the form, select services, and calculate.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      {results.map((serviceResult) => (
        <Card key={serviceResult.serviceName} className={`shadow-lg border-l-4 ${serviceResult.isOverallApplicable ? 'border-primary' : 'border-destructive opacity-80'}`}>
          <CardHeader className="pb-3">
            <div className="flex justify-between items-start">
                <CardTitle className="text-xl font-semibold flex items-center">
                    {serviceResult.isOverallApplicable ? <PackageCheck className="mr-2 h-6 w-6 text-green-500" /> : <AlertTriangle className="mr-2 h-6 w-6 text-destructive" />}
                    {serviceResult.serviceName}
                </CardTitle>
                {serviceResult.isOverallApplicable ? (
                     <Badge variant="outline" className="text-xs text-green-600 border-green-600">Applicable</Badge>
                ) : (
                     <Badge variant="destructive" className="text-xs">Not Applicable</Badge>
                )}
            </div>
            {!serviceResult.isOverallApplicable && serviceResult.overallRemarks.length > 0 && (
                 <CardDescription className="text-destructive italic pt-1">
                    {serviceResult.overallRemarks.join('. ')}
                 </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {serviceResult.isOverallApplicable ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]"><DollarSign className="inline-block mr-1 h-4 w-4 text-muted-foreground"/>Spend Band</TableHead>
                    <TableHead className="text-right">Base Rate</TableHead>
                    <TableHead className="text-right"><Weight className="inline-block mr-1 h-4 w-4 text-muted-foreground"/>Chargeable Wt.</TableHead>
                    <TableHead><MapPin className="inline-block mr-1 h-4 w-4 text-muted-foreground"/>Charge Zone</TableHead>
                    <TableHead className="text-right"><Fuel className="inline-block mr-1 h-4 w-4 text-muted-foreground"/>Fuel</TableHead>
                    <TableHead className="text-right"><SurchargeIcon className="inline-block mr-1 h-4 w-4 text-muted-foreground"/>Other Surch.</TableHead>
                    <TableHead className="text-right">Total Surch. & Extras</TableHead>
                    <TableHead className="text-right font-semibold">Final Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {serviceResult.spendBandPrices.map(({ spendBand, priceItem }) => (
                    <TableRow key={`${serviceResult.serviceName}-${spendBand}`} className={!priceItem.isApplicable ? "opacity-60" : ""}>
                      <TableCell className="font-medium">SB {spendBand}</TableCell>
                      <TableCell className="text-right">{formatCurrency(priceItem.baseRate)}</TableCell>
                      <TableCell className="text-right">{priceItem.chargeableWeight > 0 ? `${priceItem.chargeableWeight.toFixed(2)} kg` : 'N/A'}</TableCell>
                      <TableCell>
                        {priceItem.chargeZoneUsed && priceItem.chargeZoneUsed !== "N/A" 
                          ? `${priceItem.isApplicable ? '' : 'Attempted: '}${priceItem.chargeZoneUsed}`
                          : (priceItem.remarks.length > 0 ? "" : "N/A")}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(priceItem.fuelSurchargeAmount)}</TableCell>
                      <TableCell className="text-right">
                        {priceItem.otherSurcharges.length > 0 
                            ? formatCurrency(priceItem.otherSurcharges.reduce((sum, s) => sum + s.amount, 0))
                            : formatCurrency(0)
                        }
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(priceItem.totalSurcharges + priceItem.totalExtrasAmount)}</TableCell>
                      <TableCell className={`text-right font-semibold ${priceItem.isApplicable ? 'text-primary': 'text-muted-foreground'}`}>{formatCurrency(priceItem.finalPrice)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-sm">This service is not applicable with the current inputs for any spend band.</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

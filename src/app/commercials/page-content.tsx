"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Briefcase, Calculator, DollarSign, Eraser, Download, FileText, Lock } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/firebase';


const CombinedCalculatorCard = ({ masterTotalCost }: { masterTotalCost: number }) => {
    const { toast } = useToast();
    const [values, setValues] = useState({
        totalCost: masterTotalCost,
        totalUnits: 0,
        totalWeight: 0,
        totalDistance: 0,
        averageKgRate: 0,
    });
    const [results, setResults] = useState<{
        perUnit: number | null,
        perWeight: number | null,
        perDistance: number | null,
        totalRevenue: number | null,
        grossProfit: number | null;
    } | null>(null);
    const [marginAnalysis, setMarginAnalysis] = useState<{ margin: number; rate: number; }[]>([]);


    useEffect(() => {
        setValues(prev => ({ ...prev, totalCost: masterTotalCost }));
    }, [masterTotalCost]);


    const handleCalculate = () => {
        const totalRevenue = values.averageKgRate * values.totalWeight;
        const grossProfit = totalRevenue - values.totalCost;
        const costPerWeight = values.totalWeight > 0 ? values.totalCost / values.totalWeight : null;
        
        setResults({
            perUnit: values.totalUnits > 0 ? values.totalCost / values.totalUnits : null,
            perWeight: costPerWeight,
            perDistance: values.totalDistance > 0 ? values.totalCost / values.totalDistance : null,
            totalRevenue: totalRevenue > 0 ? totalRevenue : null,
            grossProfit: totalRevenue > 0 ? grossProfit : null,
        });

        if (costPerWeight !== null) {
            const margins = [0, 5, 10, 15, 20, 25, 30, 40, 50];
            const analysis = margins.map(margin => ({
                margin,
                rate: costPerWeight * (1 + margin / 100),
            }));
            setMarginAnalysis(analysis);
        } else {
            setMarginAnalysis([]);
        }
    };

    const handleInputChange = (id: keyof typeof values, value: string) => {
        setValues(prev => ({ ...prev, [id]: parseFloat(value) || 0 }));
    };
    
    const formatResult = (value: number | null, unit: string) => {
        if (value === null || isNaN(value)) return "N/A";
        return `${value.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })} ${unit}`;
    }
     const formatCurrency = (value: number | null) => {
        if (value === null || isNaN(value)) return "N/A";
        return value.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });
    }

    const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => event.target.select();
    
    const handleExportResults = () => {
        if (!results) {
            toast({ title: "No data to export", description: "Please calculate metrics first.", variant: "destructive" });
            return;
        }

        let csvContent = "data:text/csv;charset=utf-8,";
        
        // Inputs
        csvContent += "Metric,Value\r\n";
        csvContent += `Total Freight Cost,${values.totalCost}\r\n`;
        csvContent += `Number of Units,${values.totalUnits}\r\n`;
        csvContent += `Total Weight (kg),${values.totalWeight}\r\n`;
        csvContent += `Total Distance (km),${values.totalDistance}\r\n`;
        csvContent += `Average Rate per Kg,${values.averageKgRate}\r\n`;
        csvContent += "\r\n";

        // Results
        csvContent += "Result,Value\r\n";
        csvContent += `Cost Per Weight (per kg),${results.perWeight ?? 'N/A'}\r\n`;
        csvContent += `Total Revenue,${results.totalRevenue ?? 'N/A'}\r\n`;
        csvContent += `Gross Profit,${results.grossProfit ?? 'N/A'}\r\n`;
        csvContent += "\r\n";

        // Margin Analysis
        csvContent += "Margin Analysis (Rate per Kg)\r\n";
        csvContent += marginAnalysis.map(m => `${m.margin}%`).join(',') + '\r\n';
        csvContent += marginAnalysis.map(m => m.rate).join(',') + '\r\n';

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "essential_metrics_export.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <Card className="lg:col-span-2">
            <CardHeader>
                <CardTitle className="flex items-center"><Calculator className="mr-2 h-5 w-5"/>Essential Metrics Calculator</CardTitle>
                <CardDescription>Enter your shipment details once to see all fundamental cost breakdowns.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="space-y-1">
                        <Label htmlFor="combined_totalCost">Total Freight Cost ($)</Label>
                        <Input id="combined_totalCost" type="number" placeholder="e.g., 1200" value={values.totalCost} readOnly className="font-bold bg-muted/50" onFocus={handleFocus} />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="combined_totalUnits">Number of Units</Label>
                        <Input id="combined_totalUnits" type="number" placeholder="e.g., 600" onChange={(e) => handleInputChange('totalUnits', e.target.value)} onFocus={handleFocus} />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="combined_totalWeight">Total Weight (kg)</Label>
                        <Input id="combined_totalWeight" type="number" placeholder="e.g., 2000" onChange={(e) => handleInputChange('totalWeight', e.target.value)} onFocus={handleFocus} />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="combined_totalDistance">Total Distance (km)</Label>
                        <Input id="combined_totalDistance" type="number" placeholder="e.g., 800" onChange={(e) => handleInputChange('totalDistance', e.target.value)} onFocus={handleFocus} />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="combined_averageKgRate">Average Rate per Kg ($)</Label>
                        <Input id="combined_averageKgRate" type="number" placeholder="e.g., 0.75" onChange={(e) => handleInputChange('averageKgRate', e.target.value)} onFocus={handleFocus} />
                    </div>
                 </div>
                 <div className="flex flex-col sm:flex-row items-center gap-4">
                    <Button onClick={handleCalculate}>Calculate Metrics</Button>
                    <Button onClick={handleExportResults} variant="outline"><FileText className="mr-2 h-4 w-4"/>Export Results</Button>
                </div>
                 
                {results && (
                  <div className="pt-2 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                       <div>
                          <p className="text-sm font-medium text-foreground">Cost Per Weight:</p>
                          <p className="text-lg font-bold text-primary">{formatResult(results.perWeight, 'per kg')}</p>
                      </div>
                       <div>
                          <p className="text-sm font-medium text-foreground">Total Revenue:</p>
                          <p className="text-lg font-bold text-primary">{formatCurrency(results.totalRevenue)}</p>
                      </div>
                       <div>
                          <p className="text-sm font-medium text-foreground">Gross Profit:</p>
                          <p className={`text-lg font-bold ${results.grossProfit !== null && results.grossProfit < 0 ? 'text-destructive' : 'text-primary'}`}>{formatCurrency(results.grossProfit)}</p>
                      </div>
                  </div>
                )}

                {marginAnalysis.length > 0 && (
                    <div className="pt-4 overflow-x-auto">
                        <h4 className="text-md font-semibold mb-2">Margin Analysis (Rate per Kg)</h4>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {marginAnalysis.map(({ margin }) => (
                                        <TableHead key={margin} className="text-right">{margin}%</TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow>
                                    {marginAnalysis.map(({ margin, rate }) => (
                                        <TableCell key={`rate-${margin}`} className="text-right font-mono">{formatCurrency(rate)}</TableCell>
                                    ))}
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

const TotalFreightCostCalculator = ({ setMasterTotalCost }: { setMasterTotalCost: (cost: number) => void }) => {
    const initialCostsState: Record<string, number | string> = {};
    const [costs, setCosts] = useState<Record<string, number | string>>(initialCostsState);
    const [totalCost, setTotalCost] = useState<number | null>(null);

    const handleInputChange = (id: string, value: string) => {
        setCosts(prev => ({...prev, [id]: value }));
    }

    const calculateTotal = () => {
        const total = Object.values(costs).reduce((sum, current) => sum + (parseFloat(String(current)) || 0), 0);
        setTotalCost(total);
        setMasterTotalCost(total);
    }

    const clearAllCosts = () => {
      const clearedCosts: Record<string, number | string> = {};
      Object.keys(costs).forEach(key => {
        clearedCosts[key] = '';
      });
      setCosts(clearedCosts);
      setTotalCost(null);
      setMasterTotalCost(0);
    }
    
    const costFields = {
        fixed: [
            { id: 'depreciation', label: 'Vehicle Depreciation/Leasing' },
            { id: 'insurance', label: 'Insurance' },
            { id: 'salaries', label: 'Driver Salaries' },
            { id: 'permits', label: 'Permits & Licensing' },
            { id: 'admin', label: 'Admin Overhead' },
        ],
        variable: [
            { id: 'fuel', label: 'Fuel' },
            { id: 'maintenance', label: 'Maintenance & Repairs' },
            { id: 'tyres', label: 'Tyres' },
            { id: 'tolls', label: 'Tolls' },
            { id: 'allowances', label: 'Driver Allowances' },
        ],
        accessorial: [
            { id: 'detention', label: 'Detention / Wait Time' },
            { id: 'other', label: 'Other' },
        ],
    }

    const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => event.target.select();
    
    const handleDownloadTemplate = () => {
        const allFields = [...costFields.fixed, ...costFields.variable, ...costFields.accessorial];
        const headers = allFields.map(field => `"${field.label.replace(/"/g, '""')}"`).join(',');
        let csvContent = "data:text/csv;charset=utf-8," + headers + '\r\n';
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "freight_cost_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <Card className="lg:col-span-2">
            <CardHeader>
                <CardTitle className="flex items-center"><DollarSign className="mr-2 h-5 w-5"/>Total Freight Cost Calculator</CardTitle>
                <CardDescription>Enter all known costs to get a comprehensive total. This total will populate the 'Essential Metrics' calculator below.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Accordion type="multiple" defaultValue={[]}>
                    <AccordionItem value="fixed">
                        <AccordionTrigger className="text-base font-semibold">Fixed Costs</AccordionTrigger>
                        <AccordionContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                            {costFields.fixed.map(field => (
                                <div key={field.id} className="space-y-1">
                                    <Label htmlFor={field.id}>{field.label}</Label>
                                    <Input id={field.id} type="number" placeholder="0.00" value={costs[field.id] || ''} onChange={(e) => handleInputChange(field.id, e.target.value)} onFocus={handleFocus} />
                                </div>
                            ))}
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="variable">
                        <AccordionTrigger className="text-base font-semibold">Variable Costs</AccordionTrigger>
                        <AccordionContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                            {costFields.variable.map(field => (
                                <div key={field.id} className="space-y-1">
                                    <Label htmlFor={field.id}>{field.label}</Label>
                                    <Input id={field.id} type="number" placeholder="0.00" value={costs[field.id] || ''} onChange={(e) => handleInputChange(field.id, e.target.value)} onFocus={handleFocus} />
                                </div>
                            ))}
                        </AccordionContent>
                    </AccordionItem>
                     <AccordionItem value="accessorial">
                        <AccordionTrigger className="text-base font-semibold">Accessorial Charges</AccordionTrigger>
                        <AccordionContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                           {costFields.accessorial.map(field => (
                                <div key={field.id} className="space-y-1">
                                    <Label htmlFor={field.id}>{field.label}</Label>
                                    <Input id={field.id} type="number" placeholder="0.00" value={costs[field.id] || ''} onChange={(e) => handleInputChange(field.id, e.target.value)} onFocus={handleFocus} />
                                </div>
                            ))}
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
                <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
                    <Button onClick={calculateTotal}>Calculate Total Cost</Button>
                    <Button onClick={clearAllCosts} variant="outline"><Eraser className="mr-2 h-4 w-4"/>Clear All</Button>
                    <Button onClick={handleDownloadTemplate} variant="outline"><Download className="mr-2 h-4 w-4"/>Download Template</Button>
                    {totalCost !== null && (
                        <div className="p-3 rounded-md bg-muted flex-grow text-center sm:text-left">
                            <p className="text-sm font-medium text-foreground">Calculated Total Cost:</p>
                            <p className="text-2xl font-bold text-primary">{totalCost.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })}</p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}


export default function CommercialsPageContent() {
  const [masterTotalCost, setMasterTotalCost] = useState(0);
  const { role } = useAuth();

  if (role && !['admin', 'superadmin'].includes(role)) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center"><Lock className="mr-2 h-5 w-5"/>Access Denied</CardTitle>
                <CardDescription>
                    This page is restricted to Admin and Super Admin users.
                </CardDescription>
            </CardHeader>
        </Card>
    );
  }


  return (
    <div className="space-y-8">
      <Accordion type="single" collapsible defaultValue="essential-calcs" className="w-full">
        <AccordionItem value="essential-calcs">
          <AccordionTrigger className="text-xl font-semibold">
            Essential Cost Analysis Calculations
          </AccordionTrigger>
          <AccordionContent className="pt-2">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <TotalFreightCostCalculator setMasterTotalCost={setMasterTotalCost} />
                <div className="lg:col-span-2">
                  <CombinedCalculatorCard masterTotalCost={masterTotalCost} />
                </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
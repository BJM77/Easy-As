"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ServiceName, PostcodeData, FreightFormValues, CalculatedPriceItem } from '@/lib/types';
import { ALL_SERVICES, PALLET_LIKE_SERVICES } from '@/lib/types';
import { useSettings } from '@/context/SettingsContext';
import { useRateOverrides } from '@/context/RateOverrideContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { calculateAllFreightPrices } from '@/lib/freightCalculations';
import { analyzeCompetitorRates, type AnalysisSummary, type AnalysisInput } from '@/ai/flows/analyze-competitor-rates-flow';
import { useSession } from '@/context/SessionContext';
import { useAuth } from '@/firebase';
import { parseCsvRow } from '@/lib/csvParser';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Scale, PlusCircle, Trash2, ArrowRight, Settings, User, Briefcase, Printer, Eraser, Download, UploadCloud, Calculator, Sparkles, Mail, Clipboard, Check, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';

const zoneCompetitorComparisonFormSchema = z.object({
  companyName: z.string().optional(),
  competitorName: z.string().optional(),
  date: z.date().optional(),
  legs: z.array(z.object({
    id: z.string(),
    originZone: z.string().min(1, "Origin Zone is required."),
    destinationZone: z.string().min(1, "Destination Zone is required."),
    weight: z.coerce.number().positive("Weight must be positive."),
    price: z.coerce.number().positive("Price must be positive."),
  })).min(1, "At least one leg is required.").max(2000, "A maximum of 2000 legs can be compared at once."),
  selectedServices: z.array(z.string()).min(1, "At least one service must be selected."),
});

type ZoneCompetitorComparisonFormValues = z.infer<typeof zoneCompetitorComparisonFormSchema>;

interface ServiceAnalysisResult {
  serviceName: ServiceName;
  status: 'competitive' | 'not_competitive' | 'no_rate_found' | 'error';
  tgePrice?: number | null;
  competitiveSpendBand?: string;
  closestSpendBand?: string;
  discountNeeded?: number;
  remarks?: string;
  calculationFormula?: string;
  lookupKeyUsed?: string;
}

interface LegAnalysisResult {
  originalLeg: {
    id: string;
    originZone: string;
    destinationZone: string;
    weight: number;
    price: number;
  };
  analyses: ServiceAnalysisResult[];
}

interface AnalysisInfo {
  results: LegAnalysisResult[];
  companyName?: string;
  competitorName?: string;
}

const formatCurrency = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined || isNaN(amount)) return "N/A";
  return amount.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });
};

const formatRate = (rate: number | null | undefined): string => {
  if (rate === null || rate === undefined || isNaN(rate)) return "N/A";
  return `${rate.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })}/kg`;
};

export default function ZoneSbPageContent() {
  const { globalSpendBands, serviceSettings, surchargeDefinitions, showLcpRates } = useSettings();
  const { toast } = useToast();
  const { getRateFile, isLoading: isLoadingRates, pezoneData } = useRateOverrides();
  const { addTokens } = useSession();
  const { role } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [analysisInfo, setAnalysisInfo] = useState<AnalysisInfo | null>(null);
  const [comparisonHistory, setComparisonHistory] = useState<ZoneCompetitorComparisonFormValues[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisSummary, setAnalysisSummary] = useState<AnalysisSummary | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const form = useForm<ZoneCompetitorComparisonFormValues>({
    resolver: zodResolver(zoneCompetitorComparisonFormSchema),
    defaultValues: {
      companyName: '',
      competitorName: '',
      date: new Date(),
      legs: [{ id: '1', originZone: '', destinationZone: '', weight: 0, price: 0 }],
      selectedServices: [],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "legs",
  });

  const saveToHistory = (data: ZoneCompetitorComparisonFormValues) => {
    try {
      if (typeof window !== 'undefined') {
        const dataWithDate = { ...data, date: new Date() };
        const storedHistory = localStorage.getItem('zoneCompetitorComparisonHistory');
        let history: ZoneCompetitorComparisonFormValues[] = storedHistory ? JSON.parse(storedHistory) : [];
        history = history.filter(entry => entry.companyName !== data.companyName || entry.competitorName !== data.competitorName);
        history.unshift(dataWithDate);
        const newHistory = history.slice(0, 3);
        localStorage.setItem('zoneCompetitorComparisonHistory', JSON.stringify(newHistory));
        setComparisonHistory(newHistory);
      }
    } catch (e) {
      console.error("Failed to save comparison history", e);
    }
  };

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const storedHistory = localStorage.getItem('zoneCompetitorComparisonHistory');
        if (storedHistory) {
          const history: ZoneCompetitorComparisonFormValues[] = JSON.parse(storedHistory);
          setComparisonHistory(history);
        }
      }
    } catch (e) {
      console.error('Failed to load competitor comparison history:', e);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('zoneCompetitorComparisonHistory');
      }
    }
  }, []);

  const addLeg = () => {
    if (fields.length < 2000) {
      append({ id: (fields.length + 1).toString(), originZone: '', destinationZone: '', weight: 0, price: 0 });
    } else {
      toast({ title: "Limit Reached", description: "You can compare a maximum of 2000 legs at a time.", variant: "default" });
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => parseAndSetLegs(e.target?.result as string);
      reader.onerror = () => toast({ title: "File Read Error", description: "Could not read the selected file.", variant: "destructive" });
      reader.readAsText(file);
    }
  };

  const parseAndSetLegs = (csvText: string) => {
    const lines = csvText.trim().split(/\r\n|\n/);
    if (lines.length < 2) {
      toast({ title: "CSV Error", description: "CSV must have a header and at least one data row.", variant: "destructive" });
      return;
    }
    if (lines.length - 1 > 2000) {
      toast({ title: "File Too Large", description: `File has ${lines.length - 1} rows. The maximum allowed is 2000.`, variant: "destructive" });
      return;
    }

    const header = parseCsvRow(lines[0].toLowerCase());
    const headerMap = {
      originZone: header.indexOf("origin zone"),
      destinationZone: header.indexOf("destination zone"),
      weight: header.indexOf("weight"),
      price: header.indexOf("price")
    };

    if (Object.values(headerMap).some(index => index === -1)) {
      toast({ title: "CSV Header Error", description: "CSV must contain headers: 'Origin Zone', 'Destination Zone', 'Weight', 'Price'.", variant: "destructive", duration: 10000 });
      return;
    }

    const newLegs: any[] = [];
    let errorCount = 0;

    lines.slice(1).forEach((line, index) => {
      const values = parseCsvRow(line);
      if (values.length < Object.keys(headerMap).length) {
        errorCount++;
        return;
      }
      const originZone = values[headerMap.originZone]?.trim();
      const destinationZone = values[headerMap.destinationZone]?.trim();
      const weight = parseFloat(values[headerMap.weight]);
      const price = parseFloat(values[headerMap.price]);

      if (!originZone || !destinationZone || isNaN(weight) || isNaN(price)) {
        errorCount++;
        return;
      }

      newLegs.push({
        id: `csv-${index}`,
        originZone,
        destinationZone,
        weight,
        price,
      });
    });

    if (newLegs.length > 0) {
      replace(newLegs);
    }
    toast({
      title: "CSV Processed",
      description: `Successfully loaded ${newLegs.length} legs. ${errorCount > 0 ? `${errorCount} rows had errors and were skipped.` : ''}`
    });
  };

  const handleClearUpload = () => {
    setFileName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    toast({ title: "Upload Cleared" });
  };

  const handleDownloadTemplate = () => {
    const csvContent = "Origin Zone,Destination Zone,Weight,Price\r\nSYD,MEL,15,45.50\r\nPER,VIC1,120,210.00\n";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', 'zone_competitor_legs_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    toast({ title: "Template Download Started" });
  };

  const onSubmit = async (data: ZoneCompetitorComparisonFormValues) => {
    setIsLoading(true);
    setAnalysisInfo(null);
    setAnalysisSummary(null);
    saveToHistory(data);

    try {
      const analysisPromises = data.legs.map(async (leg) => {
        const analyses = await recalculateSingleLeg(leg, data.selectedServices as ServiceName[]);
        return {
          originalLeg: leg,
          analyses,
        };
      });

      const results = await Promise.all(analysisPromises);
      const newAnalysisInfo = { results, companyName: data.companyName, competitorName: data.competitorName };
      setAnalysisInfo(newAnalysisInfo);

      toast({ title: "Comparison Complete", description: "Analysis finished for all legs. Generating AI insights..." });

      const analysisForAI: AnalysisInput = {
        analysisJSON: JSON.stringify(results.map(legResult => ({
          origin: legResult.originalLeg.originZone,
          destination: legResult.originalLeg.destinationZone,
          weight: legResult.originalLeg.weight,
          competitorPrice: legResult.originalLeg.price,
          tgeAnalyses: legResult.analyses.map(analysis => ({
            serviceName: analysis.serviceName,
            tgePrice: analysis.tgePrice,
            spendBand: analysis.competitiveSpendBand || analysis.closestSpendBand,
            status: analysis.status,
          })),
        })))
      };

      setIsAnalyzing(true);
      try {
        const { summary, usage } = await analyzeCompetitorRates(analysisForAI);
        addTokens(usage.totalTokens);
        setAnalysisSummary(summary);
      } catch (aiError) {
        console.error("AI Analysis Error:", aiError);
        toast({ title: "AI Analysis Failed", description: "Could not generate AI summary.", variant: "destructive" });
      } finally {
        setIsAnalyzing(false);
      }

    } catch (error) {
      console.error("An error occurred during competitor comparison:", error);
      toast({
        title: "Comparison Failed",
        description: "An unexpected error occurred.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    if (!analysisInfo) {
      toast({ title: "No data to export", description: "Please run an analysis first.", variant: "destructive" });
      return;
    }
    const headers = ["Origin Zone", "Destination Zone", "Weight", "Competitor Price", "TGE Price", "Variance"];
    let csvContent = "data:text/csv;charset=utf-8," + headers.join(',') + '\r\n';
    analysisInfo.results.forEach(legResult => {
      const { originalLeg, analyses } = legResult;
      const bestAnalysis = analyses
        .filter(a => a.tgePrice !== null && a.tgePrice !== undefined)
        .reduce((best, current) => {
          if (!best) return current;
          const bestDiff = Math.abs(best.tgePrice! - originalLeg.price);
          const currentDiff = Math.abs(current.tgePrice! - originalLeg.price);
          return currentDiff < bestDiff ? current : best;
        }, null as ServiceAnalysisResult | null);

      const tgePrice = bestAnalysis?.tgePrice ?? null;
      const variance = (tgePrice !== null) ? tgePrice - originalLeg.price : null;
      const row = [
        `"${originalLeg.originZone.replace(/"/g, '""')}"`,
        `"${originalLeg.destinationZone.replace(/"/g, '""')}"`,
        originalLeg.weight,
        originalLeg.price,
        tgePrice ?? 'N/A',
        variance !== null ? variance.toFixed(2) : 'N/A'
      ];
      csvContent += row.join(',') + '\r\n';
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    const exportFileName = `Zone_Competitor_Analysis_${form.getValues('companyName') || 'Export'}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.setAttribute("download", exportFileName);
    link.setAttribute("href", encodedUri);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Export Started" });
  };

  const handleLoadHistory = (data: ZoneCompetitorComparisonFormValues) => {
    const dataToLoad = { ...data, selectedServices: [] };
    form.reset(dataToLoad);
    toast({ title: "History Loaded", description: `Loaded comparison for ${data.companyName || 'previous entry'}.` });
  };

  const handleClearForm = () => {
    form.reset({
      companyName: '',
      competitorName: '',
      date: new Date(),
      legs: [{ id: '1', originZone: '', destinationZone: '', weight: 0, price: 0 }],
      selectedServices: [],
    });
    setAnalysisInfo(null);
    setAnalysisSummary(null);
    toast({ title: "Form Cleared" });
  };

  const handleCopyToClipboard = async () => {
    if (analysisSummary?.suggestedEmailBody) {
      try {
        await navigator.clipboard.writeText(analysisSummary.suggestedEmailBody);
        setIsCopied(true);
        toast({ title: "Copied to clipboard!" });
        setTimeout(() => setIsCopied(false), 2000);
      } catch (err) {
        console.error("Clipboard access denied:", err);
        toast({
          title: "Copy Failed",
          description: "Browser permissions blocked clipboard access. Please manually select and copy the text.",
          variant: "destructive"
        });
      }
    }
  };

  const recalculateSingleLeg = async (leg: any, selectedServices: ServiceName[]): Promise<ServiceAnalysisResult[]> => {
    const serviceAnalysisPromises = selectedServices.map(async (serviceName) => {
      const isSpendBandDependent = !serviceName.startsWith('LCP');
      const spendBandsToCheck = isSpendBandDependent ? globalSpendBands : ["N/A"];
      const pricesBySpendBand: { spendBand: string; price: number | null; calculationFormula?: string; lookupKeyUsed?: string }[] = [];

      const originLocation: PostcodeData = {
        suburb: leg.originZone.toUpperCase().trim(),
        state: '',
        postcode: 0,
        prio: leg.originZone.toUpperCase().trim(),
        ipec: leg.originZone.toUpperCase().trim(),
        pallet: leg.originZone.toUpperCase().trim(),
        isZoneDirect: true
      };

      const destinationLocation: PostcodeData = {
        suburb: leg.destinationZone.toUpperCase().trim(),
        state: '',
        postcode: 0,
        prio: leg.destinationZone.toUpperCase().trim(),
        ipec: leg.destinationZone.toUpperCase().trim(),
        pallet: leg.destinationZone.toUpperCase().trim(),
        isZoneDirect: true
      };

      for (const sb of spendBandsToCheck) {
        const freightFormValuesForCalc: FreightFormValues = {
          spendBand: sb,
          originLocation,
          destinationLocation,
          originQuery: leg.originZone,
          destinationQuery: leg.destinationZone,
          items: [{ weight: leg.weight, quantity: 1, length: undefined, width: undefined, height: undefined }],
          globalNoCubic: true,
          globalOnPallet: PALLET_LIKE_SERVICES.includes(serviceName),
          selectedServices: [serviceName],
          additionalPercentageType: 'none',
          applyGST: false,
          tailLiftRequired: false,
        };
        const resultsForSB = await calculateAllFreightPrices({
          formData: freightFormValuesForCalc,
          allServiceSettings: serviceSettings,
          allSurchargeDefinitions: surchargeDefinitions,
          getRateFile,
          pezoneData
        });
        const priceItem = resultsForSB.find(r => r.serviceName === serviceName || r.serviceName.includes(serviceName));
        pricesBySpendBand.push({ spendBand: sb, price: priceItem?.finalPrice ?? null, calculationFormula: priceItem?.calculationFormula, lookupKeyUsed: priceItem?.chargeZoneUsed });
      }

      const validPrices = pricesBySpendBand.filter(p => p.price !== null && p.price > 0);
      if (validPrices.length === 0) return { serviceName, status: 'no_rate_found' as const, tgePrice: null, remarks: 'No applicable TGE rate found.', lookupKeyUsed: pricesBySpendBand[0]?.lookupKeyUsed };

      const competitiveBands = validPrices.filter(p => p.price! <= leg.price);
      if (competitiveBands.length > 0) {
        // Find the one with highest price that is still <= competitor price (i.e. most profitable competitive one)
        const bestSB = competitiveBands.reduce((prev, curr) => (curr.price! > prev.price! ? curr : prev));
        return {
          serviceName,
          status: 'competitive' as const,
          competitiveSpendBand: bestSB.spendBand,
          tgePrice: bestSB.price,
          calculationFormula: bestSB.calculationFormula,
          lookupKeyUsed: bestSB.lookupKeyUsed
        };
      }

      const closest = validPrices.reduce((prev, curr) => (Math.abs(curr.price! - leg.price) < Math.abs(prev.price! - leg.price) ? curr : prev));
      const discountNeeded = ((closest.price! - leg.price) / closest.price!) * 100;
      return { serviceName, status: 'not_competitive' as const, closestSpendBand: closest.spendBand, tgePrice: closest.price, discountNeeded, calculationFormula: closest.calculationFormula, lookupKeyUsed: closest.lookupKeyUsed };
    });

    return await Promise.all(serviceAnalysisPromises) as ServiceAnalysisResult[];
  };

  const servicesForDisplay = useMemo(() => {
    return showLcpRates ? ALL_SERVICES : ALL_SERVICES.filter(s => !s.startsWith('LCP'));
  }, [showLcpRates]);

  const overallLoading = isLoading || isLoadingRates;

  if (role && !['admin', 'superadmin', 'rsm', 'bdm'].includes(role)) {
    return (
      <Card>
        <CardHeader><CardTitle className="flex items-center"><Lock className="mr-2 h-5 w-5" />Access Denied</CardTitle></CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-8 print-expand">
      <Card className="shadow-xl print-hide">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <Scale className="mr-2 h-7 w-7 text-primary" /> Zone-Based Rate Comparison
          </CardTitle>
          <CardDescription>
            Enter competitor freight legs using direct Zones to see which TGE spend band is most competitive.
          </CardDescription>
        </CardHeader>
      </Card>

      <form onSubmit={form.handleSubmit(onSubmit)} className="print-hide">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Comparison Details</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="companyName" className="flex items-center"><User className="mr-2 h-4 w-4 text-muted-foreground" />Company Name</Label>
                <Input id="companyName" {...form.register('companyName')} placeholder="e.g., ACME Corp" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="competitorName" className="flex items-center"><Briefcase className="mr-2 h-4 w-4 text-muted-foreground" />Competitor Name</Label>
                <Input id="competitorName" {...form.register('competitorName')} placeholder="e.g., Speedy Freight" />
              </div>
            </CardContent>
            <CardFooter className="flex-wrap gap-4 justify-between border-t pt-4">
              <div className="flex gap-2 flex-wrap items-center">
                <span className="text-sm font-medium self-center text-muted-foreground">Load Previous:</span>
                {comparisonHistory.map((entry, index) => (
                  <Button key={index} type="button" variant="outline" size="sm" onClick={() => handleLoadHistory(entry)}>
                    {entry.companyName || `Entry ${index + 1}`}
                  </Button>
                ))}
              </div>
              <Button type="button" variant="ghost" onClick={handleClearForm}>
                <Eraser className="mr-2 h-4 w-4" /> Clear Form
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center"><UploadCloud className="mr-2 h-5 w-5" /> Bulk Upload Legs</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row gap-2 items-center">
              <Input id="csvFile" type="file" accept=".csv" onChange={handleFileUpload} ref={fileInputRef} className="flex-grow" />
              <div className="flex gap-2 w-full sm:w-auto">
                <Button type="button" variant="outline" size="sm" onClick={handleDownloadTemplate} className="flex-1 sm:flex-initial">
                  <Download className="mr-2 h-4 w-4" /> Template
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center"><Settings className="mr-2 h-5 w-5" /> Services to Compare</CardTitle>
            </CardHeader>
            <CardContent>
              <Controller
                name="selectedServices"
                control={form.control}
                render={({ field }) => (
                  <div className="flex flex-wrap gap-x-6 gap-y-3">
                    {servicesForDisplay.map((service) => (
                      <div key={service} className="flex items-center space-x-2">
                        <Checkbox
                          id={`service-${service}`}
                          checked={field.value.includes(service)}
                          onCheckedChange={(checked) => {
                            const newValue = checked
                              ? [...field.value, service]
                              : field.value.filter((s) => s !== service);
                            field.onChange(newValue);
                          }}
                        />
                        <Label htmlFor={`service-${service}`} className="font-normal cursor-pointer">{service}</Label>
                      </div>
                    ))}
                  </div>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-4">
              {fields.map((field, index) => (
                <Card key={field.id} className="p-4 bg-muted/30">
                  <div className="grid grid-cols-1 lg:grid-cols-[2fr_2fr_1fr_1fr_auto] gap-4 items-end">
                    <div className="space-y-1">
                      <Label htmlFor={`legs.${index}.originZone`}>Origin Zone</Label>
                      <Input
                        id={`legs.${index}.originZone`}
                        {...form.register(`legs.${index}.originZone`)}
                        placeholder="e.g. SYD, MEL"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`legs.${index}.destinationZone`}>Destination Zone</Label>
                      <Input
                        id={`legs.${index}.destinationZone`}
                        {...form.register(`legs.${index}.destinationZone`)}
                        placeholder="e.g. PER, BNE"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`legs.${index}.weight`}>Charge Kg</Label>
                      <Input id={`legs.${index}.weight`} type="number" {...form.register(`legs.${index}.weight`, { valueAsNumber: true })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`legs.${index}.price`}>Price ($)</Label>
                      <Input id={`legs.${index}.price`} type="number" step="0.01" {...form.register(`legs.${index}.price`, { valueAsNumber: true })} />
                    </div>
                    {fields.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => remove(index)} className="h-10 w-10 shrink-0">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
              <div className="flex gap-2">
                <Button type="button" onClick={addLeg} variant="outline" size="sm">
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Leg
                </Button>
              </div>
              <Separator />
              <div className="flex flex-wrap gap-2">
                <Button type="submit" className="flex-grow md:flex-grow-0 text-lg py-3 px-6 bg-accent hover:bg-accent/90 text-accent-foreground" disabled={overallLoading}>
                  {overallLoading ? <Loader2 className="mr-2 h-5 w-4 animate-spin" /> : 'Compare All Legs'}
                </Button>
                <Button onClick={handleExportCsv} variant="outline" className="flex-grow md:flex-grow-0" type="button" disabled={!analysisInfo || analysisInfo.results.length === 0}>
                  <Download className="mr-2 h-4 w-4" /> Export CSV
                </Button>
                <Button onClick={handlePrint} variant="outline" className="flex-grow md:flex-grow-0" type="button" disabled={!analysisInfo || analysisInfo.results.length === 0}>
                  <Printer className="mr-2 h-4 w-4" /> Export to PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>

      {(isAnalyzing || analysisSummary) && (
        <Card className="mt-8 card-print">
          <CardHeader><CardTitle className="flex items-center text-xl font-semibold"><Sparkles className="mr-2 h-6 w-6 text-accent" /> AI-Powered Analysis</CardTitle></CardHeader>
          <CardContent>
            {isAnalyzing && (
              <div className="flex items-center space-x-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /><span>Generating insights...</span></div>
            )}
            {analysisSummary && (
              <div className="space-y-4">
                <div><h4 className="font-semibold">Overall Verdict</h4><p>{analysisSummary.overallVerdict}</p></div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div><h4 className="font-semibold">Key Strengths</h4><ul className="list-disc list-inside">{analysisSummary.keyStrengths.map((item, i) => <li key={i}>{item}</li>)}</ul></div>
                  <div><h4 className="font-semibold">Key Opportunities</h4><ul className="list-disc list-inside">{analysisSummary.keyOpportunities.map((item, i) => <li key={i}>{item}</li>)}</ul></div>
                </div>
                <div><h4 className="font-semibold">Strategic Recommendation</h4><p>{analysisSummary.strategicRecommendation}</p></div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {analysisSummary?.suggestedEmailBody && (
        <Card className="mt-8 print-hide">
          <CardHeader><CardTitle className="flex items-center text-xl font-semibold"><Mail className="mr-2 h-6 w-6 text-accent" /> AI-Generated Email Draft</CardTitle></CardHeader>
          <CardContent><Textarea readOnly value={analysisSummary.suggestedEmailBody} className="h-64 font-mono text-sm" /></CardContent>
          <CardFooter>
            <Button onClick={handleCopyToClipboard}>
              {isCopied ? <Check className="mr-2 h-4 w-4" /> : <Clipboard className="mr-2 h-4 w-4" />}
              {isCopied ? 'Copied!' : 'Copy to Clipboard'}
            </Button>
          </CardFooter>
        </Card>
      )}

      {analysisInfo && analysisInfo.results.length > 0 && (
        <Card className="mt-8 card-print">
          <CardHeader><CardTitle>Comparison Analysis</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            {analysisInfo.results.map((result, index) => {
              const competitorEffectiveRate = result.originalLeg.weight > 0 ? result.originalLeg.price / result.originalLeg.weight : null;
              return (
                <div key={`result-${index}`}>
                  <div className="flex items-center space-x-2 p-3 bg-muted rounded-t-md flex-wrap gap-2">
                    <h3 className="font-semibold text-lg flex-grow">
                      Leg {index + 1}: {result.originalLeg.originZone} <ArrowRight className="inline mx-1 h-4 w-4" /> {result.originalLeg.destinationZone}
                    </h3>
                    <Badge>Weight: {result.originalLeg.weight}kg</Badge>
                    <Badge variant="default">{formatRate(competitorEffectiveRate)}</Badge>
                    <Badge>Price: {formatCurrency(result.originalLeg.price)}</Badge>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>TGE Service</TableHead>
                        <TableHead>Outcome</TableHead>
                        <TableHead className="flex items-center"><Calculator className="mr-2 h-4 w-4" />Calculation</TableHead>
                        <TableHead className="text-right">TGE Price</TableHead>
                        <TableHead className="text-right">Variance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.analyses.map(analysis => {
                        const variance = (analysis.tgePrice !== null && analysis.tgePrice !== undefined) ? analysis.tgePrice - result.originalLeg.price : null;
                        return (
                          <TableRow key={analysis.serviceName}>
                            <TableCell className="font-medium">{analysis.serviceName}</TableCell>
                            <TableCell>
                              {analysis.status === 'competitive' && <Badge variant="default" className="bg-green-600">Competitive at SB {analysis.competitiveSpendBand}</Badge>}
                              {analysis.status === 'not_competitive' && <Badge variant="secondary">Closest: SB {analysis.closestSpendBand} ({analysis.discountNeeded?.toFixed(1)}% gap)</Badge>}
                              {analysis.status === 'no_rate_found' && <Badge variant="destructive">No Rate Found</Badge>}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{analysis.calculationFormula || 'N/A'}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(analysis.tgePrice)}</TableCell>
                            <TableCell className={cn("text-right font-mono", variance !== null && variance > 0 && "text-destructive", variance !== null && variance < 0 && "text-green-600")}>{formatCurrency(variance)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

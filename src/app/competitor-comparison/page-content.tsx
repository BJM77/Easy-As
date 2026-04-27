"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { CompetitorLeg, ServiceName, PostcodeData, FreightFormValues, CalculatedPriceItem } from '@/lib/types';
import { ALL_SERVICES, PALLET_SERVICES } from '@/lib/types';
import { useSettings } from '@/context/SettingsContext';
import { useRateOverrides } from '@/context/RateOverrideContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { calculateAllFreightPrices } from '@/lib/freightCalculations';
import { analyzeCompetitorRates, type AnalysisSummary, type AnalysisInput } from '@/ai/flows/analyze-competitor-rates-flow';
import { useSession } from '@/context/SessionContext';
import { useAuth } from '@/firebase';


import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Scale, PlusCircle, Trash2, ArrowRight, CheckCircle2, AlertCircle, TrendingDown, Settings, User, Briefcase, Printer, BarChart, Eraser, Download, UploadCloud, Map as MapIcon, Calculator, Sparkles, Mail, Clipboard, Check, XCircle, Lock } from 'lucide-react';
import LocationAutocomplete from '@/components/freight/LocationAutocomplete';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Bar, XAxis, YAxis, CartesianGrid, Legend, BarChart as RechartsBarChart } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import SuburbPostcodeConverter from '@/components/freight/SuburbPostcodeConverter';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';


const competitorComparisonFormSchema = z.object({
  companyName: z.string().optional(),
  competitorName: z.string().optional(),
  date: z.date().optional(), // Add date for history tracking
  legs: z.array(z.object({
    id: z.string(),
    originQuery: z.string().min(1, "Origin is required."),
    originLocation: z.custom<PostcodeData | null>((data) => data !== null, "Valid Origin location is required."),
    destinationQuery: z.string().min(1, "Destination is required."),
    destinationLocation: z.custom<PostcodeData | null>((data) => data !== null, "Valid Destination is required."),
    weight: z.coerce.number().positive("Weight must be positive."),
    price: z.coerce.number().positive("Price must be positive."),
  })).min(1, "At least one leg is required.").max(2000, "A maximum of 2000 legs can be compared at once."),
  selectedServices: z.array(z.enum(ALL_SERVICES as [ServiceName, ...ServiceName[]])).min(1, "At least one service must be selected."),
});

type CompetitorComparisonFormValues = z.infer<typeof competitorComparisonFormSchema>;


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
    originalLeg: CompetitorLeg;
    analyses: ServiceAnalysisResult[];
    possibleOriginSuburbs?: PostcodeData[];
    possibleDestSuburbs?: PostcodeData[];
}

interface AnalysisInfo {
  results: LegAnalysisResult[];
  companyName?: string;
  competitorName?: string;
}

interface ChartDataPoint {
    name: string;
    [key: string]: number | string | null;
}

const initialChartConfig: ChartConfig = {};


const formatCurrency = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined || isNaN(amount)) return "N/A";
  return amount.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });
};

const formatRate = (rate: number | null | undefined): string => {
    if (rate === null || rate === undefined || isNaN(rate)) return "N/A";
    return `${rate.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })}/kg`;
};

export default function CompetitorComparisonPageContent() {
  const { globalSpendBands, serviceSettings, surchargeDefinitions, showLcpRates } = useSettings();
  const { toast } = useToast();
  const { getRateFile, isLoading: isLoadingRates, pezoneData } = useRateOverrides();
  const { addTokens } = useSession();
  const { role } = useAuth();
  
  const [isLoading, setIsLoading] = useState(false);
  const [analysisInfo, setAnalysisInfo] = useState<AnalysisInfo | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [chartConfig, setChartConfig] = useState<ChartConfig>(initialChartConfig);
  const [comparisonHistory, setComparisonHistory] = useState<CompetitorComparisonFormValues[]>([]);
  const [allPostcodes, setAllPostcodes] = useState<PostcodeData[]>([]);
  const [isLoadingPostcodes, setIsLoadingPostcodes] = useState(true);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isConverterOpen, setIsConverterOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisSummary, setAnalysisSummary] = useState<AnalysisSummary | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const form = useForm<CompetitorComparisonFormValues>({
    resolver: zodResolver(competitorComparisonFormSchema),
    defaultValues: {
      companyName: '',
      competitorName: '',
      date: new Date(),
      legs: [{ id: '1', originQuery: '', originLocation: null, destinationQuery: '', destinationLocation: null, weight: 0, price: 0 }],
      selectedServices: [],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "legs",
  });

  const saveToHistory = (data: CompetitorComparisonFormValues) => {
    try {
      if (typeof window !== 'undefined') {
        const dataWithDate = { ...data, date: new Date() };
        const storedHistory = localStorage.getItem('competitorComparisonHistory');
        let history: CompetitorComparisonFormValues[] = storedHistory ? JSON.parse(storedHistory) : [];
        history = history.filter(entry => entry.companyName !== data.companyName || entry.competitorName !== data.competitorName);
        history.unshift(dataWithDate);
        const newHistory = history.slice(0, 3);
        localStorage.setItem('competitorComparisonHistory', JSON.stringify(newHistory));
        setComparisonHistory(newHistory);
      }
    } catch(e) {
      console.error("Failed to save comparison history", e);
    }
  };
  
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const storedHistory = localStorage.getItem('competitorComparisonHistory');
        if (storedHistory) {
          const history: CompetitorComparisonFormValues[] = JSON.parse(storedHistory);
          setComparisonHistory(history);
        }
      }
    } catch (e) {
      console.error('Failed to load competitor comparison history:', e);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('competitorComparisonHistory');
      }
    }
    
    const fetchPostcodes = async () => {
      setIsLoadingPostcodes(true);
      try {
        const response = await fetch('/api/postcodes');
        if (!response.ok) throw new Error('Failed to fetch postcodes');
        const data: PostcodeData[] = await response.json();
        setAllPostcodes(data);
      } catch (error) {
        console.error("Error fetching postcodes for CRC page:", error);
        toast({ title: "Postcode Data Error", description: "Could not load postcode data.", variant: "destructive" });
      } finally {
        setIsLoadingPostcodes(false);
      }
    };
    fetchPostcodes();
  }, [toast]);
  
  const addLeg = () => {
    if (fields.length < 2000) {
      append({ id: (fields.length + 1).toString(), originQuery: '', originLocation: null, destinationQuery: '', destinationLocation: null, weight: 0, price: 0 });
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
    if (isLoadingPostcodes) {
      toast({ title: "Please wait", description: "Postcode data is still loading.", variant: "default" });
      return;
    }
    const lines = csvText.trim().split(/\r\n|\n/);
    if (lines.length < 2) {
      toast({ title: "CSV Error", description: "CSV must have a header and at least one data row.", variant: "destructive" });
      return;
    }
    if (lines.length - 1 > 2000) {
      toast({ title: "File Too Large", description: `File has ${lines.length - 1} rows. The maximum allowed is 2000.`, variant: "destructive" });
      return;
    }
  
    const header = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
    const headerMap = {
        originSub: header.indexOf("origin sub"),
        originPC: header.indexOf("origin pc"),
        destSub: header.indexOf("destination sub"),
        destPC: header.indexOf("destination pc"),
        weight: header.indexOf("weight"),
        price: header.indexOf("price")
    };
  
    if (Object.values(headerMap).some(index => index === -1)) {
        toast({ title: "CSV Header Error", description: "CSV must contain headers: 'Origin Sub', 'Origin PC', 'Destination Sub', 'Destination PC', 'Weight', 'Price'.", variant: "destructive", duration: 10000 });
        return;
    }
  
    const newLegs: CompetitorLeg[] = [];
    let errorCount = 0;
  
    const findLocation = (suburbHint: string, postcodeStr: string): PostcodeData | null => {
      if (!postcodeStr || !allPostcodes) return null;
      const postcode = parseInt(postcodeStr.trim(), 10);
      if (isNaN(postcode)) return null;
      const lowerSuburbHint = suburbHint.toLowerCase().trim();
      const candidates = allPostcodes.filter(p => p.postcode === postcode);
      if (candidates.length === 0) return null;
      const exactMatch = candidates.find(p => p.suburb.toLowerCase() === lowerSuburbHint);
      if (exactMatch) return exactMatch;
      const partialMatch = candidates.find(p => p.suburb.toLowerCase().includes(lowerSuburbHint));
      if (partialMatch) return partialMatch;
      return candidates[0];
    };
  
    lines.slice(1).forEach((line, index) => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        if (values.length < Object.keys(headerMap).length) {
            errorCount++;
            return;
        }
        const originSuburb = values[headerMap.originSub];
        const originPC = values[headerMap.originPC];
        const destSuburb = values[headerMap.destSub];
        const destPC = values[headerMap.destPC];
        const weight = parseFloat(values[headerMap.weight]);
        const price = parseFloat(values[headerMap.price]);
        const originLoc = findLocation(originSuburb, originPC);
        const destLoc = findLocation(destSuburb, destPC);
        if (!originLoc || !destLoc || isNaN(weight) || isNaN(price)) {
            errorCount++;
            return;
        }
        newLegs.push({
            id: `csv-${index}`,
            originQuery: `${originLoc.suburb} ${originLoc.postcode}`,
            originLocation: originLoc,
            destinationQuery: `${destLoc.suburb} ${destLoc.postcode}`,
            destinationLocation: destLoc,
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
    const csvContent = "Origin Sub,Origin PC,Destination Sub,Destination PC,Weight,Price\r\nMOUNT GAMBIER,5290,BEARD,2620,2,17.12\r\nMOUNT GAMBIER,5290,HILL TOP,2575,19,20.33\n";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', 'competitor_legs_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    toast({ title: "Template Download Started" });
  };

  const onSubmit = async (data: CompetitorComparisonFormValues) => {
    setIsLoading(true);
    setAnalysisInfo(null);
    setChartData([]);
    setAnalysisSummary(null);
    saveToHistory(data);

    try {
      const analysisPromises = data.legs.map(async (leg) => {
        const analyses = await recalculateSingleLeg(leg);
        const possibleOriginSuburbs = allPostcodes.filter(p => p.postcode === leg.originLocation?.postcode);
        const possibleDests = allPostcodes.filter(p => p.postcode === leg.destinationLocation?.postcode);

        return { 
            originalLeg: leg, 
            analyses, 
            possibleOriginSuburbs: possibleOriginSuburbs.length > 1 ? possibleOriginSuburbs : [],
            possibleDestSuburbs: possibleDests.length > 1 ? possibleDests : [],
        };
      });

      const results = await Promise.all(analysisPromises);
      
      const newAnalysisInfo = { results, companyName: data.companyName, competitorName: data.competitorName };
      setAnalysisInfo(newAnalysisInfo);

      const competitorLabel = data.competitorName || 'Competitor';
      const newConfig: ChartConfig = {
        'Competitor Price': { label: competitorLabel, color: 'hsl(var(--muted))' },
      };
      const chartColors = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];
      data.selectedServices.forEach((serviceName, index) => {
        newConfig[serviceName] = { label: serviceName, color: chartColors[index % chartColors.length] };
      });
      setChartConfig(newConfig);

      const newChartData = results.map((legResult, index) => {
        const dataPoint: ChartDataPoint = {
          name: `Leg ${index + 1}`,
          'Competitor Price': legResult.originalLeg.price,
        };
        legResult.analyses.forEach(analysis => {
          if (data.selectedServices.includes(analysis.serviceName)) {
            dataPoint[analysis.serviceName] = analysis.tgePrice;
          }
        });
        return dataPoint;
      });
      setChartData(newChartData);
      
      toast({ title: "Comparison Complete", description: "Analysis finished for all legs. Generating AI insights..." });

      const analysisForAI: AnalysisInput = {
          analysisJSON: JSON.stringify(results.map(legResult => ({
            origin: `${legResult.originalLeg.originLocation?.suburb}, ${legResult.originalLeg.originLocation?.state}`,
            destination: `${legResult.originalLeg.destinationLocation?.suburb}, ${legResult.originalLeg.destinationLocation?.state}`,
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
    const headers = ["Origin", "Destination", "Weight", "Competitor Price", "TGE Price", "Variance"];
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
        `"${originalLeg.originQuery.replace(/"/g, '""')}"`,
        `"${originalLeg.destinationQuery.replace(/"/g, '""')}"`,
        originalLeg.weight,
        originalLeg.price,
        tgePrice ?? 'N/A',
        variance !== null ? variance.toFixed(2) : 'N/A'
      ];
      csvContent += row.join(',') + '\r\n';
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    const fileName = `Competitor_Analysis_${form.getValues('companyName') || 'Export'}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.setAttribute("download", fileName);
    link.setAttribute("href", encodedUri);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Export Started" });
  };

  const handleLoadHistory = (data: CompetitorComparisonFormValues) => {
    const dataToLoad = { ...data, selectedServices: [] };
    form.reset(dataToLoad);
    toast({ title: "History Loaded", description: `Loaded comparison for ${data.companyName || 'previous entry'}.` });
  };

  const handleClearForm = () => {
    form.reset({
      companyName: '',
      competitorName: '',
      date: new Date(),
      legs: [{ id: '1', originQuery: '', originLocation: null, destinationQuery: '', destinationLocation: null, weight: 0, price: 0 }],
      selectedServices: [],
    });
    setAnalysisInfo(null);
    setChartData([]);
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

  const handleSuburbSelectionChange = (
    legIndex: number, 
    locationType: 'origin' | 'destination', 
    selectedSuburbJson: string
  ) => {
    const newLocation = JSON.parse(selectedSuburbJson) as PostcodeData;
    form.setValue(`legs.${legIndex}.${locationType}Location`, newLocation, { shouldValidate: true });
    form.setValue(`legs.${legIndex}.${locationType}Query`, `${newLocation.suburb} ${newLocation.postcode}`, { shouldValidate: true });
  
    setAnalysisInfo(prev => {
        if (!prev) return null;
        const newResults = [...prev.results];
        const legToUpdate = newResults[legIndex];
        if (legToUpdate) {
            const updatedLeg = { ...legToUpdate.originalLeg };
            if (locationType === 'origin') {
                updatedLeg.originLocation = newLocation;
                updatedLeg.originQuery = `${newLocation.suburb} ${newLocation.postcode}`;
            } else {
                updatedLeg.destinationLocation = newLocation;
                updatedLeg.destinationQuery = `${newLocation.suburb} ${newLocation.postcode}`;
            }
            recalculateSingleLeg(updatedLeg).then(newAnalyses => {
                setAnalysisInfo(current => {
                    if (!current) return null;
                    const finalResults = [...current.results];
                    finalResults[legIndex] = { ...finalResults[legIndex], originalLeg: updatedLeg, analyses: newAnalyses };
                    return { ...current, results: finalResults };
                });
            });
        }
        return prev;
    });
  };
  
  const recalculateSingleLeg = async (leg: CompetitorLeg): Promise<ServiceAnalysisResult[]> => {
      const servicesToCheck = form.getValues('selectedServices');
      const serviceAnalysisPromises = servicesToCheck.map(async (serviceName) => {
          const isSpendBandDependent = !serviceName.startsWith('LCP');
          const spendBandsToCheck = isSpendBandDependent ? globalSpendBands : ["N/A"];
          const pricesBySpendBand: { spendBand: string; price: number | null; calculationFormula?: string; lookupKeyUsed?: string }[] = [];
  
          for (const sb of spendBandsToCheck) {
              const freightFormValuesForCalc: FreightFormValues = {
                  spendBand: sb, originLocation: leg.originLocation, destinationLocation: leg.destinationLocation, originQuery: leg.originQuery, destinationQuery: leg.destinationQuery,
                  items: [{ weight: leg.weight, quantity: 1, length: 0, width: 0, height: 0 }],
                  globalNoCubic: true, globalOnPallet: PALLET_SERVICES.includes(serviceName as ServiceName),
                  selectedServices: [serviceName], additionalPercentageType: 'none', applyGST: false,
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
          const closest = validPrices.reduce((prev, curr) => (Math.abs(curr.price! - leg.price) < Math.abs(prev.price! - leg.price) ? curr : prev));
          const discountNeeded = ((closest.price! - leg.price) / closest.price!) * 100;
          return { serviceName, status: 'not_competitive' as const, closestSpendBand: closest.spendBand, tgePrice: closest.price, discountNeeded, calculationFormula: closest.calculationFormula, lookupKeyUsed: closest.lookupKeyUsed };
      });
  
      return await Promise.all(serviceAnalysisPromises) as ServiceAnalysisResult[];
  };

  const servicesForDisplay = useMemo(() => {
    return showLcpRates ? ALL_SERVICES : ALL_SERVICES.filter(s => !s.startsWith('LCP'));
  }, [showLcpRates]);

  const overallLoading = isLoading || isLoadingRates || isLoadingPostcodes;

  if (role && !['admin', 'superadmin', 'rsm', 'bdm'].includes(role)) {
    return (
        <Card>
            <CardHeader><CardTitle className="flex items-center"><Lock className="mr-2 h-5 w-5"/>Access Denied</CardTitle></CardHeader>
        </Card>
    );
  }

  return (
    <div className="space-y-8 print-expand">
      <Card className="shadow-xl print-hide">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <Scale className="mr-2 h-7 w-7 text-primary" /> Competitor Rate Comparison
          </CardTitle>
          <CardDescription>
            Enter competitor freight legs to see which TGE spend band is most competitive.
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
                        <Button type="button" variant="outline" size="sm" onClick={() => setIsConverterOpen(true)} className="flex-1 sm:flex-initial">
                            <MapIcon className="mr-2 h-4 w-4" /> Suburb to PC
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
                        <Label>Origin</Label>
                        <LocationAutocomplete
                          inputId={`legs.${index}.origin`}
                          value={form.watch(`legs.${index}.originQuery`)}
                          onValueChange={(val) => form.setValue(`legs.${index}.originQuery`, val)}
                          onLocationSelect={(loc) => form.setValue(`legs.${index}.originLocation`, loc, { shouldValidate: true })}
                          placeholder="Origin Suburb/Postcode"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Destination</Label>
                        <LocationAutocomplete
                          inputId={`legs.${index}.destination`}
                          value={form.watch(`legs.${index}.destinationQuery`)}
                          onValueChange={(val) => form.setValue(`legs.${index}.destinationQuery`, val)}
                          onLocationSelect={(loc) => form.setValue(`legs.${index}.destinationLocation`, loc, { shouldValidate: true })}
                          placeholder="Destination Suburb/Postcode"
                        />
                      </div>
                       <div className="space-y-1">
                            <Label>Charge Kg</Label>
                            <Input type="number" {...form.register(`legs.${index}.weight`, { valueAsNumber: true })} />
                        </div>
                         <div className="space-y-1">
                            <Label>Price ($)</Label>
                            <Input type="number" step="0.01" {...form.register(`legs.${index}.price`, { valueAsNumber: true })} />
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
                     Leg {index + 1}: {result.originalLeg.originLocation?.suburb} <ArrowRight className="inline mx-1 h-4 w-4" /> {result.originalLeg.destinationLocation?.suburb}
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
            )})}
          </CardContent>
        </Card>
      )}
      <SuburbPostcodeConverter isOpen={isConverterOpen} onOpenChange={setIsConverterOpen} allPostcodes={allPostcodes} />
    </div>
  );
}

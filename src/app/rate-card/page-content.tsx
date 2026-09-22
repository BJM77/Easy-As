

"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { RateCardGeneratorFormValues, PostcodeData, ServiceName, RateCardDisplayEntry, ProposalDetails, B2CRateEntry, RegionalLookupEntry, TieredPalletRateEntry, RateFileType, B2BRdexEntry, B2BPriorityRateEntry, LCPRdexRateEntry, LCPPrioRateEntry, PEZonesEntry, WestEastRateEntry } from '@/lib/types';
import { getAllowedServices, PALLET_SERVICES, STANDARD_ROAD_MAPPED_SERVICES, PRIORITY_MAPPED_SERVICES, PALLET_LIKE_SERVICES, LCP_SERVICES } from '@/lib/types';
import { rateCardGeneratorFormSchema } from '@/lib/zodSchemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSettings } from '@/context/SettingsContext';
import { CalendarIcon, Download, User, MapPin, DollarSign, Loader2, FileText, PlusCircle, Trash2, TableIcon, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import LocationAutocomplete from '@/components/freight/LocationAutocomplete';
import { useRateOverrides } from '@/context/RateOverrideContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from '@/firebase';

const formatValue = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined || value === 'N/A' || String(value).trim() === '') return '';
  if (typeof value === 'number') {
    return value.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });
  }
  return String(value);
};


export default function RateCardPageContent() {
  const { globalSpendBands, servicePermissions, showLcpRates, setShowLcpRates } = useSettings();
  const { getRateFile, isLoading: isLoadingRates, pezoneData } = useRateOverrides();
  const { role } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedRates, setGeneratedRates] = useState<RateCardDisplayEntry[]>([]);
  const [palletRateCardData, setPalletRateCardData] = useState<RateCardDisplayEntry[]>([]);
  const [nonPalletRateCardData, setNonPalletRateCardData] = useState<RateCardDisplayEntry[]>([]);
  const [allPostcodes, setAllPostcodes] = useState<PostcodeData[]>([]);
  const [postcodesLoading, setPostcodesLoading] = useState(true);
  const { toast } = useToast();
  
  const [currentLocationInput, setCurrentLocationInput] = useState<PostcodeData | null>(null);
  const [currentLocationQuery, setCurrentLocationQuery] = useState('');
  const [lcpPassword, setLcpPassword] = useState('');
  
  const [quickLocations, setQuickLocations] = useState<Record<string, PostcodeData | null>>({
    Syd: null, Mel: null, BNE: null, ADL: null, Per: null, RockWA: null, ManWA: null, Ktha: null,
  });


  const allowedServicesForRole = useMemo(() => getAllowedServices(role, servicePermissions), [role, servicePermissions]);
  
  const allowedRateCardServices = useMemo(() => {
    const services: ServiceName[] = ['B2B Std', 'B2B Priority', 'B2C Std', 'B2C Priority', 'WA PE Special', 'B2B Pallets Express', 'B2B Pallets General Tiered'];
    if (showLcpRates) {
      services.push('LCP Std', 'LCP Priority');
    }
    return [...new Set(services.filter(s => allowedServicesForRole.includes(s)))];
  }, [allowedServicesForRole, showLcpRates]);

  const form = useForm<RateCardGeneratorFormValues>({
    resolver: zodResolver(rateCardGeneratorFormSchema),
    defaultValues: { customerName: '', sendingLocations: [], date: new Date(), spendBand: globalSpendBands[0] || "1", services: [] },
  });
  
  useEffect(() => {
    const currentSelectedServices = form.getValues('services') || [];
    const validCurrentSelection = currentSelectedServices.filter(s => allowedRateCardServices.includes(s as ServiceName));
    if (validCurrentSelection.length !== currentSelectedServices.length) {
        form.setValue('services', validCurrentSelection, { shouldValidate: true });
    }
  }, [allowedRateCardServices, form]);

  const { fields: sendingLocationFields, append: appendSendingLocation, remove: removeSendingLocation } = useFieldArray({
    control: form.control, name: "sendingLocations",
  });

  useEffect(() => {
    const fetchPostcodes = async () => {
      setPostcodesLoading(true);
      try {
        const response = await fetch('/api/postcodes');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data: PostcodeData[] = await response.json();
        setAllPostcodes(data);
        const sydney = data.find(p => p.suburb === "SYDNEY" && p.postcode === 2000) || null;
        const melbourne = data.find(p => p.suburb === "MELBOURNE" && p.postcode === 3000) || null;
        const brisbane = data.find(p => p.suburb === "BRISBANE" && p.postcode === 4000) || null;
        const adelaide = data.find(p => p.suburb === "ADELAIDE" && p.postcode === 5000) || null;
        const perth = data.find(p => p.suburb === "PERTH" && p.postcode === 6000) || null;
        const rockingham = data.find(p => p.suburb === "ROCKINGHAM" && p.postcode === 6168) || null;
        const mandurah = data.find(p => p.suburb === "MANDURAH" && p.postcode === 6210) || null;
        const karratha = data.find(p => p.suburb === "KARRATHA" && p.postcode === 6714) || null;
        setQuickLocations({ Syd: sydney, Mel: melbourne, BNE: brisbane, ADL: adelaide, Per: perth, RockWA: rockingham, ManWA: mandurah, Ktha: karratha });
      } catch (error) {
        console.error("Failed to fetch postcodes for rate card:", error);
        toast({ title: "Postcode Data Error", description: "Could not load postcode data.", variant: "destructive" });
      } finally {
        setPostcodesLoading(false);
      }
    };
    fetchPostcodes();
  }, [toast]);
  
  const handleLcpUnlock = () => {
    if (lcpPassword === 'LCPTGE') {
      setShowLcpRates(true);
      toast({ title: "LCP Rates Unlocked", description: "LCP services are now available for selection." });
    } else {
      toast({ title: "Incorrect Password", variant: "destructive" });
    }
  };
  
  const handleQuickLocationToggle = (locationName: string, checked: boolean) => {
    const locationData = quickLocations[locationName as keyof typeof quickLocations];
    if (!locationData) return;
    const locationIndex = sendingLocationFields.findIndex(field => field.postcode === locationData.postcode && field.suburb === locationData.suburb);
    if (checked && locationIndex === -1) appendSendingLocation(locationData);
    else if (!checked && locationIndex !== -1) removeSendingLocation(locationIndex);
  };

  const handleAddSendingLocation = () => {
    if (currentLocationInput) {
      const alreadyAdded = sendingLocationFields.some(loc => loc.postcode === currentLocationInput.postcode && loc.suburb === currentLocationInput.suburb);
      if (alreadyAdded) { toast({ title: "Location Already Added", description: `${currentLocationInput.suburb} ${currentLocationInput.postcode} is already in the list.`, variant: "default" }); return; }
      appendSendingLocation(currentLocationInput);
      setCurrentLocationInput(null);
      setCurrentLocationQuery('');
      form.setValue('currentSendingLocation', null);
      form.setValue('currentSendingLocationQuery', '');
    } else {
      toast({ title: "No Location Selected", description: "Please select a valid location to add.", variant: "destructive"});
    }
  };
  
  const handleGenerateRates = async (data: RateCardGeneratorFormValues) => {
      setIsGenerating(true);
      setGeneratedRates([]);
      setPalletRateCardData([]);
      setNonPalletRateCardData([]);
      await new Promise(res => setTimeout(res, 50));
  
      const { services, spendBand, sendingLocations } = data;
      const newGeneratedRates: RateCardDisplayEntry[] = [];
  
      const allRateDataArgs = { 
          b2cRatesData: getRateFile('b2c') as B2CRateEntry[] | undefined, 
          regionalLookupData: getRateFile('regionallookup') as RegionalLookupEntry[] | undefined, 
          lcprdexData: getRateFile('lcprdex') as LCPRdexRateEntry[] | undefined, 
          lcpprioData: getRateFile('lcpprio') as LCPPrioRateEntry[] | undefined, 
          b2brdexData: getRateFile('b2brdex') as B2BRdexEntry[] | undefined, 
          b2bPriorityData: getRateFile('b2b_priority') as B2BPriorityRateEntry[] | undefined,
          pezoneData: pezoneData as PEZonesEntry[] | undefined, 
          palletSpendBandData: getRateFile(`pe${spendBand}` as RateFileType) as TieredPalletRateEntry[] | undefined, 
          westEastData: getRateFile('west_east') as WestEastRateEntry[] | undefined,
      };
  
      const getPeZone = (location: PostcodeData, pezoneDataList: PEZonesEntry[] | undefined): string | undefined => {
          if (!pezoneDataList || !location?.suburb || !location?.state) return undefined;
          const searchKey = `${location.suburb.toUpperCase()} ${location.state.toUpperCase()}`;
          const peEntry = pezoneDataList.find(p => p["PE Suburb"]?.toUpperCase() === searchKey);
          return peEntry ? peEntry["PE Zone"] : undefined;
      };
      
      const naToBlank = (val: any) => (val === 'N/A' || val === null || val === undefined) ? '' : String(val);
  
      const allIpecZones = [...new Set(allPostcodes.map(p => p.ipec).filter(Boolean))];
      const allPrioZones = [...new Set(allPostcodes.map(p => p.prio).filter(Boolean))];
      const allPeZones = allRateDataArgs.pezoneData ? [...new Set(allRateDataArgs.pezoneData.map(p => p["PE Zone"]).filter(Boolean))] : [];
  
      const processLeg = (origin: PostcodeData, destination: PostcodeData, serviceName: ServiceName) => {
          let rateEntry: any;
          let entry: Partial<RateCardDisplayEntry> = {};

          if (STANDARD_ROAD_MAPPED_SERVICES.includes(serviceName as any) && !PALLET_LIKE_SERVICES.includes(serviceName)) {
              const logicKey = serviceName === 'LCP Std' ? `LCPRDEX${origin.ipec}${destination.ipec}` : `Parcel${origin.ipec}${destination.ipec}`;
              const rateData = serviceName === 'LCP Std' ? allRateDataArgs.lcprdexData : allRateDataArgs.b2brdexData;
              rateEntry = rateData?.find(r => r.Logic === logicKey);
              if (rateEntry) {
                entry = { basicRate: naToBlank(rateEntry[`B${spendBand}`] || rateEntry.LCPRDEXBasic), kiloRate: naToBlank(rateEntry[`K${spendBand}`] || rateEntry.LCPRDEXKg), minRate: naToBlank(rateEntry[`M${spendBand}`] || 'N/A') };
              }
          } else if (PRIORITY_MAPPED_SERVICES.includes(serviceName as any) && !PALLET_LIKE_SERVICES.includes(serviceName) && !serviceName.startsWith('B2C')) {
              const logicKey = serviceName === 'LCP Priority' ? `LCPPrio${origin.prio}${destination.prio}` : `02 02${origin.prio}${destination.prio}`;
              const rateData = serviceName === 'LCP Priority' ? allRateDataArgs.lcpprioData : allRateDataArgs.b2bPriorityData;
              rateEntry = rateData?.find(r => r.Logic === logicKey);
              if (rateEntry) {
                  entry = { basicRate: naToBlank(rateEntry[`B${spendBand}`] || rateEntry.LCPPrioBasic), kiloRate: naToBlank(rateEntry[`K${spendBand}`] || rateEntry.LCPPrioKg), minRate: '' };
              }
          } else if (serviceName.startsWith('B2C') && allRateDataArgs.regionalLookupData && allRateDataArgs.b2cRatesData) {
              const regionalEntry = allRateDataArgs.regionalLookupData.find(r => r.LUP === `${origin.prio}${destination.prio}`);
              if (regionalEntry) {
                  rateEntry = allRateDataArgs.b2cRatesData.find(r => r.Logic === `${spendBand}${regionalEntry.Journey}`);
                  if (rateEntry) {
                      const prefix = serviceName === 'B2C Std' ? 'b2c' : 'b2cp';
                      const suffix = serviceName === 'B2C Std' ? 'kg' : 'pkg';
                      entry = { basicRate: naToBlank(rateEntry[`${prefix}1`]), kiloRate: naToBlank(rateEntry[`${prefix}3`]), minRate: naToBlank(rateEntry[`${prefix}5`]), additionalRate: naToBlank(rateEntry[suffix]) };
                  }
              }
          } else if (PALLET_LIKE_SERVICES.includes(serviceName)) {
              if (serviceName === 'WA PE Special' && allRateDataArgs.westEastData) {
                  const destIsMajorCity = { 'SYD': 'SYDNEY', 'MEL': 'MELBOURNE', 'BNE': 'BRISBANE', 'ADL': 'ADELAIDE' }[destination.prio];
                  if (origin.prio === 'PER' && destIsMajorCity) {
                      rateEntry = allRateDataArgs.westEastData.find(r => r.To?.toUpperCase() === destIsMajorCity);
                      if (rateEntry) {
                          const kiloRate = naToBlank(rateEntry['0-99999KGS']);
                          entry = { basicRate: naToBlank(rateEntry.Basic), minRate: naToBlank(rateEntry.Minimum), kiloRate: '', tier_0_250: kiloRate, tier_251_750: kiloRate, tier_751_1500: kiloRate, tier_1501_3000: kiloRate, tier_3001_5000: kiloRate, tier_5001_plus: kiloRate };
                      }
                  }
              } else if (allRateDataArgs.palletSpendBandData && allRateDataArgs.pezoneData) {
                  const originPeZone = getPeZone(origin, allRateDataArgs.pezoneData);
                  const destPeZone = getPeZone(destination, allRateDataArgs.pezoneData);
                  if (originPeZone && destPeZone) {
                      rateEntry = allRateDataArgs.palletSpendBandData.find(r => r.From?.toLowerCase() === originPeZone.toLowerCase() && r.To?.toLowerCase() === destPeZone.toLowerCase());
                      if (rateEntry) {
                          const prefix = serviceName === 'B2B Pallets Express' ? 'E' : 'G';
                          const minField = prefix === 'E' ? 'Eminimum' : 'GMinimum';
                          entry = {
                              basicRate: naToBlank(rateEntry[`${prefix}Basic`]), minRate: naToBlank(rateEntry[minField]), kiloRate: '',
                              tier_0_250: naToBlank(rateEntry[`${prefix}0 - 250`]), tier_251_750: naToBlank(rateEntry[`${prefix}251 - 750`]),
                              tier_751_1500: naToBlank(rateEntry[`${prefix}751 - 1500`]), tier_1501_3000: naToBlank(rateEntry[`${prefix}1501 - 3000`]),
                              tier_3001_5000: naToBlank(rateEntry[`${prefix}3001 - 5000`]), tier_5001_plus: naToBlank(rateEntry[`${prefix}5001 - 99999`])
                          };
                      }
                  }
              }
          }
          
          if (Object.keys(entry).length > 0) {
              const zoneType = PALLET_LIKE_SERVICES.includes(serviceName) ? 'PE' : (STANDARD_ROAD_MAPPED_SERVICES.includes(serviceName as any) ? 'IPEC' : 'PRIO');
              const originZone = PALLET_LIKE_SERVICES.includes(serviceName) ? getPeZone(origin, allRateDataArgs.pezoneData) || 'N/A' : origin[zoneType.toLowerCase() as keyof PostcodeData];

              newGeneratedRates.push({
                  serviceName, spendBand,
                  sendingPostcodeFull: originZone,
                  originZone: originZone,
                  destinationZone: PALLET_LIKE_SERVICES.includes(serviceName) ? getPeZone(destination, allRateDataArgs.pezoneData) || 'N/A' : destination[zoneType.toLowerCase() as keyof PostcodeData],
                  zoneTypeDisplay: zoneType,
                  cubicFactor: PALLET_LIKE_SERVICES.includes(serviceName) ? 333 : 250,
                  ...entry
              });
          }
      };
      
      const zoneTypes: ('ipec' | 'prio' | 'pe')[] = ['ipec', 'prio', 'pe'];
      const uniqueZones: Record<'ipec' | 'prio' | 'pe', string[]> = {
          ipec: allIpecZones,
          prio: allPrioZones,
          pe: allPeZones
      };

      for (const sendingLocation of sendingLocations) {
          for (const service of services) {
              const zoneKey = PALLET_LIKE_SERVICES.includes(service as any) ? 'pe' : (STANDARD_ROAD_MAPPED_SERVICES.includes(service as any) ? 'ipec' : 'prio');
              const targetZones = uniqueZones[zoneKey];
              
              for (const zoneCode of targetZones) {
                  const sampleDest = allPostcodes.find(p => p[zoneKey as keyof PostcodeData] === zoneCode);
                  if (sampleDest) {
                      processLeg(sendingLocation, sampleDest, service as ServiceName); // Outbound
                      processLeg(sampleDest, sendingLocation, service as ServiceName); // Inbound (Reciprocal)
                  }
              }
          }
      }
      
      // Remove duplicates that might occur from the to/from logic
      const uniqueResults = Array.from(new Map(newGeneratedRates.map(item => [`${item.serviceName}-${item.originZone}-${item.destinationZone}`, item])).values());

      setGeneratedRates(uniqueResults);
      setPalletRateCardData(uniqueResults.filter(r => PALLET_LIKE_SERVICES.includes(r.serviceName as ServiceName)));
      setNonPalletRateCardData(uniqueResults.filter(r => !PALLET_LIKE_SERVICES.includes(r.serviceName as ServiceName)));
  
      setIsGenerating(false);
      if (uniqueResults.length === 0) {
          toast({title: "No Rates Generated", description: "Could not find matching rates for the selected criteria.", variant: "default"});
      } else {
          toast({title: "Rate Card Generated", description: `Successfully generated ${uniqueResults.length} rate entries.`});
      }
  };

  const handleExportCSV = () => {
    if (generatedRates.length === 0) { toast({ title: "No Data to Export", description: "Please generate rates first.", variant: "destructive" }); return; }
    
    const { customerName, date: effectiveDate } = form.getValues();
    const formattedDate = format(effectiveDate, 'yyyy-MM-dd');
    
    const headers = [
        "Product", "Service", "From", "To", "Cube Factor", "Price Basis", 
        "Reciprocal", "Kilos/Units Included", "Min Charge", "Basic", 
        "Kilo Rate Thereafter", "Unit Rate", "Range From", "Range To"
    ];
    
    let csvContent = headers.join(',') + '\r\n';

    const serviceNameMapping: Partial<Record<ServiceName, string>> = {
        'B2B Std': 'Road Express',
        'LCP Std': 'Road Express',
        'B2B Priority': 'Priority',
        'LCP Priority': 'Priority',
        'B2C Std': 'B2C Standard',
        'B2C Priority': 'B2C Priority',
        'WA PE Special': 'Pallet Service',
        'B2B Pallets Express': 'Pallet Express',
        'B2B Pallets General Tiered': 'Pallet General',
        'LCP GO Std': 'LCP GO Standard',
        'LCP GO Priority': 'LCP GO Priority',
    };

    generatedRates.forEach(rate => {
        const row = [
            "Parcel", // Product
            serviceNameMapping[rate.serviceName] || rate.serviceName, // Service
            rate.originZone, // From
            rate.destinationZone, // To
            rate.cubicFactor, // Cube Factor
            "KG Quote", // Price Basis
            "N", // Reciprocal
            0, // Kilos/Units Included
            rate.minRate, // Min Charge
            rate.basicRate, // Basic
            rate.kiloRate, // Kilo Rate Thereafter
            '', // Unit Rate
            0, // Range From
            99999, // Range To
        ].join(',');
        csvContent += row + '\r\n';
    });

    try {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const sanitizedCustomerName = customerName.replace(/[\s\/\\:*?"<>|]+/g, '_') || "RateCard";
        const primarySpendBandForFilename = form.getValues('spendBand');
        const filename = `${sanitizedCustomerName}_RateCard_${formattedDate}_SB${primarySpendBandForFilename}.csv`;
        link.setAttribute('href', URL.createObjectURL(blob));
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        toast({ title: "Download Started", description: "Your rate card CSV is downloading.", variant: "default" });
    } catch (error) {
        console.error("Error generating CSV:", error);
        toast({ title: "Export Error", description: "Could not generate CSV.", variant: "destructive" });
    }
  };

  const overallLoading = isGenerating || postcodesLoading || isLoadingRates;

  return (
    <div className="space-y-8">
       <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <FileText className="mr-2 h-7 w-7 text-primary" /> Enhanced Rate Card Generator
          </CardTitle>
          <CardDescription>Generate reciprocal rate cards for multiple sending locations and services.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle className="text-xl">Rate Card Criteria</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(handleGenerateRates)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="customerName" className="flex items-center"><User className="mr-2 h-4 w-4 text-muted-foreground" />Customer Name</Label>
                  <Input id="customerName" {...form.register('customerName')} placeholder="Customer Name" />
                  {form.formState.errors.customerName && <p className="text-sm text-destructive">{form.formState.errors.customerName.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="spendBandRateCard" className="flex items-center"><DollarSign className="mr-2 h-4 w-4 text-muted-foreground" />Spend Band</Label>
                  <Controller name="spendBand" control={form.control} render={({ field }) => (<Select onValueChange={field.onChange} value={field.value}><SelectTrigger id="spendBandRateCard"><SelectValue placeholder="Select Spend Band" /></SelectTrigger><SelectContent>{globalSpendBands.map(band => <SelectItem key={band} value={band}>Spend Band {band}</SelectItem>)}</SelectContent></Select>)} />
                  {form.formState.errors.spendBand && <p className="text-sm text-destructive">{form.formState.errors.spendBand.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date" className="flex items-center"><CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />Effective Date</Label>
                  <Controller name="date" control={form.control} render={({ field }) => (<Popover><PopoverTrigger asChild><Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover>)} />
                  {form.formState.errors.date && <p className="text-sm text-destructive">{form.formState.errors.date.message}</p>}
                </div>
              </div>
              <div className="space-y-3 p-0 md:p-4 md:border md:rounded-md md:h-full">
                  <Label className="font-semibold text-md">Sending Locations</Label>
                   <div className="space-y-2">
                        <Label className="text-xs">Quick Select</Label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 p-2 border rounded-md bg-background">
                            {Object.entries(quickLocations).map(([name, locData]) => (
                                <div key={name} className="flex items-center space-x-2">
                                    <Checkbox id={`quick-loc-${name}`} disabled={!locData} checked={locData ? sendingLocationFields.some(f => f.postcode === locData.postcode && f.suburb === locData.suburb) : false} onCheckedChange={(checked) => handleQuickLocationToggle(name, Boolean(checked))} />
                                    <Label htmlFor={`quick-loc-${name}`} className="font-normal text-sm">{name}</Label>
                                </div>
                            ))}
                        </div>
                   </div>
                  <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                      <div className="flex-grow space-y-1">
                          <Label htmlFor="currentSendingLocationQueryRateCard" className="text-xs">Add Location Manually</Label>
                          <LocationAutocomplete inputId="currentSendingLocationQueryRateCard" value={currentLocationQuery} onValueChange={setCurrentLocationQuery} onLocationSelect={setCurrentLocationInput} placeholder="Type to search suburb or postcode" allPostcodes={allPostcodes} showRecentSuggestions={false} />
                      </div>
                      <Button type="button" onClick={handleAddSendingLocation} variant="outline" size="sm" disabled={!currentLocationInput || postcodesLoading} className="w-full sm:w-auto"><PlusCircle className="mr-2 h-4 w-4" /> Add</Button>
                  </div>
                  {form.formState.errors.sendingLocations && <p className="text-sm text-destructive">{form.formState.errors.sendingLocations.message as string}</p>}
                  {sendingLocationFields.length > 0 && (<div className="mt-2 space-y-1 max-h-32 overflow-y-auto border rounded-md p-2">{sendingLocationFields.map((field, index) => (<div key={field.id} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm"><span>{field.suburb}, {field.state} {field.postcode}</span><Button type="button" variant="ghost" size="sm" onClick={() => removeSendingLocation(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>))}</div>)}
              </div>
            </div>
            
             {!showLcpRates && (
              <Card className="mt-6 bg-muted/30">
                <CardHeader>
                  <CardTitle className="text-md flex items-center"><Lock className="mr-2 h-4 w-4" />LCP Rates Locked</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col sm:flex-row items-end gap-2">
                    <div className="space-y-1 flex-grow">
                      <Label htmlFor="lcp-password">Enter Password to Unlock LCP Services</Label>
                      <Input id="lcp-password" type="password" value={lcpPassword} onChange={(e) => setLcpPassword(e.target.value)} />
                    </div>
                    <Button type="button" onClick={handleLcpUnlock}>Unlock</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-3 mt-6">
              <Label className="font-semibold text-md">Services Required</Label>
              {allowedRateCardServices.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4 border rounded-md max-h-60 overflow-y-auto">
                  {allowedRateCardServices.map((service) => (<div key={`ratecard-service-${service}`} className="flex items-center space-x-2"><Checkbox id={`service-ratecard-${service}`} checked={(form.watch('services') || []).includes(service as ServiceName)} onCheckedChange={checked => { const currentServices = form.getValues('services') || []; const newServices = checked ? [...currentServices, service as ServiceName] : currentServices.filter((s) => s !== service); form.setValue('services', newServices, { shouldValidate: true }); }} /><Label htmlFor={`service-ratecard-${service}`} className="text-sm font-normal cursor-pointer">{service}</Label></div>))}
                </div>
              ) : (<p className="text-sm text-muted-foreground p-4 border rounded-md bg-background">No services of this type available for your current user role.</p>)}
              {form.formState.errors.services && <p className="text-sm text-destructive">{form.formState.errors.services.message}</p>}
            </div>
            <div className="flex flex-wrap gap-2 mt-6">
              <Button type="submit" className="flex-grow md:flex-grow-0 bg-primary hover:bg-primary/90 text-primary-foreground" disabled={overallLoading || allowedRateCardServices.length === 0}>
                {overallLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</> : (allowedRateCardServices.length === 0 ? 'No Services Available' : <><TableIcon className="mr-2 h-4 w-4" /> Generate Rate Card</>)}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {generatedRates.length > 0 && (
        <Card className="mt-8">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-xl">Generated Rate Card Preview</CardTitle>
                <div className="flex space-x-2">
                    <Button onClick={handleExportCSV} variant="outline" size="sm" disabled={isGenerating}><Download className="mr-2 h-4 w-4" /> Export to CSV</Button>
                </div>
            </CardHeader>
            <CardContent className="text-xs space-y-6">
              {nonPalletRateCardData.length > 0 && (
                <div>
                  <h3 className="font-semibold text-base mb-2">Parcel & Satchel Rates</h3>
                  <div className="max-h-[600px] overflow-auto">
                      <Table>
                          <TableHeader>
                              <TableRow>
                                  <TableHead>Service</TableHead>
                                  <TableHead>Sending Loc.</TableHead>
                                  <TableHead>Dest. Zone</TableHead>
                                  <TableHead>Zone Type</TableHead>
                                  <TableHead className="text-right">Basic / 1kg</TableHead>
                                  <TableHead className="text-right">Kilo / 3kg</TableHead>
                                  <TableHead className="text-right">Min / 5kg</TableHead>
                                  <TableHead className="text-right">Per Kg Rate (&gt;5kg)</TableHead>
                                  <TableHead className="text-right">Cubic</TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {nonPalletRateCardData.map((rate, index) => (
                                  <TableRow key={`nonpallet-${index}`}>
                                      <TableCell>{rate.serviceName}</TableCell>
                                      <TableCell>{rate.sendingPostcodeFull}</TableCell>
                                      <TableCell>{rate.destinationZone}</TableCell>
                                      <TableCell>{rate.zoneTypeDisplay}</TableCell>
                                      <TableCell className="text-right">{formatValue(rate.basicRate)}</TableCell>
                                      <TableCell className="text-right">{formatValue(rate.kiloRate)}</TableCell>
                                      <TableCell className="text-right">{formatValue(rate.minRate)}</TableCell>
                                      <TableCell className="text-right">{formatValue(rate.additionalRate)}</TableCell>
                                      <TableCell className="text-right">{rate.cubicFactor}</TableCell>
                                  </TableRow>
                              ))}
                          </TableBody>
                      </Table>
                  </div>
                </div>
              )}
               {palletRateCardData.length > 0 && (
                <div>
                  <h3 className="font-semibold text-base mb-2">Pallet Rates</h3>
                  <div className="max-h-[600px] overflow-auto">
                      <Table>
                           <TableHeader>
                              <TableRow>
                                  <TableHead>Service</TableHead>
                                  <TableHead>Sending Loc.</TableHead>
                                  <TableHead>Dest. Zone</TableHead>
                                  <TableHead>Zone Type</TableHead>
                                  <TableHead className="text-right">Basic</TableHead>
                                  <TableHead className="text-right">Min</TableHead>
                                  <TableHead className="text-right">0-250</TableHead>
                                  <TableHead className="text-right">251-750</TableHead>
                                  <TableHead className="text-right">751-1500</TableHead>
                                  <TableHead className="text-right">1501-3000</TableHead>
                                  <TableHead className="text-right">3001-5000</TableHead>
                                  <TableHead className="text-right">5001+</TableHead>
                                  <TableHead className="text-right">Cubic</TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {palletRateCardData.map((rate, index) => (
                                  <TableRow key={`pallet-${index}`}>
                                      <TableCell>{rate.serviceName}</TableCell>
                                      <TableCell>{rate.sendingPostcodeFull}</TableCell>
                                      <TableCell>{rate.destinationZone}</TableCell>
                                      <TableCell>{rate.zoneTypeDisplay}</TableCell>
                                      <TableCell className="text-right">{formatValue(rate.basicRate)}</TableCell>
                                      <TableCell className="text-right">{formatValue(rate.minRate)}</TableCell>
                                      <TableCell className="text-right">{formatValue(rate.tier_0_250)}</TableCell>
                                      <TableCell className="text-right">{formatValue(rate.tier_251_750)}</TableCell>
                                      <TableCell className="text-right">{formatValue(rate.tier_751_1500)}</TableCell>
                                      <TableCell className="text-right">{formatValue(rate.tier_1501_3000)}</TableCell>
                                      <TableCell className="text-right">{formatValue(rate.tier_3001_5000)}</TableCell>
                                      <TableCell className="text-right">{formatValue(rate.tier_5001_plus)}</TableCell>
                                      <TableCell className="text-right">{rate.cubicFactor}</TableCell>
                                  </TableRow>
                              ))}
                          </TableBody>
                      </Table>
                  </div>
                </div>
              )}
            </CardContent>
        </Card>
      )}
    </div>
  );
}

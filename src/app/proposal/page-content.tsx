
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/firebase';
import { Mail, Printer, Send, Package as PackageIcon, Building, Phone, User as UserIcon, Calendar as CalendarIcon, ArrowRight, ArrowLeft, FileSignature, Sparkles, PlusCircle, Trash2, Loader2, TableIcon, Edit, RefreshCcw, Download, Palette, View, Edit2, DollarSign, History, Save } from 'lucide-react';
import { proposalDetailsSchema, rateCardGeneratorFormSchema } from '@/lib/zodSchemas';
import type { ProposalDetails, ProposalSectionId, PendingProposalState, RateCardDisplayEntry, PostcodeData, ServiceName, B2CRateEntry, RegionalLookupEntry, TieredPalletRateEntry, RateFileType, B2BRdexEntry, B2BPriorityRateEntry, LCPRdexRateEntry, LCPPrioRateEntry, PEZonesEntry, WestEastRateEntry } from '@/lib/types';
import { format } from 'date-fns';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { generateExecutiveSummary, refinePointsToParagraph } from '@/ai/flows/proposal-assist-flow';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSettings } from '@/context/SettingsContext';
import { useRateOverrides } from '@/context/RateOverrideContext';
import { getAllowedServices, PALLET_LIKE_SERVICES, STANDARD_ROAD_MAPPED_SERVICES, PRIORITY_MAPPED_SERVICES } from '@/lib/types';
import LocationAutocomplete from '@/components/freight/LocationAutocomplete';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RateCardGeneratorFormValues } from '@/lib/types';
import placeholders from '@/app/lib/placeholder-images.json';


const proposalSectionsConfig: { id: ProposalSectionId; title: string; description: string; placeholder: string; hasAi?: boolean; hasDynamicFields?: boolean }[] = [
  { id: 'execSummary', title: 'Executive Summary', description: "Enter key points or a rough draft below. Use the AI Assistant to generate a polished, market-leading summary.", placeholder: "e.g., Reduce costs for SYD-MEL lane by 15%, improve delivery reliability for critical parts, provide tracking visibility...", hasAi: true },
  { id: 'yourNeeds', title: 'Understanding Your Needs', description: "List the key challenges, goals, and requirements you discussed with the customer. Use the 'Add Need' button for more fields, then use the AI assistant to synthesize them into a paragraph.", placeholder: "e.g., Reliable on-time delivery for critical freight lanes.", hasAi: true, hasDynamicFields: true },
  { id: 'overviewSolution', title: 'Our Proposed Solution', description: "Describe your recommended solution at a high level. Which primary and secondary services are you proposing and why?", placeholder: "e.g., We propose a multi-faceted solution leveraging our B2B Priority service for time-sensitive deliveries, complemented by our cost-effective B2B Standard service for less urgent stock movements..." },
  { id: 'solutionDetail', title: 'Solution Detail (Evidence)', description: "Provide the specific evidence. Reference the attached rate card and highlight a few key examples of how your rates provide value on lanes that are important to the customer.", placeholder: "e.g., The specific details of our competitive rate structure are attached. For example, on the critical SYD-MEL lane, our proposed rate of $XX.XX represents a significant improvement..." },
  { id: 'investment', title: 'Solution Rates', description: "Explain any details about the rates below. You can mention payment terms and your commitment to transparent invoicing.", placeholder: "e.g., The investment for this solution is detailed in the pricing schedule below. All rates are exclusive of GST. We offer flexible 30-day payment terms..." },
  { id: 'benefits', title: 'Key Benefits', description: "List the tangible benefits the customer will receive. Use the AI assistant to combine them into a powerful paragraph.", placeholder: "e.g., Increased reliability and on-time performance.", hasAi: true, hasDynamicFields: true },
  { id: 'nextSteps', title: 'Next Steps', description: "Clearly define the path forward. What do you need the customer to do, and what will you do next?", placeholder: "e.g., The next steps are as follows:\n1. Review this proposal with your team.\n2. Schedule a follow-up call.\n3. Finalize the service agreement." },
  { id: 'authorityToProceed', title: 'Authority to Proceed', description: "The final call to action for the customer to sign.", placeholder: "" },
];

const formatCurrency = (amount: number | null | string | undefined) => {
    if (amount === null || amount === undefined || amount === 'N/A' || (typeof amount === 'string' && isNaN(parseFloat(amount))) || String(amount).trim() === '') return "N/A";
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return numAmount.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });
};


export default function ProposalEditorPageContent() {
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [viewMode, setViewMode] = useState<'form' | 'preview'>('form');
  const [isAiLoading, setIsAiLoading] = useState<Partial<Record<ProposalSectionId, boolean>>>({});
  const [rateCard, setRateCard] = useState<RateCardDisplayEntry[]>([]);
  const [palletRateCardData, setPalletRateCardData] = useState<RateCardDisplayEntry[]>([]);
  const [nonPalletRateCardData, setNonPalletRateCardData] = useState<RateCardDisplayEntry[]>([]);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const { globalSpendBands, servicePermissions } = useSettings();
  const { getRateFile, isLoading: isLoadingRates, pezoneData } = useRateOverrides();
  const { role } = useAuth();
  const [allPostcodes, setAllPostcodes] = useState<PostcodeData[]>([]);
  const [postcodesLoading, setPostcodesLoading] = useState(true);

  const [currentLocationInput, setCurrentLocationInput] = useState<PostcodeData | null>(null);
  const [currentLocationQuery, setCurrentLocationQuery] = useState('');
  const [quickLocations, setQuickLocations] = useState<Record<string, PostcodeData | null>>({
    Syd: null, Mel: null, BNE: null, ADL: null, Per: null, RockWA: null, ManWA: null, Ktha: null,
  });
  
  const [proposalHistory, setProposalHistory] = useState<ProposalDetails[]>([]);

  const [accentColor, setAccentColor] = useState('#163302'); 

  const allowedServicesForRole = useMemo(() => getAllowedServices(role, servicePermissions), [role, servicePermissions]);
  const allowedRateCardServices = useMemo(() => {
    const services: ServiceName[] = ['B2B Std', 'B2B Priority', 'LCP Std', 'LCP Priority', 'B2C Std', 'B2C Priority', 'WA PE Special', 'B2B Pallets Express', 'B2B Pallets General Tiered'];
    return [...new Set(services.filter(s => allowedServicesForRole.includes(s)))];
  }, [allowedServicesForRole]);

  const proposalForm = useForm<ProposalDetails>({
    resolver: zodResolver(proposalDetailsSchema),
    defaultValues: {
      proposalDate: new Date(), customerCompanyName: '', customerContactName: '',
      salesProfessionalName: '', salesProfessionalEmail: '', salesProfessionalPhone: '',
      sections: {
        execSummary: '', yourNeeds: '', overviewSolution: '', solutionDetail: '', investment: '', benefits: '', nextSteps: '', authorityToProceed: ''
      },
      dynamicFields: {
        yourNeeds: [''],
        benefits: ['']
      }
    }
  });

  const rateCardForm = useForm<RateCardGeneratorFormValues>({
    resolver: zodResolver(rateCardGeneratorFormSchema),
    defaultValues: { sendingLocations: [], services: [], spendBand: globalSpendBands[0] || "1", date: new Date(), customerName: '' }
  });

  const { fields: needsFields, append: appendNeed, remove: removeNeed } = useFieldArray({ control: proposalForm.control, name: "dynamicFields.yourNeeds" });
  const { fields: benefitsFields, append: appendBenefit, remove: removeBenefit } = useFieldArray({ control: proposalForm.control, name: "dynamicFields.benefits" });
  const { fields: sendingLocationFields, append: appendSendingLocation, remove: removeSendingLocation } = useFieldArray({ control: rateCardForm.control, name: "sendingLocations"});
  
  const watchedDetails = proposalForm.watch();
  
  const handlePrint = () => {
    const content = document.getElementById("proposal-document");
    if (!content) return;
  
    const printWindow = window.open("", "", "width=900,height=650");
    if (!printWindow) return;
  
    const styles = Array.from(document.styleSheets)
      .map(styleSheet => {
        try {
          return Array.from(styleSheet.cssRules)
            .map(rule => rule.cssText)
            .join('');
        } catch (e) {
          console.log('Access to stylesheet %s is denied. Ignoring.', styleSheet.href);
          return '';
        }
      })
      .join('');
  
    printWindow.document.write(`
      <html>
        <head>
          <title>Proposal</title>
          <style>${styles}</style>
          <style>
            @media print {
              body { 
                -webkit-print-color-adjust: exact; 
                print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          ${content.outerHTML}
        </body>
      </html>
    `);
  
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 250);
  };
  
  const saveToHistory = useCallback((data: ProposalDetails) => {
    try {
      if (typeof window !== 'undefined') {
        setProposalHistory(prevHistory => {
          const newHistory = [data, ...prevHistory.filter(p => p.customerCompanyName !== data.customerCompanyName)];
          const limitedHistory = newHistory.slice(0, 3);
          localStorage.setItem('proposalHistory', JSON.stringify(limitedHistory));
          return limitedHistory;
        });
      }
    } catch (e) {
      console.error("Failed to save proposal history", e);
    }
  }, []);
  
  const handleSaveProposal = () => {
      const currentData = proposalForm.getValues();
      saveToHistory(currentData);
      toast({
        title: 'Proposal Saved',
        description: `Proposal for ${currentData.customerCompanyName} has been saved to your recent history.`,
      });
  };

  const loadProposal = (data: ProposalDetails) => {
    proposalForm.reset({
      ...data,
      proposalDate: new Date(data.proposalDate),
    });
    toast({ title: "Proposal Loaded", description: `Loaded proposal for ${data.customerCompanyName}.` });
  };

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const storedHistory = localStorage.getItem('proposalHistory');
        if (storedHistory) {
          setProposalHistory(JSON.parse(storedHistory));
        }
      }
    } catch (e) {
      console.error('Failed to load proposal history:', e);
      if (typeof window !== 'undefined') localStorage.removeItem('proposalHistory');
    }

    const storedData = sessionStorage.getItem('pendingProposal');
    if (storedData) {
      try {
        const parsedData: PendingProposalState = JSON.parse(storedData);
        
        const detailsToSet: Partial<ProposalDetails> = {
          proposalDate: new Date(),
          customerCompanyName: parsedData.proposalDetails?.customerCompanyName || '',
          customerContactName: parsedData.proposalDetails?.customerContactName || '',
          salesProfessionalName: parsedData.proposalDetails?.salesProfessionalName || '',
          salesProfessionalEmail: parsedData.proposalDetails?.salesProfessionalEmail || '',
          salesProfessionalPhone: parsedData.proposalDetails?.salesProfessionalPhone || '',
          sections: {
              execSummary: parsedData.proposalDetails?.sections?.execSummary || '',
              yourNeeds: parsedData.proposalDetails?.sections?.yourNeeds || '',
              overviewSolution: parsedData.proposalDetails?.sections?.overviewSolution || '',
              solutionDetail: parsedData.proposalDetails?.sections?.solutionDetail || '',
              investment: parsedData.proposalDetails?.sections?.investment || '',
              benefits: parsedData.proposalDetails?.sections?.benefits || '',
              nextSteps: parsedData.proposalDetails?.sections?.nextSteps || '',
              authorityToProceed: parsedData.proposalDetails?.sections?.authorityToProceed || '',
          },
          dynamicFields: {
              yourNeeds: parsedData.proposalDetails?.dynamicFields?.yourNeeds?.length ? parsedData.proposalDetails.dynamicFields.yourNeeds : [''],
              benefits: parsedData.proposalDetails?.dynamicFields?.benefits?.length ? parsedData.proposalDetails.dynamicFields.benefits : [''],
          }
        };
        
        proposalForm.reset(detailsToSet);

        if (parsedData.rateCardEntries) {
          setRateCard(parsedData.rateCardEntries);
          setPalletRateCardData(parsedData.rateCardEntries.filter(r => PALLET_LIKE_SERVICES.includes(r.serviceName as ServiceName)));
          setNonPalletRateCardData(parsedData.rateCardEntries.filter(r => !PALLET_LIKE_SERVICES.includes(r.serviceName as ServiceName)));
        }
        
      } catch (error) {
        console.error("Failed to parse pending proposal data", error);
      } finally {
        sessionStorage.removeItem('pendingProposal');
      }
    }
    
    const fetchPostcodes = async () => {
        setPostcodesLoading(true);
        try {
            const response = await fetch('/api/postcodes');
            if (!response.ok) throw new Error('Failed to fetch postcodes');
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
            console.error("Error fetching postcodes for Proposal page:", error);
            toast({ title: "Error", description: "Could not load postcode data.", variant: "destructive" });
        } finally {
            setPostcodesLoading(false);
        }
    };
    fetchPostcodes();

  }, [proposalForm, toast]);


  const handleStart = () => {
    proposalForm.reset({
      proposalDate: new Date(), customerCompanyName: '', customerContactName: '',
      salesProfessionalName: '', salesProfessionalEmail: '', salesProfessionalPhone: '',
      sections: { execSummary: '', yourNeeds: '', overviewSolution: '', solutionDetail: '', investment: '', benefits: '', nextSteps: '', authorityToProceed: '' },
      dynamicFields: { yourNeeds: [''], benefits: [''] }
    });
    rateCardForm.reset({ sendingLocations: [], services: [], spendBand: globalSpendBands[0] || "1", date: new Date(), customerName: '' });
    setRateCard([]);
  };

  const handleAiAction = async (sectionId: ProposalSectionId) => {
    setIsAiLoading(prev => ({...prev, [sectionId]: true}));
    try {
        if (sectionId === 'execSummary') {
            const notes = proposalForm.getValues('sections.execSummary');
            if(!notes || notes.trim().length < 10) {
              toast({title: "Input Required", description: "Please provide some key points in the text area first.", variant: "default"});
              return;
            }
            const { summary } = await generateExecutiveSummary({ customerName: proposalForm.getValues('customerCompanyName'), userNotes: notes });
            proposalForm.setValue('sections.execSummary', summary, { shouldDirty: true });
        } else if (sectionId === 'yourNeeds' || sectionId === 'benefits') {
            const points = (proposalForm.getValues(`dynamicFields.${sectionId}`) || []).filter(p => p && p.trim() !== '');
            if(points.length === 0) {
                toast({title: "Input Required", description: "Please add at least one need or benefit point.", variant: "default"});
                return;
            }
            const { paragraph } = await refinePointsToParagraph({ points, topic: sectionId === 'yourNeeds' ? 'customer needs' : 'solution benefits' });
            proposalForm.setValue(`sections.${sectionId}`, paragraph, { shouldDirty: true });
        }
        toast({title: "AI Assistant", description: "Content has been updated."});
    } catch (e) {
        console.error("AI Action Error", e);
        toast({title: "Error", description: "Could not generate AI content.", variant: "destructive"});
    } finally {
        setIsAiLoading(prev => ({...prev, [sectionId]: false}));
    }
  };

  const handleAddSendingLocation = () => {
    if (currentLocationInput) {
      const alreadyAdded = sendingLocationFields.some(loc => loc.postcode === currentLocationInput.postcode && loc.suburb === currentLocationInput.suburb);
      if (alreadyAdded) { toast({ title: "Location Already Added", variant: "default" }); return; }
      appendSendingLocation(currentLocationInput);
      setCurrentLocationInput(null);
      setCurrentLocationQuery('');
    } else {
      toast({ title: "No Location Selected", variant: "destructive"});
    }
  };
  
  const handleQuickLocationToggle = (locationName: string, checked: boolean) => {
    const locationData = quickLocations[locationName as keyof typeof quickLocations];
    if (!locationData) return;
    const locationIndex = sendingLocationFields.findIndex(field => field.postcode === locationData.postcode && field.suburb === locationData.suburb);
    if (checked && locationIndex === -1) appendSendingLocation(locationData);
    else if (!checked && locationIndex !== -1) removeSendingLocation(locationIndex);
  };
  
  const handleGenerateRates = async (data: RateCardGeneratorFormValues) => {
    setIsGenerating(true);
    setRateCard([]);
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

    const uniqueIpecZones = [...new Set(allPostcodes.map(p => p.ipec).filter(Boolean))];
    const uniquePrioZones = [...new Set(allPostcodes.map(p => p.prio).filter(Boolean))];
    const uniquePeZones = allRateDataArgs.pezoneData ? [...new Set((allRateDataArgs.pezoneData as PEZonesEntry[]).map(p => p["PE Zone"]).filter(Boolean))] : [];

    for (const sendingLocation of sendingLocations) {
        for (const service of services) {
            const processLeg = (origin: PostcodeData, destination: PostcodeData, serviceName: ServiceName) => {
              let rateEntry: any;
              let entry: Partial<RateCardDisplayEntry> = {};

              if (STANDARD_ROAD_MAPPED_SERVICES.includes(serviceName as any) && !PALLET_LIKE_SERVICES.includes(serviceName as any)) {
                  const logicKey = serviceName === 'LCP Std' ? `LCPRDEX${origin.ipec}${destination.ipec}` : `Parcel${origin.ipec}${destination.ipec}`;
                  const rateData = serviceName === 'LCP Std' ? allRateDataArgs.lcprdexData : allRateDataArgs.b2brdexData;
                  rateEntry = rateData?.find(r => r.Logic === logicKey);
                  if (rateEntry) {
                    entry = { basicRate: naToBlank(rateEntry[`B${spendBand}`] || rateEntry.LCPRDEXBasic), kiloRate: naToBlank(rateEntry[`K${spendBand}`] || rateEntry.LCPRDEXKg), minRate: naToBlank(rateEntry[`M${spendBand}`] || 'N/A') };
                  }
              } else if (PRIORITY_MAPPED_SERVICES.includes(serviceName as any) && !PALLET_LIKE_SERVICES.includes(serviceName as any) && !serviceName.startsWith('B2C')) {
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
              } else if (PALLET_LIKE_SERVICES.includes(serviceName as any)) {
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
                  const zoneType = PALLET_LIKE_SERVICES.includes(serviceName as any) ? 'PE' : (STANDARD_ROAD_MAPPED_SERVICES.includes(serviceName as any) ? 'IPEC' : 'PRIO');
                  const originZone = PALLET_LIKE_SERVICES.includes(serviceName as any) ? getPeZone(origin, allRateDataArgs.pezoneData) || 'N/A' : origin[zoneType.toLowerCase() as keyof PostcodeData];

                  newGeneratedRates.push({
                      serviceName: serviceName, spendBand,
                      sendingPostcodeFull: originZone,
                      originZone: originZone,
                      destinationZone: PALLET_LIKE_SERVICES.includes(serviceName as any) ? getPeZone(destination, allRateDataArgs.pezoneData) || 'N/A' : destination[zoneType.toLowerCase() as keyof PostcodeData],
                      zoneTypeDisplay: zoneType,
                      cubicFactor: PALLET_LIKE_SERVICES.includes(serviceName as any) ? 333 : 250,
                      ...entry
                  });
              }
          };

            const zoneKey = PALLET_LIKE_SERVICES.includes(service as any) ? 'pe' : (STANDARD_ROAD_MAPPED_SERVICES.includes(service as any) ? 'ipec' : 'prio');
            const targetZones = { ipec: uniqueIpecZones, prio: uniquePrioZones, pe: uniquePeZones }[zoneKey];
            
            for (const zoneCode of targetZones) {
                const sampleDest = allPostcodes.find(p => p[zoneKey as keyof PostcodeData] === zoneCode);
                if (sampleDest) {
                    processLeg(sendingLocation, sampleDest, service as ServiceName);
                    processLeg(sampleDest, sendingLocation, service as ServiceName);
                }
            }
        }
    }
    
    saveToHistory(proposalForm.getValues());

    const uniqueResults = Array.from(new Map(newGeneratedRates.map(item => [`${item.serviceName}-${item.originZone}-${item.destinationZone}`, item])).values());

    setRateCard(uniqueResults);
    setPalletRateCardData(uniqueResults.filter(r => PALLET_LIKE_SERVICES.includes(r.serviceName as ServiceName)));
    setNonPalletRateCardData(uniqueResults.filter(r => !PALLET_LIKE_SERVICES.includes(r.serviceName as ServiceName)));

    setIsGenerating(false);
    if (uniqueResults.length === 0) {
        toast({title: "No Rates Generated", description: "Could not find matching rates for the selected criteria.", variant: "default"});
    } else {
        toast({title: "Rate Card Generated", description: `Successfully generated ${uniqueResults.length} rate entries.`});
    }
  };

  const overallLoading = isGenerating || postcodesLoading || isLoadingRates;

  return (
    <>
    <div className="proposal-container space-y-8">
      <Card className="shadow-xl print-hide">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <FileSignature className="mr-2 h-7 w-7 text-primary" /> AI Proposal Builder
          </CardTitle>
          <CardDescription>
            Create professional, multi-section sales proposals. Data from the "Perfect Plan" tool will automatically populate here.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
            <Button onClick={() => setViewMode('form')} variant={viewMode === 'form' ? 'default' : 'outline'} size="lg">
                <Edit2 className="mr-2 h-5 w-5"/> Editor
            </Button>
             <Button onClick={() => setViewMode('preview')} variant={viewMode === 'preview' ? 'default' : 'outline'} size="lg">
                <View className="mr-2 h-5 w-5"/> Preview
            </Button>
            <div className="flex-grow"></div>
             {proposalHistory.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">Load Recent:</span>
                {proposalHistory.map((entry, index) => (
                  <Button
                    key={index}
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => loadProposal(entry)}
                  >
                    <History className="mr-2 h-4 w-4" />
                    {entry.customerCompanyName || `Proposal ${index + 1}`}
                  </Button>
                ))}
              </div>
            )}
        </CardContent>
      </Card>
      
      <div id="proposal-section-container">
        {/* -- EDITOR UI -- */}
        <div className={cn("space-y-6 print-hide", viewMode === 'preview' && 'hidden')}>
            <Card>
                <CardHeader><CardTitle>Proposal Details</CardTitle></CardHeader>
                <CardContent className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-1"><Label htmlFor="customerCompanyName">Customer Company Name</Label><Input id="customerCompanyName" {...proposalForm.register('customerCompanyName')} /></div>
                    <div className="space-y-1"><Label htmlFor="customerContactName">Customer Contact Name</Label><Input id="customerContactName" {...proposalForm.register('customerContactName')} /></div>
                    <div className="space-y-1"><Label htmlFor="salesProfessionalName">Sales Professional Name</Label><Input id="salesProfessionalName" {...proposalForm.register('salesProfessionalName')} /></div>
                    <div className="space-y-1"><Label htmlFor="salesProfessionalEmail">Sales Professional Email</Label><Input id="salesProfessionalEmail" type="email" {...proposalForm.register('salesProfessionalEmail')} /></div>
                    <div className="space-y-1"><Label htmlFor="salesProfessionalPhone">Sales Professional Phone</Label><Input id="salesProfessionalPhone" {...proposalForm.register('salesProfessionalPhone')} /></div>
                </CardContent>
            </Card>

            {proposalSectionsConfig.filter(s => s.id !== 'investment' && s.id !== 'authorityToProceed').map(section => (
                <Card key={section.id}>
                    <CardHeader>
                        <CardTitle className="text-xl">{section.title}</CardTitle>
                        <CardDescription>{section.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {section.hasDynamicFields ? (
                        <div className="space-y-2 mb-4">
                            {section.id === 'yourNeeds' && needsFields.map((field, index) => (
                            <div key={field.id} className="flex items-center gap-2">
                                <Input {...proposalForm.register(`dynamicFields.yourNeeds.${index}` as const)} placeholder={`Need #${index + 1}`} />
                                <Button type="button" variant="ghost" size="icon" onClick={() => removeNeed(index)} disabled={needsFields.length <= 1}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </div>
                            ))}
                            {section.id === 'benefits' && benefitsFields.map((field, index) => (
                            <div key={field.id} className="flex items-center gap-2">
                                <Input {...proposalForm.register(`dynamicFields.benefits.${index}` as const)} placeholder={`Benefit #${index + 1}`} />
                                <Button type="button" variant="ghost" size="icon" onClick={() => removeBenefit(index)} disabled={benefitsFields.length <= 1}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </div>
                            ))}
                            <Button type="button" variant="outline" size="sm" onClick={() => section.id === 'yourNeeds' ? appendNeed('') : appendBenefit('')}><PlusCircle className="mr-2 h-4 w-4" /> Add Point</Button>
                        </div>
                        ) : null}

                        <Textarea {...proposalForm.register(`sections.${section.id as ProposalSectionId}`)} placeholder={section.placeholder} className="h-48" />

                        {section.hasAi && (
                        <Button type="button" variant="secondary" size="sm" onClick={() => handleAiAction(section.id as ProposalSectionId)} disabled={isAiLoading[section.id as ProposalSectionId]} className="mt-2">
                            {isAiLoading[section.id as ProposalSectionId] ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4"/>}
                            AI Assistant
                        </Button>
                        )}
                    </CardContent>
                </Card>
            ))}

             <Card>
                <CardHeader>
                    <CardTitle className="text-xl">Solution Rates</CardTitle>
                    <CardDescription>Explain any details about the rates below. You can mention payment terms and your commitment to transparent invoicing.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea {...proposalForm.register('sections.investment')} placeholder="e.g., The investment for this solution is detailed in the pricing schedule below..." className="h-24 mb-6" />
                  <Separator className="my-4"/>
                  <h3 className="text-lg font-semibold mb-4">Generate &amp; Attach Rate Card</h3>
                  <form onSubmit={rateCardForm.handleSubmit(handleGenerateRates)} className="space-y-6">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                       <div className="space-y-6">
                          <div className="space-y-2">
                            <Label htmlFor="rc-spendBand" className="flex items-center"><DollarSign className="mr-2 h-4 w-4 text-muted-foreground" />Spend Band</Label>
                            <Controller name="spendBand" control={rateCardForm.control} render={({ field }) => (<Select onValueChange={field.onChange} value={field.value}><SelectTrigger id="rc-spendBand"><SelectValue/></SelectTrigger><SelectContent>{globalSpendBands.map(b => <SelectItem key={b} value={b}>Spend Band {b}</SelectItem>)}</SelectContent></Select>)} />
                          </div>
                          <div className="space-y-2">
                              <Label htmlFor="date" className="flex items-center"><CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />Effective Date</Label>
                              <Controller name="date" control={rateCardForm.control} render={({ field }) => (<Popover><PopoverTrigger asChild><Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover>)} />
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
                            {rateCardForm.formState.errors.sendingLocations && <p className="text-sm text-destructive">{rateCardForm.formState.errors.sendingLocations.message as string}</p>}
                            {sendingLocationFields.length > 0 && (<div className="mt-2 space-y-1 max-h-32 overflow-y-auto border rounded-md p-2">{sendingLocationFields.map((field, index) => (<div key={field.id} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm"><span>{field.suburb}, {field.state} {field.postcode}</span><Button type="button" variant="ghost" size="sm" onClick={() => removeSendingLocation(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>))}</div>)}
                        </div>
                     </div>
                     <div className="space-y-2">
                        <Label>Services Required</Label>
                         <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4 border rounded-md max-h-60 overflow-y-auto">
                            {allowedRateCardServices.map(service => (<div key={`rc-service-${service}`} className="flex items-center space-x-2"><Checkbox id={`rc-service-${service}`} checked={(rateCardForm.watch('services') || []).includes(service as ServiceName)} onCheckedChange={checked => { const current = rateCardForm.getValues('services') || []; const newServices = checked ? [...current, service as ServiceName] : current.filter(s => s !== service); rateCardForm.setValue('services', newServices, {shouldValidate: true});}} /><Label htmlFor={`rc-service-${service}`} className="font-normal">{service}</Label></div>))}
                         </div>
                          {rateCardForm.formState.errors.services && <p className="text-sm text-destructive">{rateCardForm.formState.errors.services.message}</p>}
                     </div>
                     <div className="flex gap-2">
                        <Button type="submit" disabled={overallLoading || allowedRateCardServices.length === 0}>
                            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCcw className="mr-2 h-4 w-4" />}
                            {allowedRateCardServices.length === 0 ? 'No Rate Card Services Available' : 'Generate Rates'}
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => setViewMode('preview')}>
                            <View className="mr-2 h-4 w-4" /> Preview Proposal
                        </Button>
                         <Button type="button" variant="outline" onClick={handleSaveProposal}>
                            <Save className="mr-2 h-4 w-4" /> Save Proposal
                        </Button>
                     </div>
                  </form>
                </CardContent>
             </Card>
             
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl flex items-center"><Palette className="mr-2 h-6 w-6"/>Appearance</CardTitle>
                    <CardDescription>Customize the appearance of the printed proposal.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2 max-w-xs">
                        <Label htmlFor="accent-color">Header &amp; Line Color</Label>
                        <Input id="accent-color" type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)} />
                    </div>
                </CardContent>
            </Card>
        </div>
        
        {/* -- PROPOSAL PREVIEW -- */}
        <div className={cn("proposal-preview-container", viewMode === 'form' && 'hidden')}>
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 print-hide">
                <h2 className="text-2xl font-bold text-foreground">Proposal Preview</h2>
                <Button variant="outline" onClick={handlePrint}><Printer className="mr-2 h-4 w-4" /> Print / Save as PDF</Button>
            </div>
            <Card className="w-full shadow-lg card-print" id="proposal-document" style={{'--proposal-accent-color': accentColor} as React.CSSProperties}>
                <CardContent className="p-8 sm:p-12">
                    <header className="mb-12">
                        <div className="flex justify-between items-start">
                            <div>
                                <h1 className="text-3xl font-bold text-[var(--proposal-accent-color)]">Executive Freight Summary - {watchedDetails.customerCompanyName}</h1>
                                <p className="text-muted-foreground">Created for {watchedDetails.customerContactName} by {watchedDetails.salesProfessionalName}</p>
                            </div>
                            <div className="relative h-20 w-40">
                                <Image 
                                  src={placeholders.company_logo.url} 
                                  alt={placeholders.company_logo.alt} 
                                  width={placeholders.company_logo.width} 
                                  height={placeholders.company_logo.height} 
                                  className="object-contain" 
                                  data-ai-hint={placeholders.company_logo.hint}
                                />
                            </div>
                        </div>
                    </header>
                    <Separator className="my-8" />
                    <div className="space-y-8 proposal-sections">
                        
                        {['execSummary', 'yourNeeds', 'overviewSolution', 'solutionDetail'].map(id => {
                            const section = proposalSectionsConfig.find(s => s.id === id);
                            const content = watchedDetails.sections?.[id as ProposalSectionId];
                            if (!section || !content) return null;
                            return (
                              <div key={section.id} className="proposal-section">
                                <h2 className="text-xl font-semibold border-b-2 border-[var(--proposal-accent-color)] pb-2 mb-4">{section.title}</h2>
                                <div className="text-base leading-relaxed whitespace-pre-wrap">{content || ''}</div>
                              </div>
                            );
                        })}
                        
                        <div className="proposal-section break-before-page">
                            <h2 className="text-xl font-semibold border-b-2 border-[var(--proposal-accent-color)] pb-2 mb-4">Solution Rates</h2>
                            {watchedDetails.sections?.investment && (
                                <div className="text-base leading-relaxed whitespace-pre-wrap mb-6">{watchedDetails.sections.investment}</div>
                            )}
                            {isGenerating ? (
                                <div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin mr-2"/>Generating rate card...</div>
                            ) : rateCard.length > 0 ? (
                                <div className="print-expand space-y-6">
                                   {nonPalletRateCardData.length > 0 && (
                                        <div className="mb-6">
                                            <h3 className="font-semibold mb-2">Parcel &amp; Satchel Rates</h3>
                                             <Table>
                                                <TableHeader><TableRow><TableHead>Service</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead className="text-right">Basic/1kg</TableHead><TableHead className="text-right">Kilo/3kg</TableHead><TableHead className="text-right">Min/5kg</TableHead><TableHead className="text-right">Add. Rate</TableHead></TableRow></TableHeader>
                                                <TableBody>{nonPalletRateCardData.map((rate, i) => (<TableRow key={`non-pallet-prev-${i}`}><TableCell>{rate.serviceName}</TableCell><TableCell>{rate.originZone}</TableCell><TableCell>{rate.destinationZone}</TableCell><TableCell className="text-right">{formatCurrency(rate.basicRate)}</TableCell><TableCell className="text-right">{formatCurrency(rate.kiloRate)}</TableCell><TableCell className="text-right">{formatCurrency(rate.minRate)}</TableCell><TableCell className="text-right">{formatCurrency(rate.additionalRate)}</TableCell></TableRow>))}</TableBody>
                                            </Table>
                                        </div>
                                   )}
                                   {palletRateCardData.length > 0 && (
                                        <div>
                                            <h3 className="font-semibold mb-2">Pallet Rates</h3>
                                             <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="p-1 text-left text-[9px] font-bold">From</TableHead>
                                                        <TableHead className="p-1 text-left text-[9px] font-bold">To</TableHead>
                                                        <TableHead className="p-1 text-right text-[9px] font-bold">Basic</TableHead>
                                                        <TableHead className="p-1 text-right text-[9px] font-bold">Minimum</TableHead>
                                                        <TableHead className="p-1 text-right text-[6px] font-bold">0-250</TableHead>
                                                        <TableHead className="p-1 text-right text-[6px] font-bold">251-750</TableHead>
                                                        <TableHead className="p-1 text-right text-[6px] font-bold">751-1500</TableHead>
                                                        <TableHead className="p-1 text-right text-[6px] font-bold">1501-3000</TableHead>
                                                        <TableHead className="p-1 text-right text-[6px] font-bold">3001-5000</TableHead>
                                                        <TableHead className="p-1 text-right text-[6px] font-bold">5001+</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>{palletRateCardData.map((rate, i) => (<TableRow key={`pallet-prev-${i}`}><TableCell className="p-1 text-left text-xs">{rate.originZone}</TableCell><TableCell className="p-1 text-left text-xs">{rate.destinationZone}</TableCell><TableCell className="p-1 text-right text-xs">{formatCurrency(rate.basicRate)}</TableCell><TableCell className="p-1 text-right text-xs">{formatCurrency(rate.minRate)}</TableCell><TableCell className="p-1 text-right text-xs">{formatCurrency(rate.tier_0_250)}</TableCell><TableCell className="p-1 text-right text-xs">{formatCurrency(rate.tier_251_750)}</TableCell><TableCell className="p-1 text-right text-xs">{formatCurrency(rate.tier_751_1500)}</TableCell><TableCell className="p-1 text-right text-xs">{formatCurrency(rate.tier_1501_3000)}</TableCell><TableCell className="p-1 text-right text-xs">{formatCurrency(rate.tier_3001_5000)}</TableCell><TableCell className="p-1 text-right text-xs">{formatCurrency(rate.tier_5001_plus)}</TableCell></TableRow>))}</TableBody>
                                            </Table>
                                        </div>
                                   )}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground py-4">Generate a rate card to have it appear here in the proposal.</p>
                            )}
                        </div>
                        
                        {['benefits', 'nextSteps', 'authorityToProceed'].map(id => {
                            const section = proposalSectionsConfig.find(s => s.id === id);
                            if (!section) return null;
                            const content = watchedDetails.sections?.[id as ProposalSectionId];
                            
                            if (id === 'authorityToProceed') {
                                return (
                                    <div key={section.id} className="proposal-section break-before-page">
                                        <h2 className="text-xl font-semibold border-b-2 border-[var(--proposal-accent-color)] pb-2 mb-4">{section.title}</h2>
                                        <p className="text-sm text-muted-foreground mb-6">By signing below, {watchedDetails.customerCompanyName} authorizes Team Global Express to proceed with the scope and costs described in this proposal.</p>
                                        <div className="grid grid-cols-2 gap-x-12 gap-y-10 mt-16">
                                            <div className="border-t pt-2"><p className="font-semibold">{watchedDetails.customerContactName}</p><p className="text-sm text-muted-foreground">Signature</p></div>
                                             <div className="border-t pt-2"><p className="font-semibold">&nbsp;</p><p className="text-sm text-muted-foreground">Date</p></div>
                                        </div>
                                    </div>
                                  )
                            }

                            if (!content) return null;
                            return (
                              <div key={section.id} className="proposal-section">
                                <h2 className="text-xl font-semibold border-b-2 border-[var(--proposal-accent-color)] pb-2 mb-4">{section.title}</h2>
                                <div className="text-base leading-relaxed whitespace-pre-wrap">{content || ''}</div>
                              </div>
                            )
                        })}
                    </div>
                    <footer className="mt-12 pt-6 border-t text-center text-xs text-muted-foreground"><p>© {new Date().getFullYear()} BD Assist. All rights reserved. This proposal is confidential and intended solely for the recipient.</p></footer>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
    </>
  );
}

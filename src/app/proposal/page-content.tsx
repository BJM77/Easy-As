
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/firebase';
import { Mail, Printer, Send, Building, Phone, User as UserIcon, Calendar as CalendarIcon, ArrowRight, FileSignature, Sparkles, PlusCircle, Trash2, Loader2, Edit, RefreshCcw, Palette, View, Edit2, DollarSign, History, Save, CheckCircle2, AlertCircle, Check, Copy, Wand2, ShieldCheck, TrendingUp, Zap, HelpCircle, Layers, Eye } from 'lucide-react';
import { proposalDetailsSchema, rateCardGeneratorFormSchema } from '@/lib/zodSchemas';
import type { ProposalDetails, ProposalSectionId, PendingProposalState, RateCardDisplayEntry, PostcodeData, ServiceName, B2CRateEntry, RegionalLookupEntry, TieredPalletRateEntry, RateFileType, B2BRdexEntry, B2BPriorityRateEntry, LCPRdexRateEntry, LCPPrioRateEntry, PEZonesEntry, WestEastRateEntry, RateCardGeneratorFormValues } from '@/lib/types';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import placeholders from '@/app/lib/placeholder-images.json';

const proposalSectionsConfig: { id: ProposalSectionId; title: string; description: string; placeholder: string; hasAi?: boolean; hasDynamicFields?: boolean }[] = [
  { id: 'execSummary', title: 'Executive Summary', description: "Enter key points or a rough draft below. Use AI Assistant or template chips to generate a market-leading summary.", placeholder: "e.g., Reduce freight spend for key interstate lanes by 15%, improve delivery reliability, provide end-to-end tracking...", hasAi: true },
  { id: 'yourNeeds', title: 'Understanding Your Needs', description: "List the key challenges, goals, and requirements discussed with the customer. Synthesize into a compelling paragraph.", placeholder: "e.g., Reliable on-time delivery for critical freight lanes.", hasAi: true, hasDynamicFields: true },
  { id: 'overviewSolution', title: 'Our Proposed Solution', description: "Describe your recommended solution at a high level. Which primary and secondary services are you proposing and why?", placeholder: "e.g., We propose a multi-faceted solution leveraging B2B Priority for time-sensitive deliveries, complemented by B2B Standard..." },
  { id: 'solutionDetail', title: 'Solution Detail (Evidence)', description: "Provide specific evidence. Reference the attached rate card and highlight key examples of value.", placeholder: "e.g., The specific details of our competitive rate structure are attached below..." },
  { id: 'investment', title: 'Solution Rates Overview', description: "Explain details about the rate structure, payment terms, and transparent invoicing commitment.", placeholder: "e.g., The investment for this solution is detailed in the pricing schedule below. All rates are exclusive of GST. Flexible 30-day terms..." },
  { id: 'benefits', title: 'Key Value Benefits', description: "List tangible customer benefits. Use AI assistant to combine them into a powerful paragraph.", placeholder: "e.g., Increased reliability and on-time performance.", hasAi: true, hasDynamicFields: true },
  { id: 'nextSteps', title: 'Next Steps & Onboarding', description: "Clearly define the path forward for agreement and account setup.", placeholder: "e.g., 1. Review and sign the Authority to Proceed.\n2. Schedule technical dispatch setup.\n3. First shipment dispatch with dedicated support." },
  { id: 'authorityToProceed', title: 'Authority to Proceed', description: "Final authorization block for customer sign-off.", placeholder: "" },
];

const THEMES = [
  { id: 'tge-corporate', name: 'TGE Corporate', primary: '#163302', accent: '#D97706', bg: 'bg-[#163302]' },
  { id: 'navy-gold', name: 'Ocean Navy', primary: '#0F172A', accent: '#38BDF8', bg: 'bg-[#0F172A]' },
  { id: 'slate-cyan', name: 'Modern Slate', primary: '#334155', accent: '#06B6D4', bg: 'bg-[#334155]' },
  { id: 'wine-burgundy', name: 'Executive Wine', primary: '#881337', accent: '#F59E0B', bg: 'bg-[#881337]' }
];

const SECTION_TEMPLATES: Record<string, { label: string; text: string }[]> = {
  execSummary: [
    { label: 'Cost Reduction Focus', text: 'By partnering with Team Global Express, {customer} will optimize multi-modal freight spend across key interstate lanes, achieving an estimated 15% reduction in annual freight expenditure while increasing transit transparency.' },
    { label: 'Reliability Focus', text: 'Our 98.5% DIFOT (Delivered In-Full On-Time) performance and dedicated air freighter network ensure {customer} maintains uncompromised service levels for critical deliveries across Australia.' },
    { label: 'Growth Enablement', text: 'As {customer} expands its national distribution footprint, TGE\'s multi-modal infrastructure provides flexible, scalable dispatch capacity backed by dedicated account management.' }
  ],
  overviewSolution: [
    { label: 'Multi-Modal Strategy', text: 'We propose an integrated multi-modal strategy incorporating B2B Priority for urgent customer dispatches and B2B Standard for routine stock inventory replenishment.' },
    { label: 'Express Freight Focus', text: 'Our recommended solution leverages TGE\'s Express network to deliver rapid turnaround times across capital city corridors with real-time GPS tracking.' }
  ],
  nextSteps: [
    { label: 'Standard Onboarding', text: '1. Review and execute the Authority to Proceed.\n2. Complete seamless electronic dispatch integration.\n3. Conduct team onboarding and initiate first dispatches with dedicated Support.' }
  ]
};

const formatCurrency = (amount: number | null | string | undefined) => {
    if (amount === null || amount === undefined || amount === 'N/A' || (typeof amount === 'string' && isNaN(parseFloat(amount))) || String(amount).trim() === '') return "N/A";
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return numAmount.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });
};

export default function ProposalEditorPageContent() {
  const { toast } = useToast();
  const { user, role } = useAuth();
  
  const [viewMode, setViewMode] = useState<'editor' | 'split' | 'preview'>('split');
  const [isAiLoading, setIsAiLoading] = useState<Partial<Record<ProposalSectionId, boolean>>>({});
  const [rateCard, setRateCard] = useState<RateCardDisplayEntry[]>([]);
  const [palletRateCardData, setPalletRateCardData] = useState<RateCardDisplayEntry[]>([]);
  const [nonPalletRateCardData, setNonPalletRateCardData] = useState<RateCardDisplayEntry[]>([]);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRateDialogOpen, setIsRateDialogOpen] = useState(false);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('saved');
  const [activeTheme, setActiveTheme] = useState(THEMES[0]);
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, boolean>>({});
  
  const { globalSpendBands, servicePermissions } = useSettings();
  const { getRateFile, isLoading: isLoadingRates, pezoneData } = useRateOverrides();
  const [allPostcodes, setAllPostcodes] = useState<PostcodeData[]>([]);
  const [postcodesLoading, setPostcodesLoading] = useState(true);

  const [currentLocationInput, setCurrentLocationInput] = useState<PostcodeData | null>(null);
  const [currentLocationQuery, setCurrentLocationQuery] = useState('');
  const [quickLocations, setQuickLocations] = useState<Record<string, PostcodeData | null>>({
    Syd: null, Mel: null, BNE: null, ADL: null, Per: null, RockWA: null, ManWA: null, Ktha: null,
  });
  
  const [proposalHistory, setProposalHistory] = useState<ProposalDetails[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Auto-Save Effect
  useEffect(() => {
    const subscription = proposalForm.watch((data) => {
      setSaveStatus('saving');
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        try {
          localStorage.setItem('proposal_builder_draft', JSON.stringify(data));
          setSaveStatus('saved');
        } catch (e) {
          console.error("Auto-save failed", e);
        }
      }, 1500);
    });
    return () => {
      subscription.unsubscribe();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [proposalForm]);

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
          return '';
        }
      })
      .join('');
  
    printWindow.document.write(`
      <html>
        <head>
          <title>Proposal - ${watchedDetails.customerCompanyName || 'Document'}</title>
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
          const limitedHistory = newHistory.slice(0, 5);
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
      setSaveStatus('saved');
      toast({
        title: 'Proposal Saved',
        description: `Proposal for ${currentData.customerCompanyName || 'Client'} saved to history.`,
      });
  };

  const loadProposal = (data: ProposalDetails) => {
    proposalForm.reset({
      ...data,
      proposalDate: new Date(data.proposalDate),
    });
    toast({ title: "Proposal Loaded", description: `Loaded proposal for ${data.customerCompanyName || 'Client'}.` });
  };

  // Restore Draft or Pending Proposal on Mount
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const storedHistory = localStorage.getItem('proposalHistory');
        if (storedHistory) {
          setProposalHistory(JSON.parse(storedHistory));
        }

        const draft = localStorage.getItem('proposal_builder_draft');
        if (draft) {
          const parsedDraft = JSON.parse(draft);
          if (parsedDraft && parsedDraft.customerCompanyName) {
            proposalForm.reset({
              ...parsedDraft,
              proposalDate: parsedDraft.proposalDate ? new Date(parsedDraft.proposalDate) : new Date()
            });
          }
        }
      }
    } catch (e) {
      console.error('Failed to load draft/history:', e);
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
            console.error("Error fetching postcodes:", error);
        } finally {
            setPostcodesLoading(false);
        }
    };
    fetchPostcodes();
  }, [proposalForm]);

  const handleApplyTemplate = (sectionId: string, templateText: string) => {
    const customer = watchedDetails.customerCompanyName || 'the Client';
    const replaced = templateText.replace(/{customer}/g, customer);
    proposalForm.setValue(`sections.${sectionId as ProposalSectionId}`, replaced, { shouldDirty: true });
    toast({ title: "Template Inserted", description: "Updated section text with template." });
  };

  const handleAiAction = async (sectionId: ProposalSectionId) => {
    setIsAiLoading(prev => ({...prev, [sectionId]: true}));
    try {
        if (sectionId === 'execSummary') {
            const notes = proposalForm.getValues('sections.execSummary');
            if(!notes || notes.trim().length < 10) {
              toast({title: "Input Required", description: "Please provide key points in the text area first.", variant: "default"});
              return;
            }
            const { summary } = await generateExecutiveSummary({ customerName: proposalForm.getValues('customerCompanyName') || 'Valued Client', userNotes: notes });
            proposalForm.setValue('sections.execSummary', summary, { shouldDirty: true });
        } else if (sectionId === 'yourNeeds' || sectionId === 'benefits') {
            const points = (proposalForm.getValues(`dynamicFields.${sectionId}`) || []).filter(p => p && p.trim() !== '');
            if(points.length === 0) {
                toast({title: "Input Required", description: "Please add at least one point.", variant: "default"});
                return;
            }
            const { paragraph } = await refinePointsToParagraph({ points, topic: sectionId === 'yourNeeds' ? 'customer needs' : 'solution benefits' });
            proposalForm.setValue(`sections.${sectionId}`, paragraph, { shouldDirty: true });
        }
        setAiSuggestions(prev => ({ ...prev, [sectionId]: false }));
        toast({title: "AI Refined", description: "Section updated with AI summary."});
    } catch (e) {
        toast({title: "AI Generation Failed", variant: "destructive"});
    } finally {
        setIsAiLoading(prev => ({...prev, [sectionId]: false}));
    }
  };

  const handleAddSendingLocation = () => {
    if (currentLocationInput) {
      const alreadyAdded = sendingLocationFields.some(loc => loc.postcode === currentLocationInput.postcode && loc.suburb === currentLocationInput.suburb);
      if (alreadyAdded) return toast({ title: "Location Already Added" });
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
                      ...entry,
                      serviceName: serviceName, spendBand,
                      sendingPostcodeFull: String(originZone),
                      originZone: String(originZone),
                      destinationZone: String(PALLET_LIKE_SERVICES.includes(serviceName as any) ? getPeZone(destination, allRateDataArgs.pezoneData) || 'N/A' : destination[zoneType.toLowerCase() as keyof PostcodeData]),
                      zoneTypeDisplay: zoneType,
                      basicRate: String(entry.basicRate ?? (entry as any).Basic ?? ''),
                      kiloRate: String(entry.kiloRate ?? (entry as any).Kilo ?? (entry as any).KiloRate ?? ''),
                      minRate: String(entry.minRate ?? (entry as any).Minimum ?? (entry as any).Min ?? ''),
                      cubicFactor: PALLET_LIKE_SERVICES.includes(serviceName as any) ? 333 : 250,
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
    setIsRateDialogOpen(false);
    if (uniqueResults.length === 0) {
        toast({title: "No Rates Generated", description: "Could not find matching rates.", variant: "default"});
    } else {
        toast({title: "Rate Card Attached", description: `Attached ${uniqueResults.length} rate entries to proposal.`});
    }
  };

  const getSectionQuality = (id: string) => {
    const val = watchedDetails.sections?.[id as ProposalSectionId] || '';
    if (!val || val.trim().length === 0) return { status: 'empty', label: 'Empty', color: 'text-muted-foreground bg-muted' };
    const words = val.trim().split(/\s+/).length;
    if (words < 12) return { status: 'short', label: 'Needs Detail', color: 'text-amber-700 bg-amber-100 border-amber-300' };
    return { status: 'good', label: 'Complete', color: 'text-emerald-700 bg-emerald-100 border-emerald-300' };
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* Sticky Top Header Bar */}
      <div className="sticky top-0 bg-background/95 backdrop-blur z-30 p-4 rounded-xl border shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <FileSignature className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-headline flex items-center gap-2">
              Proposal Builder
              <Badge variant="outline" className={cn("text-xs font-normal", saveStatus === 'saving' ? 'bg-amber-50 text-amber-700 animate-pulse' : 'bg-emerald-50 text-emerald-700')}>
                {saveStatus === 'saving' ? 'Saving...' : 'Saved ✓'}
              </Badge>
            </h1>
            <p className="text-xs text-muted-foreground">
              {watchedDetails.customerCompanyName ? `Proposal for ${watchedDetails.customerCompanyName}` : 'Drafting new proposal'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Responsive Layout Toggle */}
          <div className="flex bg-muted p-1 rounded-lg">
            <Button variant={viewMode === 'editor' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('editor')} className="text-xs h-8">
              <Edit2 className="mr-1.5 h-3.5 w-3.5" /> Editor Only
            </Button>
            <Button variant={viewMode === 'split' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('split')} className="hidden lg:flex text-xs h-8">
              <Layers className="mr-1.5 h-3.5 w-3.5" /> Split Live
            </Button>
            <Button variant={viewMode === 'preview' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('preview')} className="text-xs h-8">
              <View className="mr-1.5 h-3.5 w-3.5" /> Full Preview
            </Button>
          </div>

          {/* Theme Selector Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs">
                <Palette className="mr-1.5 h-3.5 w-3.5" /> Theme
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-3">
              <Label className="text-xs font-bold mb-2 block">Document Accent Theme</Label>
              <div className="space-y-1.5">
                {THEMES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTheme(t)}
                    className={cn(
                      "w-full flex items-center justify-between p-2 rounded text-xs font-medium border transition-all",
                      activeTheme.id === t.id ? "border-primary bg-primary/10" : "hover:bg-muted"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className={cn("w-3.5 h-3.5 rounded-full border shadow-sm", t.bg)} />
                      {t.name}
                    </div>
                    {activeTheme.id === t.id && <Check className="h-3.5 w-3.5 text-primary" />}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Rate Card Dialog Trigger */}
          <Dialog open={isRateDialogOpen} onOpenChange={setIsRateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs">
                <DollarSign className="mr-1.5 h-3.5 w-3.5 text-emerald-600" /> Rate Card {rateCard.length > 0 && `(${rateCard.length})`}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" /> Configure Proposal Rate Card
                </DialogTitle>
                <DialogDescription>
                  Select spend band, locations, and services to generate and attach rates to this proposal.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={rateCardForm.handleSubmit(handleGenerateRates)} className="space-y-6 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="rc-spendBand" className="flex items-center"><DollarSign className="mr-2 h-4 w-4 text-muted-foreground" />Spend Band</Label>
                      <Controller name="spendBand" control={rateCardForm.control} render={({ field }) => (<Select onValueChange={field.onChange} value={field.value}><SelectTrigger id="rc-spendBand"><SelectValue/></SelectTrigger><SelectContent>{globalSpendBands.map(b => <SelectItem key={b} value={b}>Spend Band {b}</SelectItem>)}</SelectContent></Select>)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="date" className="flex items-center"><CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />Effective Date</Label>
                      <Controller name="date" control={rateCardForm.control} render={({ field }) => (<Popover><PopoverTrigger asChild><Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover>)} />
                    </div>
                  </div>

                  <div className="space-y-3 p-4 border rounded-lg bg-muted/20">
                    <Label className="font-semibold text-sm">Sending Locations</Label>
                    <div className="space-y-2">
                      <Label className="text-xs">Quick Select</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-2 gap-y-1.5 p-2 border rounded-md bg-background text-xs">
                        {Object.entries(quickLocations).map(([name, locData]) => (
                          <div key={name} className="flex items-center space-x-1.5">
                            <Checkbox id={`rc-quick-${name}`} disabled={!locData} checked={locData ? sendingLocationFields.some(f => f.postcode === locData.postcode && f.suburb === locData.suburb) : false} onCheckedChange={(checked) => handleQuickLocationToggle(name, Boolean(checked))} />
                            <Label htmlFor={`rc-quick-${name}`} className="font-normal text-xs">{name}</Label>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-grow space-y-1">
                        <Label htmlFor="currentSendingLocationQueryRateCard" className="text-xs">Add Location</Label>
                        <LocationAutocomplete inputId="currentSendingLocationQueryRateCard" value={currentLocationQuery} onValueChange={setCurrentLocationQuery} onLocationSelect={setCurrentLocationInput} placeholder="Type suburb/postcode..." allPostcodes={allPostcodes} showRecentSuggestions={false} />
                      </div>
                      <Button type="button" onClick={handleAddSendingLocation} variant="outline" size="sm" disabled={!currentLocationInput || postcodesLoading}><PlusCircle className="mr-1 h-4 w-4" /> Add</Button>
                    </div>
                    {sendingLocationFields.length > 0 && (<div className="mt-2 space-y-1 max-h-28 overflow-y-auto border rounded p-2 text-xs">{sendingLocationFields.map((field, index) => (<div key={field.id} className="flex items-center justify-between p-1.5 bg-muted rounded"><span>{field.suburb}, {field.state} {field.postcode}</span><Button type="button" variant="ghost" size="sm" onClick={() => removeSendingLocation(index)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></div>))}</div>)}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="font-semibold text-sm">Services Required</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-3 border rounded-lg max-h-48 overflow-y-auto text-xs">
                    {allowedRateCardServices.map(service => (<div key={`rc-service-${service}`} className="flex items-center space-x-2"><Checkbox id={`rc-dialog-${service}`} checked={(rateCardForm.watch('services') || []).includes(service as ServiceName)} onCheckedChange={checked => { const current = rateCardForm.getValues('services') || []; const newServices = checked ? [...current, service as ServiceName] : current.filter(s => s !== service); rateCardForm.setValue('services', newServices, {shouldValidate: true});}} /><Label htmlFor={`rc-dialog-${service}`} className="font-normal text-xs">{service}</Label></div>))}
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setIsRateDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={isGenerating || allowedRateCardServices.length === 0}>
                    {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCcw className="mr-2 h-4 w-4" />}
                    Generate & Attach Rates
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Email Dialog Trigger */}
          <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs">
                <Mail className="mr-1.5 h-3.5 w-3.5 text-blue-600" /> Email
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-primary"/> Send Proposal via Email</DialogTitle>
                <DialogDescription>Launch default email application with prefilled proposal details.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1">
                  <Label htmlFor="emailTo">Recipient Email</Label>
                  <Input id="emailTo" defaultValue={watchedDetails.salesProfessionalEmail || ''} placeholder="client@company.com" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="emailSubject">Subject Line</Label>
                  <Input id="emailSubject" defaultValue={`Freight Partnership Proposal - ${watchedDetails.customerCompanyName || 'TGE'}`} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsEmailDialogOpen(false)}>Cancel</Button>
                <Button onClick={() => {
                  const email = (document.getElementById('emailTo') as HTMLInputElement)?.value || '';
                  const subject = (document.getElementById('emailSubject') as HTMLInputElement)?.value || '';
                  const body = `Hi ${watchedDetails.customerContactName || 'Team'},\n\nPlease find attached our freight proposal for ${watchedDetails.customerCompanyName || 'your business'}.\n\nBest regards,\n${watchedDetails.salesProfessionalName || 'Sales Representative'}`;
                  window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                  setIsEmailDialogOpen(false);
                }}>
                  <Send className="mr-2 h-4 w-4" /> Launch Mail Client
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button variant="outline" size="sm" onClick={handlePrint} className="h-8 text-xs">
            <Printer className="mr-1.5 h-3.5 w-3.5" /> Print PDF
          </Button>
          <Button size="sm" onClick={handleSaveProposal} className="h-8 text-xs">
            <Save className="mr-1.5 h-3.5 w-3.5" /> Save Draft
          </Button>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className={cn(
        "grid gap-8 items-start transition-all duration-300",
        viewMode === 'editor' && "grid-cols-1",
        viewMode === 'split' && "grid-cols-1 lg:grid-cols-2",
        viewMode === 'preview' && "grid-cols-1"
      )}>

        {/* LEFT COLUMN: FORM EDITOR */}
        <div className={cn("space-y-6 print-hide", viewMode === 'preview' && 'hidden')}>
          
          {/* Customer & Author Info */}
          <Card className="shadow-md">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Building className="h-5 w-5 text-primary" /> Customer & Sales Contact
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <Label htmlFor="customerCompanyName">Customer Company Name</Label>
                <Input id="customerCompanyName" {...proposalForm.register('customerCompanyName')} placeholder="Acme Logistics Pty Ltd" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="customerContactName">Customer Contact Name</Label>
                <Input id="customerContactName" {...proposalForm.register('customerContactName')} placeholder="Jane Smith" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="salesProfessionalName">Sales Representative</Label>
                <Input id="salesProfessionalName" {...proposalForm.register('salesProfessionalName')} placeholder="John Doe" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="salesProfessionalEmail">Sales Email</Label>
                <Input id="salesProfessionalEmail" type="email" {...proposalForm.register('salesProfessionalEmail')} placeholder="john.doe@tge.com" />
              </div>
            </CardContent>
          </Card>

          {/* Section Cards */}
          {proposalSectionsConfig.filter(s => s.id !== 'investment' && s.id !== 'authorityToProceed').map(section => {
            const quality = getSectionQuality(section.id);
            const templates = SECTION_TEMPLATES[section.id];
            const currentText = watchedDetails.sections?.[section.id as ProposalSectionId] || '';

            return (
              <Card key={section.id} className="shadow-md relative border-border/80">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-base flex items-center gap-2">
                      {section.title}
                      <Badge variant="outline" className={cn("text-[10px] font-normal px-2 py-0.5 border", quality.color)}>
                        {quality.label}
                      </Badge>
                    </CardTitle>
                    {section.hasAi && (
                      <Button type="button" variant="outline" size="sm" onClick={() => handleAiAction(section.id as ProposalSectionId)} disabled={isAiLoading[section.id as ProposalSectionId]} className="h-7 text-xs">
                        {isAiLoading[section.id as ProposalSectionId] ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin"/> : <Sparkles className="mr-1.5 h-3.5 w-3.5 text-primary"/>}
                        Polish AI
                      </Button>
                    )}
                  </div>
                  <CardDescription className="text-xs">{section.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  
                  {/* Dynamic Points for Needs / Benefits */}
                  {section.hasDynamicFields && (
                    <div className="space-y-2 mb-3">
                      {section.id === 'yourNeeds' && needsFields.map((field, index) => (
                        <div key={field.id} className="flex items-center gap-2">
                          <Input {...proposalForm.register(`dynamicFields.yourNeeds.${index}` as const)} placeholder={`Need Point #${index + 1}`} className="text-xs h-9" />
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeNeed(index)} disabled={needsFields.length <= 1} className="h-8 w-8"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      ))}
                      {section.id === 'benefits' && benefitsFields.map((field, index) => (
                        <div key={field.id} className="flex items-center gap-2">
                          <Input {...proposalForm.register(`dynamicFields.benefits.${index}` as const)} placeholder={`Benefit Point #${index + 1}`} className="text-xs h-9" />
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeBenefit(index)} disabled={benefitsFields.length <= 1} className="h-8 w-8"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      ))}
                      <Button type="button" variant="outline" size="sm" onClick={() => section.id === 'yourNeeds' ? appendNeed('') : appendBenefit('')} className="text-xs h-7"><PlusCircle className="mr-1.5 h-3.5 w-3.5" /> Add Point</Button>
                    </div>
                  )}

                  {/* Template Chips */}
                  {templates && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <span className="text-[10px] text-muted-foreground flex items-center font-medium mr-1"><Wand2 className="h-3 w-3 mr-1" /> Quick Starters:</span>
                      {templates.map((tpl, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleApplyTemplate(section.id, tpl.text)}
                          className="text-[10px] bg-secondary/60 hover:bg-secondary text-secondary-foreground px-2 py-0.5 rounded border border-border/40 transition-colors"
                        >
                          + {tpl.label}
                        </button>
                      ))}
                    </div>
                  )}

                  <Textarea 
                    {...proposalForm.register(`sections.${section.id as ProposalSectionId}`)} 
                    placeholder={section.placeholder} 
                    className="h-36 text-xs leading-relaxed" 
                    onBlur={() => {
                      if (currentText.trim().length > 10 && !aiSuggestions[section.id]) {
                        setAiSuggestions(prev => ({ ...prev, [section.id]: true }));
                      }
                    }}
                  />

                  {/* Contextual AI Suggestion Banner */}
                  {section.hasAi && aiSuggestions[section.id] && currentText.trim().length > 10 && (
                    <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg flex items-start gap-3 animate-in fade-in slide-in-from-top-1 text-xs">
                      <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <div className="flex-grow">
                        <p className="font-semibold text-foreground">Want AI to polish this draft?</p>
                        <p className="text-muted-foreground text-[11px]">Convert bullet points or rough notes into a compelling, professional executive text.</p>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <Button type="button" size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setAiSuggestions(prev => ({ ...prev, [section.id]: false }))}>Dismiss</Button>
                        <Button type="button" size="sm" className="h-7 text-[11px]" onClick={() => handleAiAction(section.id as ProposalSectionId)}>
                          <Sparkles className="mr-1 h-3 w-3" /> Polish Now
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {/* Rates Overview Section */}
          <Card className="shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-600" /> Solution Rates & Terms
              </CardTitle>
              <CardDescription className="text-xs">Explain details about payment terms and transparent invoicing commitments.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea {...proposalForm.register('sections.investment')} placeholder="e.g., Rates detailed below are exclusive of GST. Flexible 30-day payment terms..." className="h-24 text-xs" />
              
              <div className="p-4 bg-muted/30 border rounded-xl flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="font-semibold text-xs">Rate Card Status</p>
                  <p className="text-[11px] text-muted-foreground">
                    {rateCard.length > 0 ? `${rateCard.length} rate entries attached.` : 'No rate card attached to proposal.'}
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setIsRateDialogOpen(true)}>
                  <DollarSign className="mr-1.5 h-4 w-4 text-emerald-600" />
                  {rateCard.length > 0 ? 'Edit Rate Card' : 'Attach Rate Card'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: LIVE PREVIEW DOCUMENT */}
        <div className={cn(
          "sticky top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto rounded-xl shadow-2xl transition-all duration-300",
          viewMode === 'editor' && "hidden",
          viewMode === 'split' && "hidden lg:block border border-border/80"
        )}>
          <div className="bg-muted px-4 py-2 text-xs font-semibold flex justify-between items-center border-b print-hide">
            <span className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" /> Live Proposal Preview
            </span>
            <span className="text-[10px] text-muted-foreground font-normal">Real-time updates</span>
          </div>

          <Card className="w-full card-print border-0 rounded-none" id="proposal-document" style={{ '--proposal-accent-color': activeTheme.primary } as React.CSSProperties}>
            <CardContent className="p-6 sm:p-10 space-y-8 bg-card">
              
              {/* Document Header / Cover */}
              <header className="border-b-2 pb-6" style={{ borderColor: activeTheme.primary }}>
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded text-white" style={{ backgroundColor: activeTheme.primary }}>
                      Freight Partnership Proposal
                    </span>
                    <h1 className="text-2xl font-bold font-headline pt-1" style={{ color: activeTheme.primary }}>
                      {watchedDetails.customerCompanyName || 'Client Business Name'}
                    </h1>
                    <p className="text-xs text-muted-foreground">
                      Prepared for {watchedDetails.customerContactName || 'Customer Representative'} | {format(watchedDetails.proposalDate || new Date(), 'dd MMMM yyyy')}
                    </p>
                  </div>
                  <div className="relative h-16 w-36 shrink-0">
                    <Image 
                      src={placeholders.company_logo.url} 
                      alt="Company Logo" 
                      width={140} 
                      height={60} 
                      className="object-contain" 
                    />
                  </div>
                </div>
              </header>

              {/* Value Callout Banner */}
              <div className="p-4 rounded-xl border flex items-center justify-between gap-4 bg-muted/20" style={{ borderColor: `${activeTheme.primary}30` }}>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg text-white shrink-0" style={{ backgroundColor: activeTheme.primary }}>
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold text-xs" style={{ color: activeTheme.primary }}>Optimized Freight Solution</p>
                    <p className="text-[11px] text-muted-foreground">Tailored multi-modal service structure for maximum efficiency.</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs font-semibold shrink-0" style={{ color: activeTheme.primary, borderColor: activeTheme.primary }}>
                  98.5% DIFOT Target
                </Badge>
              </div>

              {/* Executive Summary */}
              {watchedDetails.sections?.execSummary && (
                <div className="space-y-2">
                  <h2 className="text-base font-bold border-b pb-1 flex items-center gap-2" style={{ color: activeTheme.primary, borderColor: `${activeTheme.primary}40` }}>
                    Executive Summary
                  </h2>
                  <p className="text-xs leading-relaxed whitespace-pre-wrap text-foreground/90">{watchedDetails.sections.execSummary}</p>
                </div>
              )}

              {/* Understanding Your Needs */}
              {watchedDetails.sections?.yourNeeds && (
                <div className="space-y-2">
                  <h2 className="text-base font-bold border-b pb-1" style={{ color: activeTheme.primary, borderColor: `${activeTheme.primary}40` }}>
                    Understanding Your Needs
                  </h2>
                  <p className="text-xs leading-relaxed whitespace-pre-wrap text-foreground/90">{watchedDetails.sections.yourNeeds}</p>
                </div>
              )}

              {/* Overview Solution & Details */}
              {(watchedDetails.sections?.overviewSolution || watchedDetails.sections?.solutionDetail) && (
                <div className="space-y-4">
                  <h2 className="text-base font-bold border-b pb-1" style={{ color: activeTheme.primary, borderColor: `${activeTheme.primary}40` }}>
                    Our Proposed Solution
                  </h2>
                  {watchedDetails.sections?.overviewSolution && (
                    <p className="text-xs leading-relaxed whitespace-pre-wrap text-foreground/90">{watchedDetails.sections.overviewSolution}</p>
                  )}
                  {watchedDetails.sections?.solutionDetail && (
                    <p className="text-xs leading-relaxed whitespace-pre-wrap text-foreground/90">{watchedDetails.sections.solutionDetail}</p>
                  )}
                </div>
              )}

              {/* Solution Rates Section & Tables */}
              <div className="space-y-4">
                <h2 className="text-base font-bold border-b pb-1" style={{ color: activeTheme.primary, borderColor: `${activeTheme.primary}40` }}>
                  Solution Rates & Schedule
                </h2>
                {watchedDetails.sections?.investment && (
                  <p className="text-xs leading-relaxed whitespace-pre-wrap text-foreground/90 mb-4">{watchedDetails.sections.investment}</p>
                )}

                {rateCard.length > 0 ? (
                  <div className="space-y-6">
                    {nonPalletRateCardData.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-xs font-bold text-foreground">Parcel & Satchel Rates</h3>
                        <div className="border rounded-lg overflow-hidden">
                          <Table className="text-xs">
                            <TableHeader className="bg-muted/50">
                              <TableRow>
                                <TableHead className="py-2 text-[10px] font-bold">Service</TableHead>
                                <TableHead className="py-2 text-[10px] font-bold">From</TableHead>
                                <TableHead className="py-2 text-[10px] font-bold">To</TableHead>
                                <TableHead className="py-2 text-right text-[10px] font-bold">Basic</TableHead>
                                <TableHead className="py-2 text-right text-[10px] font-bold">Kilo</TableHead>
                                <TableHead className="py-2 text-right text-[10px] font-bold">Min</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {nonPalletRateCardData.map((rate, i) => (
                                <TableRow key={`non-pallet-${i}`}>
                                  <TableCell className="py-1.5 text-xs font-medium">{rate.serviceName}</TableCell>
                                  <TableCell className="py-1.5 text-xs">{rate.originZone}</TableCell>
                                  <TableCell className="py-1.5 text-xs">{rate.destinationZone}</TableCell>
                                  <TableCell className="py-1.5 text-right text-xs font-mono">{formatCurrency(rate.basicRate)}</TableCell>
                                  <TableCell className="py-1.5 text-right text-xs font-mono">{formatCurrency(rate.kiloRate)}</TableCell>
                                  <TableCell className="py-1.5 text-right text-xs font-mono">{formatCurrency(rate.minRate)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}

                    {palletRateCardData.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-xs font-bold text-foreground">Tiered Pallet Rates</h3>
                        <div className="border rounded-lg overflow-hidden">
                          <Table className="text-[10px]">
                            <TableHeader className="bg-muted/50">
                              <TableRow>
                                <TableHead className="py-1.5 text-[9px] font-bold">From</TableHead>
                                <TableHead className="py-1.5 text-[9px] font-bold">To</TableHead>
                                <TableHead className="py-1.5 text-right text-[9px] font-bold">Basic</TableHead>
                                <TableHead className="py-1.5 text-right text-[9px] font-bold">Min</TableHead>
                                <TableHead className="py-1.5 text-right text-[8px] font-bold">0-250kg</TableHead>
                                <TableHead className="py-1.5 text-right text-[8px] font-bold">251-750kg</TableHead>
                                <TableHead className="py-1.5 text-right text-[8px] font-bold">751-1500kg</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {palletRateCardData.map((rate, i) => (
                                <TableRow key={`pallet-${i}`}>
                                  <TableCell className="py-1 text-[10px] font-medium">{rate.originZone}</TableCell>
                                  <TableCell className="py-1 text-[10px]">{rate.destinationZone}</TableCell>
                                  <TableCell className="py-1 text-right text-[10px] font-mono">{formatCurrency(rate.basicRate)}</TableCell>
                                  <TableCell className="py-1 text-right text-[10px] font-mono">{formatCurrency(rate.minRate)}</TableCell>
                                  <TableCell className="py-1 text-right text-[10px] font-mono">{formatCurrency(rate.tier_0_250)}</TableCell>
                                  <TableCell className="py-1 text-right text-[10px] font-mono">{formatCurrency(rate.tier_251_750)}</TableCell>
                                  <TableCell className="py-1 text-right text-[10px] font-mono">{formatCurrency(rate.tier_751_1500)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic py-2">Attach a rate card via the header action bar to view formatted tables here.</p>
                )}
              </div>

              {/* Benefits */}
              {watchedDetails.sections?.benefits && (
                <div className="space-y-2">
                  <h2 className="text-base font-bold border-b pb-1" style={{ color: activeTheme.primary, borderColor: `${activeTheme.primary}40` }}>
                    Key Value Benefits
                  </h2>
                  <p className="text-xs leading-relaxed whitespace-pre-wrap text-foreground/90">{watchedDetails.sections.benefits}</p>
                </div>
              )}

              {/* Next Steps */}
              {watchedDetails.sections?.nextSteps && (
                <div className="space-y-2">
                  <h2 className="text-base font-bold border-b pb-1" style={{ color: activeTheme.primary, borderColor: `${activeTheme.primary}40` }}>
                    Next Steps
                  </h2>
                  <p className="text-xs leading-relaxed whitespace-pre-wrap text-foreground/90">{watchedDetails.sections.nextSteps}</p>
                </div>
              )}

              {/* Authority to Proceed Signature Block */}
              <div className="space-y-4 pt-4 border-t">
                <h2 className="text-base font-bold" style={{ color: activeTheme.primary }}>
                  Authority to Proceed
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  By signing below, {watchedDetails.customerCompanyName || 'the Client'} authorizes Team Global Express to proceed with the scope and costs outlined in this proposal.
                </p>
                <div className="grid grid-cols-2 gap-8 pt-8">
                  <div className="border-t pt-2 space-y-1">
                    <p className="font-semibold text-xs">{watchedDetails.customerContactName || 'Customer Representative'}</p>
                    <p className="text-[10px] text-muted-foreground">Authorized Signature</p>
                  </div>
                  <div className="border-t pt-2 space-y-1">
                    <p className="font-semibold text-xs">{format(new Date(), 'dd / MM / yyyy')}</p>
                    <p className="text-[10px] text-muted-foreground">Date</p>
                  </div>
                </div>
              </div>

              <footer className="pt-6 border-t text-center text-[10px] text-muted-foreground">
                <p>© {new Date().getFullYear()} Team Global Express. Confidential proposal for recipient.</p>
              </footer>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}

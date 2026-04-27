"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { PostcodeData, ServiceName, RateFileType, RateData, B2CRateEntry, RegionalLookupEntry, LCPRdexRateEntry, LCPPrioRateEntry, LCPGoRateEntry, B2BStdRateEntry, B2BPriorityRateEntry, B2BRdexEntry, TieredPalletRateEntry, GenericJsonRateEntry, PEZonesEntry, WestEastRateEntry } from '@/lib/types';
import { ALL_SERVICES, getAllowedServices, PALLET_SERVICES, PRIORITY_MAPPED_SERVICES, STANDARD_ROAD_MAPPED_SERVICES, LCP_SERVICES, SECURITY_APPLICABLE_SERVICES, NON_PALLET_SERVICES } from '@/lib/types'; 
import { useSettings } from '@/context/SettingsContext';
import { useRateOverrides } from '@/context/RateOverrideContext';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/firebase'; 


import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import LocationAutocomplete from '@/components/freight/LocationAutocomplete';
import { AlertCircle, Calculator, DollarSign, Fuel, Info, Loader2, MapPin, Package, Settings2, Thermometer, FileJson, Save, Database, ListTree, Key, ThumbsUp, ThumbsDown, FileText } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";


const priceTestFormSchema = z.object({
  selectedService: z.custom<ServiceName>((val) => ALL_SERVICES.includes(val as ServiceName), { 
    required_error: "Service Name is required.",
  }),
  originQuery: z.string().optional(),
  originLocation: z.custom<PostcodeData | null>((data) => data !== null, "Valid Origin must be selected."),
  destinationQuery: z.string().optional(),
  destinationLocation: z.custom<PostcodeData | null>((data) => data !== null, "Valid Destination must be selected."),
  spendBand: z.string().min(1, "Spend Band is required."),
  chargeWeight: z.coerce.number().positive("Charge Weight must be positive."),
  fuelSurchargePercent: z.coerce.number().min(0, "Fuel % cannot be negative.").max(100, "Fuel % cannot exceed 100."),
  additionalSurcharges: z.coerce.number().min(0, "Additional Surcharges cannot be negative."),
});

type PriceTestFormValues = z.infer<typeof priceTestFormSchema>;

interface SingleServiceCalculationInfo {
  originZones?: string;
  destZones?: string;
  lupKey?: string;
  journey?: string;
  targetFile: string; // Actual JSON filename
  rateFileType: RateFileType | null;
  finalLogicKey?: string;
  expectedFields?: string[];
  cubicFactor?: number;
  totalDeadWeightForLcpGo?: number;
  lcpGoScopeRemark?: string;
  logicKeyField: 'Logic' | 'LUP' | 'To';
  serviceName: ServiceName;
  isSpendBandRelevant: boolean;
  lookupKeyConstructionInfo: string;
}

interface CalculationResultDisplay {
  baseRateCalculation: string;
  fuelSurchargeCalculation: string;
  totalPriceCalculation: string;
  remarks: string[];
}

interface ServiceDiagnosticInfo {
  serviceName: ServiceName;
  targetFile: string; // Actual JSON filename
  fileLoaded: boolean;
  zoneType: string;
  lookupKeyConstructionInfo: string;
  constructedKey: string | null;
  relevantRateFields: string[];
  isSpendBandRelevant: boolean;
  specificRemarks: string[];
  dataEntry?: any;
  logicKeyField: 'Logic' | 'LUP' | 'To';
}

interface FileUsageDetail {
  fileName: string; // Actual JSON filename
  services: string[]; 
  lookupLogic: string[];
  calculationSummary: string;
}

const fileUsageDetailsMap: Record<string, FileUsageDetail> = {
  'b2c.json': {
    fileName: 'b2c.json',
    services: ['B2C Std', 'B2C Priority'],
    lookupLogic: ["1. Uses 'regionallookup.json' to find 'Journey' (LUP key: OriginPRIO + DestPRIO).", "2. Uses 'b2c.json' with Logic key: SpendBand + Journey."],
    calculationSummary: "Tiered rates (1kg, 3kg, 5kg, per kg over 5kg) using fields like 'b2c1', 'kg' (Std) or 'b2cp1', 'pkg' (Prio).",
  },
   'customer_b2c.json': {
    fileName: 'customer_b2c.json',
    services: ['Customer B2C Standard', 'Customer B2C Priority'],
    lookupLogic: ["Matches ServiceName (normalized to B2CStandard/B2CPriority) + OriginPRIO + DestPRIO."],
    calculationSummary: "Tiered rates parsed from contract PDF. Uses b2c1/3/5 for Standard and b2cp1/3/5 for Priority.",
  },
  'regionallookup.json': {
    fileName: 'regionallookup.json',
    services: ['B2C Std', 'B2C Priority'],
    lookupLogic: ["Primary lookup with LUP key: OriginPRIO + DestPRIO."],
    calculationSummary: "Provides 'Journey' identifier used by 'b2c.json' for rate determination.",
  },
  'lcprdex.json': { fileName: 'lcprdex.json', services: ['LCP Std'], lookupLogic: ["Logic key: 'LCPRDEX' + OriginIPEC + DestIPEC."], calculationSummary: "LCPRDEXBasic + (LCPRDEXKg * ChargeableWeight). Spend Band independent." },
  'lcpprio.json': { fileName: 'lcpprio.json', services: ['LCP Priority'], lookupLogic: ["Logic key: 'LCPPrio' + OriginPRIO + DestPRIO."], calculationSummary: "LCPPrioBasic + (LCPPrioKg * ChargeableWeight). Spend Band independent." },
  'lcpgo.json': { fileName: 'lcpgo.json', services: ['LCP GO Std', 'LCP GO Priority'], lookupLogic: ["LCP GO Std: Logic key: 'GoOff Peak' + OriginPRIO + DestPRIO.", "LCP GO Priority: Logic key: 'GoOvernight' + OriginPRIO + DestPRIO."], calculationSummary: "Tiered rates (Go1, Go3, Go5, Go10) based on Total Dead Weight. Out of scope if dead weight > 10.01kg or dimensions exceed 120x80x60cm. Spend Band independent." },
  'b2b_std.json': { fileName: 'b2b_std.json', services: ["(Legacy B2B Std - not primary)"], lookupLogic: ["Original Logic key: 'B2BSTD' + OriginIPEC + DestIPEC."], calculationSummary: "Original: MAX((BasicX + (KiloX * ChargeableWeight)), MinX). B2B Std parcel now uses b2brdex.json." },
  'b2b_priority.json': { fileName: 'b2b_priority.json', services: ['B2B Priority'], lookupLogic: ["Logic key: '02 02' + OriginPRIO + DestPRIO."], calculationSummary: "(BX + (KX * ChargeableWeight)), where X is Spend Band. Min rate (M field) not used." },
  'b2brdex.json': { fileName: 'b2brdex.json', services: ['B2B Std'], lookupLogic: ["Logic key: 'Parcel' + OriginIPEC + DestIPEC."], calculationSummary: "MAX((BX + (KX * ChargeableWeight)), MX), where X is Spend Band. Used for B2B Std parcel." },
  'PEZones.json': { fileName: 'PEZones.json', services: PALLET_SERVICES, lookupLogic: ["Primary lookup for pallet services using Combined Suburb+Postcode key to find 'Rate Area Zone Description' (PE Zone)."], calculationSummary: "Provides PE Zones used by pallet rate files (pallet1-6.json) for rate determination." },
  'west_east.json': { fileName: 'west_east.json', services: ['WA PE Special'], lookupLogic: ["Matches destination PRIO zone to specific city name (SYDNEY, MELBOURNE, BRISBANE, ADELAIDE)."], calculationSummary: "MAX(Basic + (0-99999KGS * CW), Minimum)." },
};

const UI_TO_RATE_FILE_TYPE_MAP: Record<string, RateFileType | null> = {
  'b2c.json': 'b2c',
  'regionallookup.json': 'regionallookup',
  'lcprdex.json': 'lcprdex',
  'lcpprio.json': 'lcpprio',
  'lcpgo.json': 'lcpgo',
  'b2b_std.json': 'b2b_std', 
  'b2brdex.json': 'b2brdex',
  'b2b_priority.json': 'b2b_priority',
  'PEZones.json': 'pezone',
  'pallet1.json': 'pe1',
  'pallet2.json': 'pe2',
  'pallet3.json': 'pe3',
  'pallet4.json': 'pe4',
  'pallet5.json': 'pe5',
  'pallet6.json': 'pallet6',
  'west_east.json': 'west_east',
  'customer_b2c.json': 'customer_b2c',
  'customer_west_east.json': 'customer_west_east',
};

const RATE_FILE_TYPE_TO_JSON_NAME_MAP: Partial<Record<RateFileType, string>> = {
  'b2c': 'b2c.json',
  'regionallookup': 'regionallookup.json',
  'lcprdex': 'lcprdex.json',
  'lcpprio': 'lcpprio.json',
  'lcpgo': 'lcpgo.json',
  'b2b_std': 'b2b_std.json',
  'b2brdex': 'b2brdex.json',
  'b2b_priority': 'b2b_priority.json',
  'pezone': 'PEZones.json',
  'pe1': 'pallet1.json',
  'pe2': 'pallet2.json',
  'pe3': 'pallet3.json',
  'pe4': 'pallet4.json',
  'pe5': 'pallet5.json',
  'pallet6': 'pallet6.json',
  'west_east': 'west_east.json',
  'customer_b2c': 'customer_b2c.json',
  'customer_west_east': 'customer_west_east.json'
};

const displayedFileNamesOrder = [
  'b2c.json', 'regionallookup.json', 'lcprdex.json', 'lcpprio.json', 'lcpgo.json',
  'b2b_std.json', 'b2brdex.json', 'b2b_priority.json', 'PEZones.json',
  'pallet1.json', 'pallet2.json', 'pallet3.json', 'pallet4.json', 'pallet5.json', 'pallet6.json',
  'west_east.json', 'customer_b2c.json', 'customer_west_east.json'
];

const LUP_SUFFIX_FOR_PALLET_FILES = "Express";


export default function PriceTestPageContent() {
  const { globalSpendBands, standardFuelSurcharge, priorityFuelSurcharge, palletFuelSurcharge, servicePermissions } = useSettings();
  const { user, role } = useAuth(); 
  const { getRateFile, isLoading: isLoadingRatesContext, pezoneData } = useRateOverrides();
  const { toast } = useToast();

  const [rateFieldOverrides, setRateFieldOverrides] = useState<Record<string, string>>({});
  const [calculationInfo, setCalculationInfo] = useState<SingleServiceCalculationInfo | null>(null);
  const [foundRateEntry, setFoundRateEntry] = useState<any | null>(null);
  const [calculationResultDisplay, setCalculationResultDisplay] = useState<CalculationResultDisplay | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFetchingInfo, setIsFetchingInfo] = useState(false);
  const [writePassword, setWritePassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [allPostcodes, setAllPostcodes] = useState<PostcodeData[]>([]);
  const [isLoadingPostcodes, setIsLoadingPostcodes] = useState(true);
  const [isFileInfoDialogOpen, setIsFileInfoDialogOpen] = useState(false);
  const [selectedFileUsageInfo, setSelectedFileUsageInfo] = useState<FileUsageDetail | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const allowedServicesForRole = useMemo(() => getAllowedServices(role, servicePermissions), [role, servicePermissions]);


  const form = useForm<PriceTestFormValues>({
    resolver: zodResolver(priceTestFormSchema),
    defaultValues: {
      spendBand: globalSpendBands[0] || "1",
      chargeWeight: 1,
      fuelSurchargePercent: 0, 
      additionalSurcharges: 0,
      originLocation: null,
      destinationLocation: null,
      selectedService: allowedServicesForRole.length > 0 ? allowedServicesForRole[0] : undefined,
    },
  });
  
  useEffect(() => {
    const currentService = form.getValues('selectedService');
    if (allowedServicesForRole.length > 0 && (!currentService || !allowedServicesForRole.includes(currentService))) {
        form.setValue('selectedService', allowedServicesForRole[0]);
    } else if (allowedServicesForRole.length === 0 && currentService) {
        form.setValue('selectedService', undefined); 
    }
  }, [allowedServicesForRole, form]);


  const { watch, setValue, control, getValues } = form;
  const selectedService = watch('selectedService');
  const originLocation = watch('originLocation');
  const destinationLocation = watch('destinationLocation');
  const currentSpendBand = watch('spendBand');
  const watchedChargeWeight = watch('chargeWeight');

  useEffect(() => {
    const fetchPostcodes = async () => {
      setIsLoadingPostcodes(true);
      try {
        const response = await fetch('/api/postcodes');
        if (!response.ok) throw new Error(`Failed to fetch postcodes: ${response.status}`);
        const data = await response.json();
        setAllPostcodes(data);
      } catch (error) {
        console.error("Error fetching postcodes for Price Test page:", error);
        toast({ title: "Error", description: "Could not load postcode data for Price Test page.", variant: "destructive" });
      } finally {
        setIsLoadingPostcodes(false);
      }
    };
    fetchPostcodes();
  }, [toast]);

  const getPEZoneDisplayFromCombined = (location: PostcodeData | null): string => {
    if (!location || !pezoneData || !location.suburb) {
      return 'N/A';
    }

    const searchKey = (location.suburb.toUpperCase().replace(/\s+/g, '') + location.postcode).trim();

    const peEntry = pezoneData.find(pz => {
      const combinedInPZ = pz["Combined"];
      const trimmedCombinedInPZ = combinedInPZ ? combinedInPZ.trim().toUpperCase() : '';
      return combinedInPZ && trimmedCombinedInPZ === searchKey;
    });

    if (peEntry) {
      return peEntry["PE Zone"];
    } else {
      return 'N/A (Not in PEZones.json)';
    }
  };

  const getDisplayZones = (location: PostcodeData | null): string => {
    if (!location) return "N/A";
    const peZone = getPEZoneDisplayFromCombined(location);
    return `IPEC: ${location.ipec || 'N/A'}, PRIO: ${location.prio || 'N/A'}, PE: ${peZone}`;
  };

  const sanitizePEZoneForLUP = (zone: string | undefined): string | undefined => {
    return zone ? zone.toUpperCase().replace(/\s+/g, '') : undefined;
  }

  useEffect(() => {
    if (!selectedService || !originLocation || !destinationLocation || !currentSpendBand || !allowedServicesForRole.includes(selectedService)) {
      setCalculationInfo(null);
      setFoundRateEntry(null);
      setRateFieldOverrides({});
      return;
    }
    setIsFetchingInfo(true);
    setFoundRateEntry(null);
    setRateFieldOverrides({});

    const info: SingleServiceCalculationInfo = {
      serviceName: selectedService,
      originZones: getDisplayZones(originLocation),
      destZones: getDisplayZones(destinationLocation),
      cubicFactor: PALLET_SERVICES.includes(selectedService as ServiceName) ? 333 : 250,
      targetFile: "N/A", 
      rateFileType: null,
      logicKeyField: 'Logic', 
      isSpendBandRelevant: false,
      lookupKeyConstructionInfo: '',
    };
    let fields: string[] = [];
    let currentFoundEntry: any = null;

    const originPrio = originLocation.prio;
    const destPrio = destinationLocation.prio;
    const originIpec = originLocation.ipec;
    const destIpec = destinationLocation.ipec;
    
    const originPESanitized = sanitizePEZoneForLUP(getPEZoneDisplayFromCombined(originLocation));
    const destPESanitized = sanitizePEZoneForLUP(getPEZoneDisplayFromCombined(destinationLocation));

    const isOurRates = currentSpendBand === 'Customer Rates';
    let rateFileKey: RateFileType | null = null;
    let actualJsonFileName: string | null = null;


    if (selectedService === 'B2B Std') { 
        actualJsonFileName = isOurRates ? 'customer_b2brdex.json' : 'b2brdex.json'; rateFileKey = isOurRates ? 'customer_b2brdex' : 'b2brdex';
        fields = isOurRates ? ['B1', 'K1', 'M1'] : [`B${currentSpendBand}`, `K${currentSpendBand}`, `M${currentSpendBand}`];
        info.finalLogicKey = (originIpec && destIpec) ? `Parcel${originIpec}${destIpec}` : `Missing IPEC zones`;
        info.isSpendBandRelevant = !isOurRates;
    } else if (selectedService === 'B2B Priority') {
        actualJsonFileName = isOurRates ? 'customer_b2b_priority.json' : 'b2b_priority.json'; rateFileKey = isOurRates ? 'customer_b2b_priority' : 'b2b_priority';
        fields = isOurRates ? ['B1', 'K1'] : [`B${currentSpendBand}`, `K${currentSpendBand}`]; 
        const prefix = isOurRates ? 'Parcel' : '02 02';
        info.finalLogicKey = (originPrio && destPrio) ? `${prefix}${originPrio}${destPrio}` : `Missing PRIO zones`;
        info.isSpendBandRelevant = !isOurRates;
    } else if (selectedService === 'B2B Pallets Express' || selectedService === 'B2B Pallets General Tiered') {
        const sbFileNum = parseInt(currentSpendBand, 10);
        let palletFileName = 'N/A (Invalid SB)';
        if (isOurRates) {
            palletFileName = 'customer_pe.json';
            rateFileKey = 'customer_pe';
        } else if (sbFileNum >= 1 && sbFileNum <= 6) {
            palletFileName = `pallet${sbFileNum}.json`;
            rateFileKey = `pe${sbFileNum}` as RateFileType;
        } else {
            info.finalLogicKey = 'Invalid Spend Band for Pallet File';
            actualJsonFileName = 'N/A (Invalid SB)';
            rateFileKey = null;
        }
        info.logicKeyField = isOurRates ? 'Logic' : 'LUP';
        const serviceSuffixForLUP = isOurRates ? '' : LUP_SUFFIX_FOR_PALLET_FILES; 
        fields = selectedService === 'B2B Pallets Express'
            ? ['EBasic', 'Eminimum', 'E0 - 250', 'E251 - 750', 'E751 - 1500', 'E1501 - 3000', 'E3001 - 5000', 'E5001 - 99999']
            : ['GBasic', 'GMinimum', 'G0 - 250', 'G251 - 750', 'G751 - 1500', 'G1501 - 3000', 'G3001 - 5000', 'G5001 - 99999'];
        const logicPrefix = isOurRates ? 'ParcelPallets' : '';
        info.finalLogicKey = (originPESanitized && destPESanitized)
            ? `${logicPrefix}${originPESanitized}${destPESanitized}${serviceSuffixForLUP}`
            : 'Missing PE zones';
        info.isSpendBandRelevant = !isOurRates;
    } else if (selectedService === 'LCP Std') {
      actualJsonFileName = isOurRates ? 'customer_lcprdex.json' : 'lcprdex.json'; rateFileKey = isOurRates ? 'customer_lcprdex' : 'lcprdex';
      fields = isOurRates ? ['B1', 'K1'] : ['LCPRDEXBasic', 'LCPRDEXKg'];
      const prefix = isOurRates ? 'Parcel' : 'LCPRDEX';
      info.finalLogicKey = (originIpec && destIpec) ? `${prefix}${originIpec}${destIpec}` : `Missing IPEC zones`;
    } else if (selectedService === 'LCP Priority') {
      actualJsonFileName = isOurRates ? 'customer_lcpprio.json' : 'lcpprio.json'; rateFileKey = isOurRates ? 'customer_lcpprio' : 'lcpprio';
      fields = isOurRates ? ['B1', 'K1'] : ['LCPPrioBasic', 'LCPPrioKg'];
      const prefix = isOurRates ? 'Parcel' : 'LCPPrio';
      info.finalLogicKey = (originPrio && destPrio) ? `${prefix}${originPrio}${destPrio}` : `Missing PRIO zones`;
    } else if (selectedService.startsWith('LCP GO')) {
        actualJsonFileName = isOurRates ? 'customer_lcpgo.json' : 'lcpgo.json'; rateFileKey = isOurRates ? 'customer_lcpgo' : 'lcpgo';
        fields = isOurRates ? ['B1', 'K1'] : ['Go1', 'Go3', 'Go5', 'Go10'];
        const chargeWeightNum = typeof watchedChargeWeight === 'number' && !isNaN(watchedChargeWeight) ? watchedChargeWeight : undefined;
        info.totalDeadWeightForLcpGo = chargeWeightNum;
        if (chargeWeightNum === undefined) info.lcpGoScopeRemark = "LCP GO: Charge Weight input is invalid or not yet provided.";
        else if (chargeWeightNum > 10.01) info.lcpGoScopeRemark = `Out of Scope: Input Charge Weight (as Dead Wt) ${chargeWeightNum.toFixed(2)}kg > 10.01kg.`;
        else info.lcpGoScopeRemark = `In Scope for Input Charge Weight (as Dead Wt: ${chargeWeightNum.toFixed(2)}kg).`;
        
        const isPriority = selectedService.includes('Priority');
        // UPDATED: GoOvernight is Prio, GoOff Peak is Std
        const prefix = isPriority ? "GoOvernight" : "GoOff Peak";
        const logicKey = isOurRates 
            ? (isPriority ? `GoOvernight${originPrio}${destPrio}` : `GoOff Peak${originPrio}${destPrio}`)
            : `${prefix}${originPrio}${destPrio}`;
        
        info.finalLogicKey = (originPrio && destPrio) ? logicKey : 'Missing PRIO zones';
    } else if (selectedService.startsWith('B2C')) {
      actualJsonFileName = isOurRates ? 'customer_b2c.json' : 'b2c.json (via regionallookup.json)'; 
      rateFileKey = isOurRates ? 'customer_b2c' : 'b2c';
      info.logicKeyField = 'Logic';
      const isPriority = selectedService.includes('Priority');
      fields = !isPriority ? ['b2c1', 'b2c3', 'b2c5', 'kg'] : ['b2cp1', 'b2cp3', 'b2cp5', 'pkg'];
      
      if (isOurRates && originPrio && destPrio) {
          const serviceKey = isPriority ? 'B2CPriority' : 'B2CStandard';
          info.finalLogicKey = `${serviceKey}${originPrio}${destPrio}`;
      } else if (originPrio && destPrio && !isOurRates) {
        const regionalLookupRateData = getRateFile('regionallookup');
        info.lupKey = `${originPrio}${destPrio}`;
        const regionalEntry = (regionalLookupRateData as RegionalLookupEntry[]).find((r: RegionalLookupEntry) => r.LUP === info.lupKey);
        info.journey = regionalEntry ? regionalEntry.Journey : "Journey not found";
        if (info.journey !== "Journey not found") {
            info.finalLogicKey = `${currentSpendBand}${info.journey}`;
        }
        else info.finalLogicKey = "N/A (Journey lookup failed)";
      } else {
        info.finalLogicKey = "N/A";
      }
      info.isSpendBandRelevant = !isOurRates;
    } else if (selectedService === 'WA PE Special') {
        actualJsonFileName = isOurRates ? 'customer_west_east.json' : 'west_east.json';
        rateFileKey = isOurRates ? 'customer_west_east' : 'west_east';
        info.logicKeyField = 'To';
        fields = ['Basic', 'Minimum', '0-99999KGS'];
        const cityToPrioMap: Record<string, string> = { "SYD": "SYDNEY", "MEL": "MELBOURNE", "BNE": "BRISBANE", "ADL": "ADELAIDE" };
        const destinationCity = destPrio ? cityToPrioMap[destPrio] : undefined;
        info.finalLogicKey = destinationCity || "N/A";
    }

    info.expectedFields = fields;
    info.rateFileType = rateFileKey;
    info.targetFile = actualJsonFileName || "N/A";
    
    if (actualJsonFileName) {
        info.lookupKeyConstructionInfo = fileUsageDetailsMap[actualJsonFileName]?.lookupLogic.join(' ') ||  "No lookup details available.";
    }

    if (rateFileKey && info.finalLogicKey && !info.finalLogicKey.startsWith("Missing") && !info.finalLogicKey.startsWith("N/A") && !info.finalLogicKey.startsWith("Invalid Spend Band")) {
      const rateFileData = getRateFile(rateFileKey as RateFileType);
      if (rateFileData && Array.isArray(rateFileData)) {
        const keyFieldToUse = info.logicKeyField;
        currentFoundEntry = rateFileData.find(r => String(r[keyFieldToUse] || '').toUpperCase() === info.finalLogicKey!.toUpperCase());
        setFoundRateEntry(currentFoundEntry || null);
        const newOverrides: Record<string, string> = {};
        (info.expectedFields || []).forEach(field => {
            newOverrides[field] = currentFoundEntry && currentFoundEntry[field] !== undefined && currentFoundEntry[field] !== null ? String(currentFoundEntry[field]) : "";
        });
        setRateFieldOverrides(newOverrides);
      } else {
        setFoundRateEntry(null); setRateFieldOverrides({});
      }
    } else {
      setFoundRateEntry(null); setRateFieldOverrides({});
    }

    if (selectedService) {
        let fuelPercentFromSettings = 0;
        const isPallet = PALLET_SERVICES.includes(selectedService as ServiceName);
        const isPriority = PRIORITY_MAPPED_SERVICES.includes(selectedService as ServiceName) ||
                           selectedService === 'B2C Priority' || selectedService === 'LCP GO Priority';
        const isStandardRoad = STANDARD_ROAD_MAPPED_SERVICES.includes(selectedService as ServiceName) ||
                               selectedService === 'B2C Std' || selectedService === 'LCP GO Std';

        if (isPallet) {
            fuelPercentFromSettings = palletFuelSurcharge;
        } else if (isPriority) {
            fuelPercentFromSettings = priorityFuelSurcharge;
        } else if (isStandardRoad) {
            fuelPercentFromSettings = standardFuelSurcharge;
        } else if (LCP_SERVICES.includes(selectedService as ServiceName)) {
            fuelPercentFromSettings = selectedService.includes('Priority') ? priorityFuelSurcharge : standardFuelSurcharge;
        } else {
            fuelPercentFromSettings = standardFuelSurcharge; 
        }
        setValue('fuelSurchargePercent', fuelPercentFromSettings, { shouldValidate: true });
    } else {
        setValue('fuelSurchargePercent', 0, { shouldValidate: true }); 
    }

    setCalculationInfo(info);
    setIsFetchingInfo(false);
  }, [
      selectedService, originLocation, destinationLocation, currentSpendBand, 
      getRateFile, watchedChargeWeight, allowedServicesForRole, pezoneData,
      standardFuelSurcharge, priorityFuelSurcharge, palletFuelSurcharge, setValue
    ]);

  const handleFileUsageClick = (fileName: string) => {
    const fileInfo = fileUsageDetailsMap[fileName];
    setSelectedFileUsageInfo(fileInfo || null);
    setIsFileInfoDialogOpen(true);
  };

  const handleRateFieldOverrideChange = (fieldName: string, value: string) => {
    setRateFieldOverrides(prev => ({ ...prev, [fieldName]: value }));
  };

  const getNumOverride = (fieldName: string, defaultValue: number = 0): number => {
    const valStr = rateFieldOverrides[fieldName];
    if (valStr === undefined || valStr === null || valStr.trim() === "") {
      const fieldIsRequiredForCalc = calculationInfo?.expectedFields?.includes(fieldName);
      return fieldIsRequiredForCalc ? NaN : defaultValue;
    }
    const num = parseFloat(valStr);
    return isNaN(num) ? NaN : num;
  };

  const onSubmitTestCalculation = (data: PriceTestFormValues) => {
    setIsProcessing(true);
    setCalculationResultDisplay(null);

    const localSelectedService = getValues('selectedService');
    const localCalculationInfo = calculationInfo;

    if (!localSelectedService || !localCalculationInfo || !localCalculationInfo.expectedFields || !allowedServicesForRole.includes(localSelectedService)) {
      setCalculationResultDisplay({ baseRateCalculation: "Error: Service not selected, not allowed, or critical info missing.", fuelSurchargeCalculation: "", totalPriceCalculation: "", remarks: ["Ensure inputs are valid."] });
      setIsProcessing(false); return;
    }

    let baseRate: number | null = null;
    let baseRateDesc = "Base Rate Calculation: ";
    const remarks: string[] = [];
    const cw = data.chargeWeight;
    const localCurrentSpendBand = getValues('spendBand');
    const isOurRates = localCurrentSpendBand === 'Customer Rates';

    try {
      if (localCalculationInfo.lcpGoScopeRemark && localCalculationInfo.lcpGoScopeRemark.includes("Out of Scope")) remarks.push(localCalculationInfo.lcpGoScopeRemark);

      if (!remarks.some(r => r.includes("Out of Scope"))) {
        switch (localSelectedService) {
          case 'B2B Std': 
            const bRateStd = getNumOverride(isOurRates ? 'B1' : `B${localCurrentSpendBand}`, NaN);
            const kRateStd = getNumOverride(isOurRates ? 'K1' : `K${localCurrentSpendBand}`, NaN);
            const mRateStd = getNumOverride(isOurRates ? 'M1' : `M${localCurrentSpendBand}`, NaN);
            if (isNaN(bRateStd) || isNaN(kRateStd) || isNaN(mRateStd)) remarks.push(`Rate fields not defined/invalid in ${localCalculationInfo.targetFile}.`);
            else { baseRate = Math.max((Number(bRateStd) + (Number(kRateStd) * cw)), Number(mRateStd)); baseRateDesc += `MAX((${bRateStd} + (${kRateStd} * CW: ${cw.toFixed(2)})), ${mRateStd}) = ${baseRate !== null ? baseRate.toFixed(2) : 'Error'}`; }
            break;
          case 'B2B Priority': 
            const bRatePrio = getNumOverride(isOurRates ? 'B1' : `B${localCurrentSpendBand}`, NaN);
            const kRatePrio = getNumOverride(isOurRates ? 'K1' : `K${localCurrentSpendBand}`, NaN);
            if (isNaN(bRatePrio) || isNaN(kRatePrio)) remarks.push(`Rate fields not defined/invalid in ${localCalculationInfo.targetFile}.`);
            else { baseRate = Number(bRatePrio) + (Number(kRatePrio) * cw); baseRateDesc += `(${bRatePrio} + (${kRatePrio} * CW: ${cw.toFixed(2)})) = ${baseRate !== null ? baseRate.toFixed(2) : 'Error'}`; }
            break;
          case 'B2B Pallets Express':
          case 'B2B Pallets General Tiered':
            const fieldPrefix = localSelectedService === 'B2B Pallets Express' ? 'E' : 'G';
            const basicTiered = getNumOverride(`${fieldPrefix}Basic`, NaN);
            const minTiered = getNumOverride(`${fieldPrefix}minimum`, NaN); 
            let kiloTiered: number | undefined = NaN;

            if (cw <= 250) kiloTiered = getNumOverride(`${fieldPrefix}0 - 250`, NaN);
            else if (cw <= 750) kiloTiered = getNumOverride(`${fieldPrefix}251 - 750`, NaN);
            else if (cw <= 1500) kiloTiered = getNumOverride(`${fieldPrefix}751 - 1500`, NaN);
            else if (cw <= 3000) kiloTiered = getNumOverride(`${fieldPrefix}1501 - 3000`, NaN);
            else if (cw <= 5000) kiloTiered = getNumOverride(`${fieldPrefix}3001 - 5000`, NaN);
            else kiloTiered = getNumOverride(`${fieldPrefix}5001 - 99999`, NaN);

            if (isNaN(basicTiered) || isNaN(minTiered) || isNaN(kiloTiered)) remarks.push(`Tiered pallet rate fields not defined/invalid in ${localCalculationInfo.targetFile}.`);
            else { baseRate = Math.max((Number(basicTiered) + (Number(kiloTiered) * cw)), Number(minTiered)); baseRateDesc += `MAX((${basicTiered} + (${kiloTiered} * CW: ${cw.toFixed(2)})), ${minTiered}) = ${baseRate !== null ? baseRate.toFixed(2) : 'Error'}`; }
            break;
          case 'LCP Std': 
            const lcpStdBasic = getNumOverride(isOurRates ? 'B1' : 'LCPRDEXBasic', NaN);
            const lcpStdKg = getNumOverride(isOurRates ? 'K1' : 'LCPRDEXKg', NaN);
            if (isNaN(lcpStdBasic) || isNaN(lcpStdKg)) remarks.push(`Rate fields not defined/invalid in ${localCalculationInfo.targetFile}.`);
            else { baseRate = (Number(lcpStdKg) * cw) + Number(lcpStdBasic); baseRateDesc += `(${lcpStdKg} * CW: ${cw.toFixed(2)}) + ${lcpStdBasic} = ${baseRate !== null ? baseRate.toFixed(2) : 'Error'}`; }
            break;
          case 'LCP Priority': 
            const lcpPrioBasic = getNumOverride(isOurRates ? 'B1' : 'LCPPrioBasic', NaN);
            const lcpPrioKg = getNumOverride(isOurRates ? 'K1' : 'LCPPrioKg', NaN);
            if (isNaN(lcpPrioBasic) || isNaN(lcpPrioKg)) remarks.push(`Rate fields not defined/invalid in ${localCalculationInfo.targetFile}.`);
            else { baseRate = (Number(lcpPrioKg) * cw) + Number(lcpPrioBasic); baseRateDesc += `(${lcpPrioKg} * CW: ${cw.toFixed(2)}) + ${lcpPrioBasic} = ${baseRate !== null ? baseRate.toFixed(2) : 'Error'}`; }
            break;
          case 'LCP GO Std': case 'LCP GO Priority': 
            const go1 = getNumOverride('Go1', NaN); const go3 = getNumOverride('Go3', NaN);
            const go5 = getNumOverride('Go5', NaN); const go10 = getNumOverride('Go10', NaN);
            const basicGo = getNumOverride('B1', NaN); const kiloGo = getNumOverride('K1', NaN);
            const deadWeight = localCalculationInfo.totalDeadWeightForLcpGo ?? NaN;
            
            if (isOurRates && entry.B1 !== undefined) {
                if (isNaN(basicGo) || isNaN(kiloGo)) remarks.push('LCP GO customer rate fields missing.');
                else { baseRate = (cw * kiloGo) + basicGo; baseRateDesc += `(K1: ${kiloGo} * CW: ${cw}) + B1: ${basicGo} = ${baseRate !== null ? baseRate.toFixed(2) : 'Error'}`; }
            } else if (isNaN(deadWeight)) { remarks.push(`LCP GO: Dead weight undetermined (CW: ${cw}).`); baseRateDesc += "Weight tier undetermined."; }
            else if (deadWeight <= 1) { baseRate = go1; baseRateDesc += `Selected Go1: ${isNaN(go1) ? 'N/A' : go1.toFixed(2)} (DeadWt ${deadWeight.toFixed(2)}kg)`; }
            else if (deadWeight <= 3) { baseRate = go3; baseRateDesc += `Selected Go3: ${isNaN(go3) ? 'N/A' : go3.toFixed(2)} (DeadWt ${deadWeight.toFixed(2)}kg)`; }
            else if (deadWeight <= 5) { baseRate = go5; baseRateDesc += `Selected Go5: ${isNaN(go5) ? 'N/A' : go5.toFixed(2)} (DeadWt ${deadWeight.toFixed(2)}kg)`; }
            else if (deadWeight <= 10) { baseRate = go10; baseRateDesc += `Selected Go10: ${isNaN(go10) ? 'N/A' : go10.toFixed(2)} (DeadWt ${deadWeight.toFixed(2)}kg)`; }
            else { if (!remarks.some(r => r.includes("Out of Scope"))) remarks.push(`Dead weight ${deadWeight.toFixed(2)}kg for LCP GO > 10kg tier.`); baseRateDesc += "Weight out of LCP GO tiers."; }
            if (baseRate !== null && isNaN(baseRate)) { remarks.push(`LCP GO tier rate not defined/invalid for selected tier in ${localCalculationInfo.targetFile}.`); baseRate = null; }
            break;
          case 'B2C Std': 
            const b2c1_s = getNumOverride('b2c1', NaN); const b2c3_s = getNumOverride('b2c3', NaN);
            const b2c5_s = getNumOverride('b2c5', NaN); const kg_s = getNumOverride('kg', NaN);
            if (isNaN(b2c1_s) || isNaN(b2c3_s) || isNaN(b2c5_s) || isNaN(kg_s)) remarks.push(`B2C Std rate fields not defined/invalid in ${localCalculationInfo.targetFile}.`);
            else {
              if (cw <= 1) { baseRate = b2c1_s; baseRateDesc += `Selected b2c1: ${b2c1_s.toFixed(2)}`; }
              else if (cw <= 3) { baseRate = b2c3_s; baseRateDesc += `Selected b2c3: ${b2c3_s.toFixed(2)}`; }
              else if (cw <= 5) { baseRate = b2c5_s; baseRateDesc += `Selected b2c5: ${b2c5_s.toFixed(2)}`; }
              else { baseRate = Number(b2c5_s) + ((cw - 5) * Number(kg_s)); baseRateDesc += `(b2c5: ${b2c5_s}) + ((CW: ${cw.toFixed(2)} - 5) * kg: ${kg_s}) = ${baseRate !== null ? baseRate.toFixed(2) : 'Error'}`; }
            }
            break;
          case 'B2C Priority': 
            const b2cp1_p = getNumOverride('b2cp1', NaN); const b2cp3_p = getNumOverride('b2cp3', NaN);
            const b2cp5_p = getNumOverride('b2cp5', NaN); const pkg_p = getNumOverride('pkg', NaN);
            if (isNaN(b2cp1_p) || isNaN(b2cp3_p) || isNaN(b2cp5_p) || isNaN(pkg_p)) remarks.push(`B2C Prio rate fields not defined/invalid in ${localCalculationInfo.targetFile}.`);
            else {
              if (cw <= 1) { baseRate = b2cp1_p; baseRateDesc += `Selected b2cp1: ${b2cp1_p.toFixed(2)}`; }
              else if (cw <= 3) { baseRate = b2cp3_p; baseRateDesc += `Selected b2cp3: ${b2cp3_p.toFixed(2)}`; }
              else if (cw <= 5) { baseRate = b2cp5_p; baseRateDesc += `Selected b2cp5: ${b2cp5_p.toFixed(2)}`; }
              else { baseRate = Number(b2cp5_p) + ((cw - 5) * Number(pkg_p)); baseRateDesc += `(b2cp5: ${b2cp5_p}) + ((CW: ${cw.toFixed(2)} - 5) * pkg: ${pkg_p}) = ${baseRate !== null ? baseRate.toFixed(2) : 'Error'}`; }
            }
            break;
          case 'WA PE Special':
            const basicSpecial = getNumOverride('Basic', NaN);
            const minSpecial = getNumOverride('Minimum', NaN);
            const kiloSpecial = getNumOverride('0-99999KGS', NaN);
            if (isNaN(basicSpecial) || isNaN(minSpecial) || isNaN(kiloSpecial)) {
                remarks.push(`Rate fields (Basic, Minimum, 0-99999KGS) not defined/invalid in ${localCalculationInfo.targetFile}.`);
            } else {
                baseRate = Math.max(basicSpecial + (kiloSpecial * cw), minSpecial);
                baseRateDesc += `MAX((${basicSpecial} + (${kiloSpecial} * CW: ${cw.toFixed(2)})), ${minSpecial}) = ${baseRate !== null ? baseRate.toFixed(2) : 'Error'}`;
            }
            break;
          default: remarks.push(`Calc not implemented for ${localSelectedService}.`); baseRate = null;
        }
      }

      let fuelCalcDesc = "Fuel Surcharge: N/A"; let totalCalcDesc = "Total Price: N/A"; let fuelAmount = 0;
      if (baseRate !== null && !isNaN(baseRate)) {
        const isLcpGoServiceLocal = localSelectedService?.startsWith('LCP GO');
        if (isLcpGoServiceLocal) { 
            fuelAmount = 0; 
            fuelCalcDesc = `Calculated Fuel: ${formatCurrency(0)} (LCP GO inclusive)`; 
            if(!remarks.some(r => r.includes("LCP GO price is all-inclusive"))) remarks.push("LCP GO price is all-inclusive."); 
        }
        else { 
            fuelAmount = baseRate * (data.fuelSurchargePercent / 100); 
            fuelCalcDesc = `Calculated Fuel: Base ${baseRate.toFixed(2)} * Fuel ${data.fuelSurchargePercent}% = ${fuelAmount.toFixed(2)}`; 
        }
        const totalPrice = baseRate + fuelAmount + data.additionalSurcharges;
        totalCalcDesc = `Total Price: Base ${baseRate.toFixed(2)} + Fuel ${fuelAmount.toFixed(2)} + Add.Surch ${data.additionalSurcharges.toFixed(2)} = ${totalPrice.toFixed(2)}`;
      } else { if (remarks.length === 0 && !localCalculationInfo.lcpGoScopeRemark?.includes("Out of Scope")) remarks.push("Base rate calc failed or service out of scope/tiers, or invalid/missing overrides."); baseRateDesc = "Base Rate: N/A due to issues or invalid/missing overrides."; }
      setCalculationResultDisplay({ baseRateCalculation: baseRateDesc, fuelSurchargeCalculation: fuelCalcDesc, totalPriceCalculation: totalCalcDesc, remarks });
    } catch (error) {
      console.error("Error during test calculation:", error);
      setCalculationResultDisplay({ baseRateCalculation: "Error during calculation.", fuelSurchargeCalculation: "", totalPriceCalculation: "", remarks: [`Unexpected error: ${error instanceof Error ? error.message : String(error)}`] });
    } finally { setIsProcessing(false); }
  };

  const handleSaveChangesToServer = async () => {
    if (!user) return;
    if (!calculationInfo || !calculationInfo.rateFileType || !calculationInfo.finalLogicKey || !foundRateEntry || !calculationInfo.targetFile || calculationInfo.targetFile === 'N/A') {
      toast({ title: "Cannot Save", description: "Required info missing.", variant: "destructive" }); return; }
    
    setIsSaving(true);
    const { rateFileType, targetFile: actualFileName, finalLogicKey, logicKeyField, expectedFields = [] } = calculationInfo;
    let fullRateData = getRateFile(rateFileType);
    if (!Array.isArray(fullRateData)) { toast({ title: "Error", description: `Could not retrieve data for ${actualFileName}.`, variant: "destructive" }); setIsSaving(false); return; }
    
    fullRateData = JSON.parse(JSON.stringify(fullRateData));
    const entryIndex = fullRateData.findIndex(entry => String(entry[logicKeyField] || '').toUpperCase() === finalLogicKey.toUpperCase());
    if (entryIndex === -1) { toast({ title: "Error", description: `Original entry not found.`, variant: "destructive" }); setIsSaving(false); return; }
    
    const updatedEntry = { ...fullRateData[entryIndex] }; let saveAborted = false;
    expectedFields.forEach(fieldName => {
        if (saveAborted) return;
        if (rateFieldOverrides.hasOwnProperty(fieldName)) {
            const overrideValueStr = rateFieldOverrides[fieldName]; const numValue = parseFloat(overrideValueStr);
            if (!isNaN(numValue)) updatedEntry[fieldName] = numValue;
            else if (overrideValueStr === "" && typeof updatedEntry[fieldName] === 'number') { updatedEntry[fieldName] = 0; }
            else { if (typeof updatedEntry[fieldName] === 'number') { toast({ title: "Data Error", description: `Override for '${fieldName}' is not a valid number.`, variant: "destructive"}); saveAborted = true; return; } updatedEntry[fieldName] = overrideValueStr; }
        }
    });
    
    if (saveAborted) { setIsSaving(false); return; }
    fullRateData[entryIndex] = updatedEntry; const fileContentString = JSON.stringify(fullRateData, null, 2);
    
    try {
        const token = await user.getIdToken();
        const response = await fetch('/api/update-rate-file', { 
          method: 'POST', 
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }, 
          body: JSON.stringify({ fileName: actualFileName, fileContentString }), 
        });
        const result = await response.json();
        if (response.ok) toast({ title: "Success", description: `${actualFileName} updated.` });
        else toast({ title: "Save Failed", description: result.error || "Unknown error.", variant: "destructive" });
    } catch (error) { 
        toast({ title: "Network Error", variant: "destructive" });
    } finally { setIsSaving(false); }
  };
  
  const dataFilesStatus = useMemo(() => {
    const status: Record<string, { loaded: boolean, count: number | null }> = {};
    displayedFileNamesOrder.forEach(uiFileName => {
      const rateFileType = UI_TO_RATE_FILE_TYPE_MAP[uiFileName];
      if (rateFileType) {
        const data = getRateFile(rateFileType);
        status[uiFileName] = { loaded: data !== undefined && Array.isArray(data), count: (data && Array.isArray(data)) ? data.length : null };
      } else { status[uiFileName] = { loaded: false, count: null }; }
    });
    return status;
  }, [getRateFile]);


  const getServiceDiagnosticInfo = (serviceName: ServiceName): ServiceDiagnosticInfo => {
    const info: ServiceDiagnosticInfo = {
      serviceName, targetFile: 'N/A', fileLoaded: false, zoneType: 'N/A',
      lookupKeyConstructionInfo: 'Details not available.', constructedKey: null,
      relevantRateFields: [], isSpendBandRelevant: false, specificRemarks: [], dataEntry: undefined,
      logicKeyField: 'Logic',
    };
    const originPrio = originLocation?.prio; const destPrio = destinationLocation?.prio;
    const originIpec = originLocation?.ipec; const destIpec = destinationLocation?.ipec;
    const originPESanitized = sanitizePEZoneForLUP(getPEZoneDisplayFromCombined(originLocation));
    const destPESanitized = sanitizePEZoneForLUP(getPEZoneDisplayFromCombined(destinationLocation));
    const localCurrentSpendBandForInfo = currentSpendBand || globalSpendBands[0] || "1";
    const isOurRates = currentSpendBand === 'Customer Rates';
    let rateFileData: RateData | undefined; let currentRateFileType: RateFileType | null = null;

    if (serviceName === 'B2B Std') { 
        info.targetFile = isOurRates ? 'customer_b2brdex.json' : 'b2brdex.json'; currentRateFileType = isOurRates ? 'customer_b2brdex' : 'b2brdex'; info.fileLoaded = dataFilesStatus[info.targetFile]?.loaded || false;
        info.zoneType = 'IPEC Zones'; info.isSpendBandRelevant = !isOurRates;
        if (originIpec && destIpec) { info.constructedKey = `Parcel${originIpec}${destIpec}`; info.lookupKeyConstructionInfo = `Key = "Parcel" + Origin IPEC (${originIpec}) + Dest IPEC (${destIpec})`; info.relevantRateFields = isOurRates ? ['B1', 'K1', 'M1'] : [`B${localCurrentSpendBandForInfo}`, `K${localCurrentSpendBandForInfo}`, `M${localCurrentSpendBandForInfo}`]; } 
        else { info.specificRemarks.push('Origin/Dest IPEC zone missing.'); }
    } else if (serviceName === 'B2B Priority') {
        info.targetFile = isOurRates ? 'customer_b2b_priority.json' : 'b2b_priority.json'; currentRateFileType = isOurRates ? 'customer_b2b_priority' : 'b2b_priority'; info.fileLoaded = dataFilesStatus[info.targetFile]?.loaded || false;
        info.zoneType = 'PRIO Zones'; info.isSpendBandRelevant = !isOurRates;
        const prefix = isOurRates ? 'Parcel' : '02 02';
        if (originPrio && destPrio) { info.constructedKey = `${prefix}${originPrio}${destPrio}`; info.lookupKeyConstructionInfo = `Key = "${prefix}" + Origin PRIO (${originPrio}) + Dest PRIO (${destPrio})`; info.relevantRateFields = isOurRates ? ['B1', 'K1'] : [`B${localCurrentSpendBandForInfo}`, `K${localCurrentSpendBandForInfo}`]; } 
        else { info.specificRemarks.push('Origin/Dest PRIO zone missing.'); }
    } else if (serviceName === 'B2B Pallets Express' || serviceName === 'B2B Pallets General Tiered') {
        const sbFileNum = parseInt(localCurrentSpendBandForInfo, 10);
        let palletFileName = 'N/A (Invalid SB)';
        if (isOurRates) {
            palletFileName = 'customer_pe.json';
            currentRateFileType = 'customer_pe';
            info.fileLoaded = dataFilesStatus[palletFileName]?.loaded || false;
        } else if (sbFileNum >= 1 && sbFileNum <= 6) {
            palletFileName = `pallet${sbFileNum}.json`;
            currentRateFileType = `pe${sbFileNum}` as RateFileType;
            info.fileLoaded = dataFilesStatus[palletFileName]?.loaded || false;
        } else { 
            info.specificRemarks.push(`Invalid spend band ${localCurrentSpendBandForInfo} for pallet file selection.`); 
            currentRateFileType = null;
            info.fileLoaded = false;
        }
        info.targetFile = palletFileName;
        info.logicKeyField = isOurRates ? 'Logic' : 'LUP'; info.zoneType = "PE Zones (from PEZones.json combined key)"; info.isSpendBandRelevant = !isOurRates; 
        const serviceSuffixForLUP = isOurRates ? '' : LUP_SUFFIX_FOR_PALLET_FILES; 
        const relevantFieldsPrefix = serviceName === 'B2B Pallets Express' ? 'E' : 'G';
        info.relevantRateFields = [`${relevantFieldsPrefix}Basic`, `${relevantFieldsPrefix}minimum`, `${relevantFieldsPrefix}0 - 250...` ];
        const logicPrefix = isOurRates ? 'ParcelPallets' : '';
        if (originPESanitized && destPESanitized) { 
            info.constructedKey = `${logicPrefix}${originPESanitized}${destPESanitized}${serviceSuffixForLUP}`; 
            info.lookupKeyConstructionInfo = `${isOurRates ? 'Logic' : 'LUP'} Key = ${logicPrefix ? `"${logicPrefix}" + ` : ''}SanOriginPE (${originPESanitized}) + SanDestPE (${destPESanitized})${serviceSuffixForLUP ? ` + "${serviceSuffixForLUP}"` : ''}`; 
        } else { 
            info.specificRemarks.push('Origin/Dest PE zone (from PEZones.json combined key) missing or invalid.'); 
        }
    } else if (serviceName === 'LCP Std') {
      info.targetFile = isOurRates ? 'customer_lcprdex.json' : 'lcprdex.json'; currentRateFileType = isOurRates ? 'customer_lcprdex' : 'lcprdex'; info.fileLoaded = dataFilesStatus[info.targetFile]?.loaded || false;
      info.zoneType = 'IPEC Zones'; info.isSpendBandRelevant = false;
      const prefix = isOurRates ? 'Parcel' : 'LCPRDEX';
      if (originIpec && destIpec) { info.constructedKey = `${prefix}${originIpec}${destIpec}`; info.lookupKeyConstructionInfo = `Logic Key = "${prefix}" + Origin IPEC (${originIpec}) + Dest IPEC (${destIpec})`; info.relevantRateFields = isOurRates ? ['B1', 'K1'] : ['LCPRDEXBasic', 'LCPRDEXKg']; } 
      else { info.specificRemarks.push('Origin/Dest IPEC zone missing.'); }
    } else if (serviceName === 'LCP Priority') {
      info.targetFile = isOurRates ? 'customer_lcpprio.json' : 'lcpprio.json'; currentRateFileType = isOurRates ? 'customer_lcpprio' : 'lcpprio'; info.fileLoaded = dataFilesStatus[info.targetFile]?.loaded || false;
      info.zoneType = 'PRIO Zones'; info.isSpendBandRelevant = false;
      const prefix = isOurRates ? 'Parcel' : 'LCPPrio';
      if (originPrio && destPrio) { info.constructedKey = `${prefix}${originPrio}${destPrio}`; info.lookupKeyConstructionInfo = `Key = "${prefix}" + Origin PRIO (${originPrio}) + Dest PRIO (${destPrio})`; info.relevantRateFields = isOurRates ? ['B1', 'K1'] : ['LCPPrioBasic', 'LCPPrioKg']; } 
      else { info.specificRemarks.push('Origin/Dest PRIO zone missing.'); }
    } else if (serviceName.startsWith('LCP GO')) {
      info.targetFile = isOurRates ? 'customer_lcpgo.json' : 'lcpgo.json'; currentRateFileType = isOurRates ? 'customer_lcpgo' : 'lcpgo'; info.fileLoaded = dataFilesStatus[info.targetFile]?.loaded || false;
      info.zoneType = 'PRIO Zones'; info.isSpendBandRelevant = false; info.specificRemarks.push('Rates tiered by weight. All-inclusive (No fuel).');
      if (originPrio && destPrio) { 
          const isPriority = serviceName.includes('Priority');
          const prefix = isPriority ? "GoOvernight" : "GoOff Peak";
          info.constructedKey = isOurRates 
            ? (isPriority ? `GoOvernight${originPrio}${destPrio}` : `GoOff Peak${originPrio}${destPrio}`)
            : `${prefix}${originPrio}${destPrio}`;
          info.lookupKeyConstructionInfo = `Key = "${prefix}" + Origin PRIO (${originPrio}) + Dest PRIO (${destPrio})`; info.relevantRateFields = isOurRates ? ['B1', 'K1'] : ['Go1', 'Go3', 'Go5', 'Go10']; 
      } else { info.specificRemarks.push('Origin/Dest PRIO zone missing.'); }
    } else if (serviceName.startsWith('B2C')) {
      info.targetFile = isOurRates ? 'customer_b2c.json' : `b2c.json (via regionallookup.json)`; info.logicKeyField = 'Logic'; currentRateFileType = isOurRates ? 'customer_b2c' : 'b2c';
      const isPriority = serviceName.includes('Priority');
      info.fileLoaded = isOurRates ? (dataFilesStatus['customer_b2c.json']?.loaded || false) : (dataFilesStatus['b2c.json']?.loaded && dataFilesStatus['regionallookup.json']?.loaded) || false;
      info.zoneType = 'Journey (PRIO-based)'; info.isSpendBandRelevant = !isOurRates;
      
      if (isOurRates && originPrio && destPrio) {
          const serviceKey = isPriority ? 'B2CPriority' : 'B2CStandard';
          info.constructedKey = `${serviceKey}${originPrio}${destPrio}`;
          info.lookupKeyConstructionInfo = `Key = "${serviceKey}" + Origin PRIO (${originPrio}) + Dest PRIO (${destPrio})`;
          info.relevantRateFields = !isPriority ? ['b2c1', 'b2c3', 'b2c5', 'kg'] : ['b2cp1', 'b2cp3', 'b2cp5', 'pkg'];
      } else if (!isOurRates && !dataFilesStatus['regionallookup.json']?.loaded) info.specificRemarks.push('regionallookup.json not loaded.');
      else if (!isOurRates && originPrio && destPrio) {
        const lupKey = `${originPrio}${destPrio}`; const regionalEntry = (getRateFile('regionallookup') as RegionalLookupEntry[])?.find(r => r.LUP === lupKey);
        if (regionalEntry?.Journey) { info.constructedKey = `${localCurrentSpendBandForInfo}${regionalEntry.Journey}`; info.lookupKeyConstructionInfo = `1. LUP Key (PRIO) = "${lupKey}". 2. Journey (regionallookup.json) = "${regionalEntry.Journey}". 3. Final Key (b2c.json) = SB(${localCurrentSpendBandForInfo}) + Journey("${regionalEntry.Journey}")`; info.relevantRateFields = !isPriority ? ['b2c1', 'b2c3', 'b2c5', 'kg'] : ['b2cp1', 'b2cp3', 'b2cp5', 'pkg']; if (!dataFilesStatus['b2c.json']?.loaded) info.specificRemarks.push('b2c.json not loaded.');}
        else { info.specificRemarks.push(`Journey not found in regionallookup.json for LUP: "${lupKey}".`); }
      } else { info.specificRemarks.push('Origin/Dest PRIO zone missing.'); }
    } else if (serviceName === 'WA PE Special') {
        info.targetFile = isOurRates ? 'customer_west_east.json' : 'west_east.json';
        currentRateFileType = isOurRates ? 'customer_west_east' : 'west_east';
        info.fileLoaded = dataFilesStatus[info.targetFile]?.loaded || false;
        info.zoneType = 'PRIO Zone mapped to City Name';
        info.isSpendBandRelevant = false;
        info.logicKeyField = 'To';
        const cityToPrioMap: Record<string, string> = { "SYD": "SYDNEY", "MEL": "MELBOURNE", "BNE": "BRISBANE", "ADL": "ADELAIDE" };
        const destinationCity = destPrio ? cityToPrioMap[destPrio] : undefined;
        if (originPrio !== 'PER') {
            info.specificRemarks.push('WA PE Special is only valid for origins in the PER zone.');
        }
        if (destinationCity) {
            info.constructedKey = destinationCity;
            info.lookupKeyConstructionInfo = `1. Dest PRIO = "${destPrio}". 2. Mapped City = "${destinationCity}". 3. Key = "${destinationCity}"`;
            info.relevantRateFields = ['Basic', 'Minimum', '0-99999KGS'];
        } else {
            info.specificRemarks.push(`No matching city found for destination PRIO zone: ${destPrio}.`);
        }
    }
    if (currentRateFileType && info.constructedKey && info.fileLoaded) {
        rateFileData = getRateFile(currentRateFileType);
        if (rateFileData && Array.isArray(rateFileData)) {
            info.dataEntry = rateFileData.find(r => String(r[info.logicKeyField] || '').toUpperCase() === info.constructedKey!.toUpperCase());
            if (!info.dataEntry) info.specificRemarks.push(`Entry not found in ${info.targetFile.split(" ")[0]} for key '${info.constructedKey}' using field '${info.logicKeyField}'.`);
        } else {
            info.specificRemarks.push(`${info.targetFile.split(" ")[0]} data is not an array or undefined.`);
        }
    }
    return info;
  };

  const allServicesDiagnosticInfo = useMemo(() => {
    if (isLoadingPostcodes || isLoadingRatesContext || !originLocation || !destinationLocation) return [];
    return allowedServicesForRole.map(serviceName => getServiceDiagnosticInfo(serviceName));
  }, [originLocation, destinationLocation, currentSpendBand, isLoadingPostcodes, isLoadingRatesContext, getRateFile, dataFilesStatus, allowedServicesForRole, pezoneData]);

  const handleFileStatusClick = (uiFileName: string) => {
    const actualJsonFileName = RATE_FILE_TYPE_TO_JSON_NAME_MAP[UI_TO_RATE_FILE_TYPE_MAP[uiFileName] as RateFileType] || uiFileName;
    const detail = fileUsageDetailsMap[actualJsonFileName];
    if (detail) { setSelectedFileUsageInfo(detail); setIsFileInfoDialogOpen(true); }
    else { toast({title: "Info", description: `No usage details available for ${actualJsonFileName} (mapped from ${uiFileName}).`, variant: "default"}); }
  };

  const overallPageLoading = isFetchingInfo || isLoadingRatesContext || isLoadingPostcodes;

  if (!isMounted) return null;

  return (
    <div className="space-y-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center"><Thermometer className="mr-2 h-7 w-7 text-primary" /> Price Logic & Info Tester</CardTitle>
          <CardDescription>Test rate calculations, inspect data lookups, and (temporarily) update rate files.</CardDescription>
        </CardHeader>
      </Card>

      <form onSubmit={form.handleSubmit(onSubmitTestCalculation)} className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-xl flex items-center"><Settings2 className="mr-2 h-6 w-6" />Core Inputs</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label htmlFor="selectedService">Service Name (for Overrides &amp; Test Calc)</Label>
              <Controller name="selectedService" control={control} render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value || ""} disabled={allowedServicesForRole.length === 0}>
                    <SelectTrigger id="selectedService"><SelectValue placeholder={allowedServicesForRole.length === 0 ? "No services available" : "Select Service"} /></SelectTrigger>
                    <SelectContent>{allowedServicesForRole.map(service => (<SelectItem key={service} value={service}>{service}</SelectItem>))}</SelectContent>
                  </Select> )} />
              {form.formState.errors.selectedService && <p className="text-sm text-destructive">{form.formState.errors.selectedService.message}</p>}
              {allowedServicesForRole.length === 0 && <p className="text-xs text-muted-foreground mt-1">No services available for your role.</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="originQueryPriceTest">Origin</Label>
              <LocationAutocomplete inputId="originQueryPriceTest" value={watch('originQuery') || ''} onValueChange={(val) => setValue('originQuery', val)} onLocationSelect={(loc) => setValue('originLocation', loc, { shouldValidate: true })} placeholder="Origin suburb/postcode" allPostcodes={allPostcodes} showRecentSuggestions={false} />
              {form.formState.errors.originLocation && <p className="text-sm text-destructive">{form.formState.errors.originLocation.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="destinationQueryPriceTest">Destination</Label>
              <LocationAutocomplete inputId="destinationQueryPriceTest" value={watch('destinationQuery') || ''} onValueChange={(val) => setValue('destinationQuery', val)} onLocationSelect={(loc) => setValue('destinationLocation', loc, { shouldValidate: true })} placeholder="Destination suburb/postcode" allPostcodes={allPostcodes} showRecentSuggestions={false} />
              {form.formState.errors.destinationLocation && <p className="text-sm text-destructive">{form.formState.errors.destinationLocation.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="spendBandPriceTest">Spend Band (for Pallet File &amp; some B2B Rates)</Label>
              <Controller name="spendBand" control={control} render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger id="spendBandPriceTest"><SelectValue placeholder="Select Spend Band" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Customer Rates">Customer Rates</SelectItem>
                      {globalSpendBands.map(band => (<SelectItem key={band} value={band}>Spend Band {band}</SelectItem>))}
                    </SelectContent>
                  </Select> )} />
              {form.formState.errors.spendBand && <p className="text-sm text-destructive">{form.formState.errors.spendBand.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="chargeWeight">Charge Weight (kg)</Label>
              <Input id="chargeWeight" type="number" {...form.register('chargeWeight')} />
              {form.formState.errors.chargeWeight && <p className="text-sm text-destructive">{form.formState.errors.chargeWeight.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="fuelSurchargePercent"><Fuel className="inline mr-1 h-4 w-4" />Fuel %</Label>
              <Input id="fuelSurchargePercent" type="number" step="0.01" {...form.register('fuelSurchargePercent')} />
              {form.formState.errors.fuelSurchargePercent && <p className="text-sm text-destructive">{form.formState.errors.fuelSurchargePercent.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="additionalSurcharges"><DollarSign className="inline mr-1 h-4 w-4" />Add. Surcharges ($)</Label>
              <Input id="additionalSurcharges" type="number" step="0.01" {...form.register('additionalSurcharges')} />
              {form.formState.errors.additionalSurcharges && <p className="text-sm text-destructive">{form.formState.errors.additionalSurcharges.message}</p>}
            </div>
          </CardContent>
        </Card>

        {selectedService && originLocation && destinationLocation && calculationInfo && (
          <Card>
            <CardHeader><CardTitle className="text-xl flex items-center"><Info className="mr-2 h-6 w-6" />Lookup &amp; Overrides for: <strong className="ml-2 text-primary">{selectedService}</strong></CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm p-3 border rounded-md bg-muted/30">
                <p><strong>Origin Zones:</strong> {calculationInfo.originZones}</p>
                <p><strong>Destination Zones:</strong> {calculationInfo.destZones}</p>
                {calculationInfo.lupKey && <p><strong>LUP Key (B2C):</strong> {calculationInfo.lupKey}</p>}
                {calculationInfo.journey && <p><strong>Journey (B2C):</strong> {calculationInfo.journey}</p>}
                <p><strong>Target Rate File:</strong> {calculationInfo.targetFile}</p>
                <p><strong>Final Lookup Key ({calculationInfo.logicKeyField}):</strong> {calculationInfo.finalLogicKey}</p>
                {calculationInfo.cubicFactor && <p><strong>Cubic Factor:</strong> {calculationInfo.cubicFactor}</p>}
                {calculationInfo.totalDeadWeightForLcpGo !== undefined && typeof calculationInfo.totalDeadWeightForLcpGo === 'number' && !isNaN(calculationInfo.totalDeadWeightForLcpGo) && <p><strong>LCP GO Dead Wt:</strong> {calculationInfo.totalDeadWeightForLcpGo.toFixed(2)} kg</p> }
                {calculationInfo.lcpGoScopeRemark && <p className={calculationInfo.lcpGoScopeRemark.includes("Out of Scope") ? "text-destructive" : "text-green-600"}><strong>LCP GO Scope:</strong> {calculationInfo.lcpGoScopeRemark}</p>}
              </div>
              {foundRateEntry && (<div className="space-y-2"> <Label className="font-semibold flex items-center"><FileJson className="mr-2 h-4 w-4" />Found JSON Entry:</Label> <ScrollArea className="h-32 w-full rounded-md border bg-background"><pre className="p-2 text-xs whitespace-pre-wrap">{JSON.stringify(foundRateEntry, null, 2)}</pre></ScrollArea></div>)}
              {!foundRateEntry && calculationInfo.finalLogicKey && !calculationInfo.finalLogicKey.startsWith("Missing") && !calculationInfo.finalLogicKey.startsWith("N/A") && !calculationInfo.finalLogicKey.startsWith("Invalid Spend Band") && !isFetchingInfo && (<p className="text-sm text-muted-foreground">No matching rate entry found in '{calculationInfo.targetFile}' for key '{calculationInfo.finalLogicKey}'. Provide overrides. Saving disabled.</p>)}
              {calculationInfo.expectedFields && calculationInfo.expectedFields.length > 0 && (<div><Label className="font-semibold">Override Rate Fields:</Label><ScrollArea className="max-h-60 mt-2"><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-3 border rounded-md">{calculationInfo.expectedFields.map(fieldName => (<div key={fieldName} className="space-y-1"><Label htmlFor={`override-${fieldName}`} className="text-xs">{fieldName}</Label><Input id={`override-${fieldName}`} type="text" value={rateFieldOverrides[fieldName] || ""} onChange={(e) => handleRateFieldOverrideChange(fieldName, e.target.value)} placeholder="e.g., 10.50"/></div>))}</div></ScrollArea></div>)}
              {isFetchingInfo && (<div className="flex items-center text-muted-foreground py-2"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading lookup info...</div>)}
               <div className="mt-4 p-3 border rounded-md space-y-3 bg-muted/30">
                 <Button type="button" onClick={handleSaveChangesToServer} disabled={(role !== 'admin' && role !== 'superadmin') || !foundRateEntry || isSaving || !calculationInfo?.targetFile || calculationInfo.targetFile === 'N/A' || calculationInfo.targetFile.startsWith('N/A')} variant="outline" className="bg-destructive hover:bg-destructive/90 text-destructive-foreground disabled:opacity-60"><Save className="mr-2 h-4 w-4" />Save Overrides to Server</Button>
                 {(role !== 'admin' && role !== 'superadmin') && <p className="text-xs text-destructive">Saving restricted to Admin.</p>}
                 {(role === 'admin' || role === 'superadmin') && (!foundRateEntry || !calculationInfo?.targetFile || calculationInfo.targetFile === 'N/A' || calculationInfo.targetFile.startsWith('N/A')) && (<p className="text-xs text-destructive">Saving disabled: No original rate entry or target file.</p>)}
               </div>
            </CardContent>
          </Card>
        )}
        <Button type="submit" className="w-full md:w-auto bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isProcessing || overallPageLoading || allowedServicesForRole.length === 0}>
          {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
          {allowedServicesForRole.length === 0 ? 'No Services Available' : 'Test Calculation'}
        </Button>
      </form>

      {calculationResultDisplay && (
        <Card className="mt-6">
          <CardHeader><CardTitle className="text-xl flex items-center"><Package className="mr-2 h-6 w-6" />Calculation Result (Using Overrides)</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {calculationResultDisplay.remarks && calculationResultDisplay.remarks.length > 0 && (calculationResultDisplay.remarks.map((remark, idx) => (<p key={idx} className={`p-2 rounded-md ${remark.includes("Out of Scope") || remark.includes("Error:") || remark.includes("not defined") || remark.includes("not found") || remark.includes("failed") || remark.includes("invalid") ? "bg-destructive/10 text-destructive" : "bg-muted/50 text-muted-foreground"}`}><AlertCircle className="inline mr-2 h-4 w-4" /> {remark}</p>)))}
            <pre className="p-3 bg-background border rounded-md whitespace-pre-wrap"><strong>Base Rate:</strong> {calculationResultDisplay.baseRateCalculation}</pre>
            <pre className="p-3 bg-background border rounded-md whitespace-pre-wrap"><strong>Fuel:</strong> {calculationResultDisplay.fuelSurchargeCalculation}</pre>
            <pre className="p-3 bg-background border rounded-md whitespace-pre-wrap"><strong>Total:</strong> {calculationResultDisplay.totalPriceCalculation}</pre>
            <CardDescription className="pt-4">This calculation uses the override values you entered.</CardDescription>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-xl flex items-center"><Database className="mr-2 h-6 w-6 text-primary"/>Data Files Load Status</CardTitle></CardHeader>
        <CardContent>
          {isLoadingRatesContext && <p className="text-sm text-muted-foreground">Loading core rate data status...</p>}
          {!isLoadingRatesContext && (
            <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-sm">
              {displayedFileNamesOrder.map((uiFileName) => {
                  const status = dataFilesStatus[uiFileName];
                  const isLoaded = status?.loaded || false;
                  const count = status?.count;
                  const displayCount = count !== null && count !== undefined ? `(${count})` : '';
                  return ( <li key={uiFileName} onClick={() => handleFileStatusClick(uiFileName)} className="flex items-center space-x-2 p-2 border rounded-md bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"> {isLoaded ? <ThumbsUp className="h-5 w-5 text-green-500" /> : <ThumbsDown className="h-5 w-5 text-destructive" />} <span>{uiFileName} {displayCount}</span> </li> );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {selectedFileUsageInfo && (
        <AlertDialog open={isFileInfoDialogOpen} onOpenChange={setIsFileInfoDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center"><FileText className="mr-2 h-5 w-5 text-primary" />Details for {selectedFileUsageInfo.fileName}</AlertDialogTitle>
              <AlertDialogDescription className="text-left space-y-3 pt-2">
                <div><h4 className="font-semibold text-foreground">Services Using This File:</h4><ul className="list-disc list-inside pl-4 text-muted-foreground">{selectedFileUsageInfo.services.map(service => <li key={service}>{service}</li>)}</ul></div>
                <div><h4 className="font-semibold text-foreground">Lookup Logic:</h4><ul className="list-disc list-inside pl-4 text-muted-foreground">{selectedFileUsageInfo.lookupLogic.map((logic, idx) => <li key={idx}>{logic}</li>)}</ul></div>
                <div><h4 className="font-semibold text-foreground">Calculation Summary:</h4><p className="text-muted-foreground">{selectedFileUsageInfo.calculationSummary}</p></div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter><AlertDialogAction onClick={() => setIsFileInfoDialogOpen(false)}>Close</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center"><ListTree className="mr-2 h-6 w-6 text-primary"/>All Services Lookup Details</CardTitle>
           <CardDescription>Expand each service to see how rates are looked up. {!originLocation || !destinationLocation ? "Select origin & destination." : ""} {allowedServicesForRole.length === 0 && "No services for your role."}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingPostcodes && <p>Loading postcode data...</p>}
          {!isLoadingPostcodes && (!originLocation || !destinationLocation) && allowedServicesForRole.length > 0 && (<p className="text-muted-foreground">Select origin & destination for details.</p>)}
          {allServicesDiagnosticInfo.length > 0 && originLocation && destinationLocation && (
            <Accordion type="multiple" className="w-full">
              {allServicesDiagnosticInfo.map(info => (
                <AccordionItem key={info.serviceName} value={info.serviceName}>
                  <AccordionTrigger className="text-lg font-medium hover:no-underline">
                    <div className="flex items-center justify-between w-full pr-2"><span>{info.serviceName}</span>{info.fileLoaded && info.dataEntry ? <Badge variant="default" className="bg-green-600 hover:bg-green-700">Data Found</Badge> : !info.fileLoaded ? <Badge variant="destructive">File Not Loaded</Badge> : <Badge variant="outline" className="border-amber-500 text-amber-700">Data Not Found</Badge>}</div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 p-4 bg-muted/20 rounded-md">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm"><div><strong>Target File(s):</strong> {info.targetFile}</div><div><strong>Zone Type:</strong> {info.zoneType}</div><div className="md:col-span-2"><strong>Spend Band Relevant:</strong> {info.isSpendBandRelevant ? `Yes (Using SB${currentSpendBand})` : 'No'}</div></div>
                    <div className="space-y-1 text-sm"><p><strong><Key className="inline mr-1 h-4"/>Lookup Construction:</strong></p><pre className="p-2 bg-background rounded-md text-xs whitespace-pre-wrap border">{info.lookupKeyConstructionInfo}</pre></div>
                    <div className="space-y-1 text-sm"><p><strong><Key className="inline mr-1 h-4"/>Constructed Key:</strong></p><pre className="p-2 bg-background rounded-md text-xs whitespace-pre-wrap border">{info.constructedKey || "N/A"}</pre></div>
                    <div className="space-y-1 text-sm"><p><strong><FileJson className="inline mr-1 h-4"/>Relevant Rate Fields:</strong></p><pre className="p-2 bg-background rounded-md text-xs border">{info.relevantRateFields.join(', ') || 'N/A'}</pre></div>
                    {info.specificRemarks.length > 0 && (<div className="space-y-1 text-sm"><p><strong><AlertCircle className="inline mr-1 h-4 text-amber-600"/>Remarks:</strong></p><ul className="list-disc list-inside pl-4 text-muted-foreground">{info.specificRemarks.map((remark, idx) => <li key={idx}>{remark}</li>)}</ul></div>)}
                    {info.dataEntry && (<div className="space-y-1 text-sm"><p><strong>Found JSON Entry:</strong></p><ScrollArea className="h-40 w-full rounded-md border"><pre className="p-2 text-xs whitespace-pre-wrap">{JSON.stringify(info.dataEntry, null, 2)}</pre></ScrollArea></div>)}
                    {!info.dataEntry && info.fileLoaded && info.constructedKey && (<p className="text-xs text-muted-foreground">No entry in '{info.targetFile.split(" ")[0]}' for key '{info.constructedKey}'.</p>)}
                    {!info.fileLoaded && (<p className="text-xs text-destructive">Target file '{info.targetFile.split(" ")[0]}' not loaded.</p>)}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
      {(isLoadingRatesContext && !isFetchingInfo) && (<div className="flex items-center justify-center text-muted-foreground py-4"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading core rate data...</div>)}
    </div>
  );
}

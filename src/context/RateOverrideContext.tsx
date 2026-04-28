
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import type {
  RateFileType, RateData, B2CRateEntry, RegionalLookupEntry, LCPRdexRateEntry, LCPPrioRateEntry, LCPGoRateEntry,
  B2BStdRateEntry, B2BPriorityRateEntry, B2BRdexEntry, TieredPalletRateEntry, GenericJsonRateEntry, PEZonesEntry,
  WestEastRateEntry, RASRateEntry, EPRateEntry, LocationLookupData, PostcodeData, CompanyRate
} from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';

// Direct JSON imports for core system rates
import b2cData from '@/public/b2c.json';
import regionalLookup from '@/public/regionallookup.json';
import lcprdex from '@/public/lcprdex.json';
import lcpprio from '@/public/lcpprio.json';
import lcpgo from '@/public/lcpgo.json';
import b2bPriority from '@/public/b2b_priority.json';
import b2brdex from '@/public/b2brdex.json';
import pezones from '@/public/PEZones.json';
import pe1 from '@/public/pe1.json';
import pe2 from '@/public/pe2.json';
import pe3 from '@/public/pe3.json';
import pe4 from '@/public/pe4.json';
import pe5 from '@/public/pe5.json';
import pallet6 from '@/public/pallet6.json';
import westEast from '@/public/west_east.json';
import ras from '@/public/ras.json';
import allPostcodesData from '@/public/postcodes.json';
import allLocationsData from '@/public/locations.json';

interface RateOverrideContextType {
  overriddenRates: Record<string, RateData>;
  getRateFile: (type: RateFileType) => RateData | undefined;
  getAllRateFiles: (baseType: RateFileType) => { accountNumber?: string, data: RateData, isLocalLibrary?: boolean }[];
  setRateOverride: (type: RateFileType, data: RateData | null, accountNumber?: string) => void;
  clearAllOverrides: () => void;
  isLoading: boolean;
  isCoreRateDataMissing: boolean;
  b2cRatesData: B2CRateEntry[] | undefined;
  regionalLookupData: RegionalLookupEntry[] | undefined;
  lcprdexData: LCPRdexRateEntry[] | undefined;
  lcpprioData: LCPPrioRateEntry[] | undefined;
  lcpgoData: LCPGoRateEntry[] | undefined;
  b2bStdData: B2BStdRateEntry[] | undefined;
  b2bPriorityData: B2BPriorityRateEntry[] | undefined;
  b2brdexData: B2BRdexEntry[] | undefined;
  pezoneData: PEZonesEntry[] | undefined;
  pe1Data: TieredPalletRateEntry[] | undefined;
  pe2Data: TieredPalletRateEntry[] | undefined;
  pe3Data: TieredPalletRateEntry[] | undefined;
  pe4Data: TieredPalletRateEntry[] | undefined;
  pe5Data: TieredPalletRateEntry[] | undefined;
  pallet6Data: TieredPalletRateEntry[] | undefined;
  westEastData: WestEastRateEntry[] | undefined;
  rasData: RASRateEntry[] | undefined;
  epratesData: undefined;
  allPostcodes: PostcodeData[] | undefined;
  locationsData: LocationLookupData[] | undefined;
  areOurRatesLoaded: boolean;
  isAnyFileLoaded: boolean;
  linkLocalDirectory: () => Promise<void>;
  localDirectoryName: string | null;
  isLocalLibrarySyncing: boolean;
}

const RateOverrideContext = createContext<RateOverrideContextType | undefined>(undefined);

// Mapping for strict internal file types
const fileNameToRateTypeMap: Record<string, RateFileType> = {
  'b2c.json': 'b2c', 'regionallookup.json': 'regionallookup', 'lcprdex.json': 'lcprdex',
  'lcpprio.json': 'lcpprio', 'lcpgo.json': 'lcpgo', 'b2b_std.json': 'b2b_std',
  'b2b_priority.json': 'b2b_priority', 'b2brdex.json': 'b2brdex', 'PEZones.json': 'pezone',
  'pe1.json': 'pe1', 'pe2.json': 'pe2', 'pe3.json': 'pe3', 'pe4.json': 'pe4', 'pe5.json': 'pe5',
  'pallet6.json': 'pallet6', 'west_east.json': 'west_east', 'ras.json': 'ras',
  'customer_b2c.json': 'customer_b2c', 'customer_b2b_priority.json': 'customer_b2b_priority',
  'customer_b2brdex.json': 'customer_b2brdex', 'customer_pe.json': 'customer_pe',
  'customer_lcpgo.json': 'customer_lcpgo', 'customer_lcprdex.json': 'customer_lcprdex',
  'customer_lcpprio.json': 'customer_lcpprio', 'customer_west_east.json': 'customer_west_east',
};

// Fuzzy mapping for user-friendly local filenames
const fuzzyServiceMap: Record<string, RateFileType> = {
  'B2B STANDARD': 'customer_b2brdex',
  'B2B STD': 'customer_b2brdex',
  'IPEC STD': 'customer_b2brdex',
  'IPEC STANDARD': 'customer_b2brdex',
  'B2B PRIORITY': 'customer_b2b_priority',
  'PRIORITY': 'customer_b2b_priority',
  'B2C': 'customer_b2c',
  'B2C STANDARD': 'customer_b2c',
  'B2C PRIO': 'customer_b2c',
  'PALLETS': 'customer_pe',
  'PALLET': 'customer_pe',
  'PE': 'customer_pe',
  'LCP GO': 'customer_lcpgo',
  'LCP STANDARD': 'customer_lcprdex',
  'LCP STD': 'customer_lcprdex',
  'LCP PRIO': 'customer_lcpprio',
  'LCP PRIORITY': 'customer_lcpprio',
  'WA SPECIAL': 'customer_west_east',
  'WA PE SPECIAL': 'customer_west_east',
};

export const RateOverrideProvider = ({ children }: { children: ReactNode }) => {
  const [overriddenRates, setOverriddenRates] = useState<Record<string, RateData>>({});
  const [localLibraryRates, setLocalLibraryRates] = useState<Record<string, RateData>>({});
  const [localDirectoryName, setLocalDirectoryName] = useState<string | null>(null);
  const [isLocalLibrarySyncing, setIsLocalLibrarySyncing] = useState(false);
  
  const { user, profile, company, loading: authLoading } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const companyRatesQuery = useMemoFirebase(() => {
    if (!firestore || !user || authLoading) return null;
    const targetCompanyId = company?.id || profile?.companyId;
    if (!targetCompanyId) return null;
    return query(collection(firestore, 'companyRates'), where('companyId', '==', targetCompanyId));
  }, [firestore, user, profile?.companyId, company?.id, authLoading]);

  const globalRatesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'globalRates'));
  }, [firestore]);

  const { data: savedCompanyRates, isLoading: isLoadingFirestore } = useCollection<CompanyRate>(companyRatesQuery);
  const { data: savedGlobalRates, isLoading: isLoadingGlobal } = useCollection<any>(globalRatesQuery);

  const centralData = useMemo(() => {
    const getGlobal = (key: string, fallback: any) => {
        const found = (savedGlobalRates || []).find(r => r.id === key);
        return found ? found.data : fallback;
    };

    return {
        b2cRatesData: getGlobal('b2c', b2cData) as B2CRateEntry[],
        regionalLookupData: getGlobal('regionallookup', regionalLookup) as RegionalLookupEntry[],
        lcprdexData: getGlobal('lcprdex', lcprdex) as LCPRdexRateEntry[],
        lcpprioData: getGlobal('lcpprio', lcpprio) as LCPPrioRateEntry[],
        lcpgoData: getGlobal('lcpgo', lcpgo) as LCPGoRateEntry[],
        b2bStdData: undefined, 
        b2bPriorityData: getGlobal('b2b_priority', b2bPriority) as B2BPriorityRateEntry[],
        b2brdexData: getGlobal('b2brdex', b2brdex) as B2BRdexEntry[],
        pezoneData: getGlobal('PEZones', pezones) as PEZonesEntry[],
        pe1Data: getGlobal('pe1', pe1) as TieredPalletRateEntry[],
        pe2Data: getGlobal('pe2', pe2) as TieredPalletRateEntry[],
        pe3Data: getGlobal('pe3', pe3) as TieredPalletRateEntry[],
        pe4Data: getGlobal('pe4', pe4) as TieredPalletRateEntry[],
        pe5Data: getGlobal('pe5', pe5) as TieredPalletRateEntry[],
        pallet6Data: getGlobal('pallet6', pallet6) as TieredPalletRateEntry[],
        westEastData: getGlobal('west_east', westEast) as WestEastRateEntry[],
        rasData: getGlobal('ras', ras) as RASRateEntry[],
        epratesData: undefined, 
        allPostcodes: allPostcodesData as PostcodeData[],
        locationsData: allLocationsData as LocationLookupData[],
    };
  }, [savedGlobalRates]);

  const linkLocalDirectory = async () => {
    if (!window.showDirectoryPicker) {
      toast({ title: "Unsupported Browser", description: "Your browser does not support local folder linking. Please use Chrome or Edge.", variant: "destructive" });
      return;
    }

    try {
      const handle = await window.showDirectoryPicker();
      setLocalDirectoryName(handle.name);
      setIsLocalLibrarySyncing(true);
      
      const library: Record<string, RateData> = {};
      let count = 0;
      
      for await (const entry of (handle as any).values()) {
        if (entry.kind === 'file' && entry.name.endsWith('.json')) {
          const file = await entry.getFile();
          const content = await file.text();
          try {
            const data = JSON.parse(content);
            const parts = entry.name.split(' - ');
            const servicePart = parts[0].toUpperCase().trim();
            const accountNumber = parts.length > 1 ? parts[1].replace('.json', '').trim() : 'Local';
            
            // Try specific mapping first, then fuzzy mapping
            const rateType = fileNameToRateTypeMap[entry.name] || fuzzyServiceMap[servicePart];
            
            if (rateType) {
              const key = `${rateType}_${accountNumber}`;
              library[key] = data;
              count++;
            }
          } catch (e) {
            console.warn(`[Local Sync] Failed to parse: ${entry.name}`);
          }
        }
      }
      
      setLocalLibraryRates(library);
      toast({ title: "Library Sync Successful", description: `Detected and mapped ${count} local rate cards from '${handle.name}'.` });
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        toast({ title: "Folder Access Error", description: err.message, variant: "destructive" });
      }
    } finally {
      setIsLocalLibrarySyncing(false);
    }
  };

  const getRateFile = useCallback((type: RateFileType): RateData | undefined => {
    if (overriddenRates[type]) return overriddenRates[type];
    if (localLibraryRates[type]) return localLibraryRates[type];
    
    if (savedCompanyRates) {
      const saved = savedCompanyRates.find(r => r.rateType === type);
      if (saved && Array.isArray(saved.data)) return saved.data;
    }
    const centralDataMap: Partial<Record<RateFileType, RateData | undefined>> = {
      b2c: centralData.b2cRatesData, regionallookup: centralData.regionalLookupData,
      lcprdex: centralData.lcprdexData, lcpprio: centralData.lcpprioData,
      lcpgo: centralData.lcpgoData, b2b_priority: centralData.b2bPriorityData,
      b2brdex: centralData.b2brdexData, pezone: centralData.pezoneData,
      pe1: centralData.pe1Data, pe2: centralData.pe2Data, pe3: centralData.pe3Data,
      pe4: centralData.pe4Data, pe5: centralData.pe5Data, pallet6: centralData.pallet6Data,
      west_east: centralData.westEastData, ras: centralData.rasData,
      postcodes: centralData.allPostcodes, locations: centralData.locationsData,
    };
    return centralDataMap[type];
  }, [overriddenRates, localLibraryRates, savedCompanyRates, centralData]);

  const getAllRateFiles = useCallback((baseType: RateFileType): { accountNumber?: string, data: RateData, isLocalLibrary?: boolean }[] => {
    const results: { accountNumber?: string, data: RateData, isLocalLibrary?: boolean }[] = [];
    const seenAccounts = new Set<string>();

    // 1. Check Local Library (Account Manager Mode) - Highest Priority
    Object.keys(localLibraryRates).forEach(key => {
        if (key === baseType || key.startsWith(`${baseType}_`)) {
            const acc = key === baseType ? 'Local' : key.replace(`${baseType}_`, '');
            results.push({
                accountNumber: acc,
                data: localLibraryRates[key],
                isLocalLibrary: true
            });
            seenAccounts.add(acc);
        }
    });

    // 2. Check Session Overrides (ZIP Uploads)
    Object.keys(overriddenRates).forEach(key => {
        if (key === baseType || key.startsWith(`${baseType}_`)) {
            const acc = key === baseType ? 'Session' : key.replace(`${baseType}_`, '');
            if (!seenAccounts.has(acc)) {
                results.push({
                    accountNumber: acc === 'Session' ? undefined : acc,
                    data: overriddenRates[key]
                });
                seenAccounts.add(acc);
            }
        }
    });

    // 3. Check Saved Firestore Rates (Cloud Persistence)
    if (savedCompanyRates) {
        savedCompanyRates.forEach(r => {
            if (r.rateType === baseType || r.rateType.startsWith(`${baseType}_`)) {
                const acc = r.accountNumber || 'Cloud';
                if (!seenAccounts.has(acc)) {
                    results.push({
                        accountNumber: r.accountNumber,
                        data: r.data
                    });
                    seenAccounts.add(acc);
                }
            }
        });
    }

    // Fallback to core files if no custom data found
    if (results.length === 0) {
        const fallback = getRateFile(baseType);
        if (fallback) results.push({ data: fallback });
    }

    return results;
  }, [overriddenRates, localLibraryRates, savedCompanyRates, getRateFile]);

  const areOurRatesLoaded = useMemo(() => {
    if (Object.keys(overriddenRates).some(key => key.startsWith('customer_'))) return true;
    if (Object.keys(localLibraryRates).some(key => key.startsWith('customer_'))) return true;
    if (savedCompanyRates?.some(r => r.rateType.startsWith('customer_'))) return true;
    return false;
  }, [overriddenRates, localLibraryRates, savedCompanyRates]);

  const isAnyFileLoaded = useMemo(() => {
    // Check for any of the 3 key LCP files in overrides or central data
    const rdex = getRateFile('lcprdex');
    const prio = getRateFile('lcpprio');
    const go = getRateFile('lcpgo');
    return (rdex?.length || 0) > 0 || (prio?.length || 0) > 0 || (go?.length || 0) > 0;
  }, [getRateFile]);

  const isCoreRateDataMissing = useMemo(() => {
    const rdex = getRateFile('b2brdex');
    const prio = getRateFile('b2b_priority');
    return (!rdex || rdex.length === 0) && (!prio || prio.length === 0);
  }, [getRateFile]);

  const setRateOverride = useCallback((type: RateFileType, data: RateData | null, accountNumber?: string) => {
    setOverriddenRates(prev => {
      const newOverrides = { ...prev };
      const key = accountNumber ? `${type}_${accountNumber}` : type;
      if (data) newOverrides[key] = data;
      else delete newOverrides[key];
      return newOverrides;
    });
  }, []);

  const clearAllOverrides = useCallback(() => {
    setOverriddenRates({});
    setLocalLibraryRates({});
    setLocalDirectoryName(null);
    toast({ title: 'Library & Session Overrides Cleared' });
  }, [toast]);

  return (
    <RateOverrideContext.Provider value={{
        overriddenRates, getRateFile, getAllRateFiles, setRateOverride, clearAllOverrides,
        isLoading: isLoadingFirestore || authLoading, isCoreRateDataMissing, areOurRatesLoaded, isAnyFileLoaded,
        linkLocalDirectory, localDirectoryName, isLocalLibrarySyncing,
        ...centralData, epratesData: undefined,
    }}>
      {children}
    </RateOverrideContext.Provider>
  );
};

export const useRateOverrides = (): RateOverrideContextType => {
  const context = useContext(RateOverrideContext);
  if (context === undefined) throw new Error('useRateOverrides must be used within a RateOverrideProvider');
  return context;
};

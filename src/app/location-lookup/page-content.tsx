"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { LocationLookupData, PostcodeData, VipContact, RASRateEntry, PEZonesEntry } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Building, User, Phone, Mail, MapPin, Search, Warehouse, Car, Route, LayoutGrid, List, Printer, UserCheck, Shield, DollarSign, AlertCircle, Map as MapIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useRateOverrides } from '@/context/RateOverrideContext';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { getDistanceInKm } from '@/lib/haversine';


type SearchResult = 
  | { type: 'agent'; data: LocationLookupData }
  | { type: 'zone'; data: PostcodeData }
  | { type: 'vip'; data: VipContact }
  | { type: 'ras'; data: RASRateEntry };

type FilterType = 'all' | 'agent' | 'zone' | 'vip' | 'ras';

interface MapCenter {
  lat: number;
  lng: number;
}

const handlePhoneClick = (phoneNumber: string) => {
    if (!phoneNumber) return;
    const cleanedNumber = phoneNumber.replace(/[\s()-]/g, '');
    window.location.href = `tel:${cleanedNumber}`;
};

export default function LocationLookupPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSearchQuery = searchParams.get('q') || '';
  const firestore = useFirestore();
  const { profile, company, actualRole, tokenCompanyId } = useAuth();
  
  const { 
    allPostcodes = [], 
    pezoneData, 
    locationsData = [],
    rasData = [],
    isLoading: isLoadingRates 
  } = useRateOverrides();

  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [searchFilter, setSearchFilter] = useState<FilterType>('all');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showAllAgents, setShowAllAgents] = useState(false);
  const [selectedStateFilter, setSelectedStateFilter] = useState('All');
  
  const [mapCenter, setMapCenter] = useState<MapCenter | null>(null);
  const [nearbyLocations, setNearbyLocations] = useState<LocationLookupData[]>([]);

  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  
  const activeCompanyId = actualRole === 'superadmin' ? (company?.id || profile?.companyId) : (tokenCompanyId || profile?.companyId);

  const contactsQuery = useMemoFirebase(() => {
    if (!firestore || !activeCompanyId) return null;
    const base = collection(firestore, 'vipContacts');
    if (actualRole === 'superadmin') return base;
    return query(base, where('companyId', '==', activeCompanyId));
  }, [firestore, activeCompanyId, actualRole]);

  const { data: vipContacts = [], isLoading: isLoadingVips } = useCollection<VipContact>(contactsQuery);

  const isLoading = isLoadingRates || isLoadingVips;

  useEffect(() => {
    const currentQuery = searchParams.get('q') || '';
    setSearchQuery(currentQuery);
    
    if (isLoading || showAllAgents) return;
    
    setMapCenter(null);
    setNearbyLocations([]);

    if (currentQuery.length < 3) {
      setSearchResults([]);
      return;
    }

    const lowercasedQuery = currentQuery.toLowerCase();
    const results: SearchResult[] = [];

    if (searchFilter === 'all' || searchFilter === 'agent') {
      const agentResults = (locationsData || []).filter(loc => 
          (loc["BUSINESS NAME"]?.toLowerCase().includes(lowercasedQuery)) ||
          (loc["AREA SERVICED"]?.toLowerCase().includes(lowercasedQuery)) ||
          (loc["BUSINESS ADDRESS"]?.toLowerCase().includes(lowercasedQuery))
      ).map(data => ({ type: 'agent', data } as SearchResult));
      results.push(...agentResults);
    }
    
    if (searchFilter === 'all' || searchFilter === 'zone') {
       const zoneResults = (allPostcodes || [])
          .filter(p => p.suburb.toLowerCase().includes(lowercasedQuery) || p.postcode.toString().startsWith(lowercasedQuery))
          .slice(0, 20)
          .map(data => ({ type: 'zone', data } as SearchResult));
       results.push(...zoneResults);
    }
    
    if (searchFilter === 'all' || searchFilter === 'vip') {
       if (vipContacts) {
         const vipResults = vipContacts.filter(c => 
            c.name.toLowerCase().includes(lowercasedQuery) ||
            (c.role && c.role.toLowerCase().includes(lowercasedQuery)) ||
            c.email.toLowerCase().includes(lowercasedQuery) ||
            (c.businessUnit && c.businessUnit.toLowerCase().includes(lowercasedQuery))
         ).map(data => ({ type: 'vip', data } as SearchResult));
         results.push(...vipResults);
       }
    }

    if (searchFilter === 'all' || searchFilter === 'ras') {
        const rasResults = (rasData || []).filter(r => 
           (r.suburb && r.suburb.toLowerCase().includes(lowercasedQuery)) ||
           (r.postcode && r.postcode.toString().includes(lowercasedQuery))
        ).map(data => ({ type: 'ras', data } as SearchResult));
        results.push(...rasResults);
    }

    setSearchResults(results);

    const isPostcodeSearch = /^\d{4}$/.test(currentQuery);
    const firstZoneResult = results.find(r => r.type === 'zone' && (isPostcodeSearch ? r.data.postcode.toString() === currentQuery : true)) as SearchResult & { type: 'zone' } | undefined;
    
    if (firstZoneResult && firstZoneResult.data.lat && firstZoneResult.data.lng) {
        const center = { lat: firstZoneResult.data.lat, lng: firstZoneResult.data.lng };
        setMapCenter(center);
        
        const nearby = (locationsData || []).filter(loc => {
            if (loc.LAT && loc.LONG) {
                const distance = getDistanceInKm(center.lat, center.lng, loc.LAT, loc.LONG);
                return distance <= 200; 
            }
            return false;
        });
        setNearbyLocations(nearby);
    }

  }, [searchParams, searchFilter, locationsData, allPostcodes, vipContacts, rasData, isLoading, showAllAgents]);


  const getPEZoneFromSuburbState = (location: PostcodeData | null): string => {
    if (isLoadingRates) return "Loading...";
    if (!pezoneData || !location || !location.suburb || !location.state) {
      return 'N/A';
    }
    const searchKey = `${location.suburb.toUpperCase()} ${location.state.toUpperCase()}`;
    const entry = pezoneData.find(e => e["PE Suburb"]?.toUpperCase() === searchKey);
    return entry ? entry["PE Zone"] : 'N/A';
  };

  const getZonesForLocation = (location: LocationLookupData): { ipec: string, prio: string, pe: string } => {
    if (!location["BUSINESS ADDRESS"] || !allPostcodes || allPostcodes.length === 0) {
      return { ipec: 'N/A', prio: 'N/A', pe: 'N/A' };
    }
    
    const address = location["BUSINESS ADDRESS"];
    const postcodeMatch = address.match(/\b\d{4}\b/);
    const postcode = postcodeMatch ? parseInt(postcodeMatch[0], 10) : null;
    
    if (!postcode) return { ipec: 'N/A', prio: 'N/A', pe: 'N/A' };

    const postcodeData = allPostcodes.find(p => p.postcode === postcode);
    const peZone = getPEZoneFromSuburbState(postcodeData || null);
    
    return {
      ipec: postcodeData?.ipec || 'Not Found',
      prio: postcodeData?.prio || 'Not Found',
      pe: peZone
    };
  };

  const handlePrint = () => { window.print(); };
  
  const handleToggleShowAllAgents = () => {
    if (showAllAgents) {
      setShowAllAgents(false);
      setSearchResults([]);
      setSelectedStateFilter('All');
    } else {
      setShowAllAgents(true);
      router.push('/location-lookup'); 
      setSearchResults([]);
    }
  };

  const agentStates = useMemo(() => ['All', ...Array.from(new Set((locationsData || []).map(loc => loc.State).filter(Boolean))).sort()], [locationsData]);
  
  const filteredAgents = useMemo(() => {
    if (!locationsData) return [];
    if (selectedStateFilter === 'All') {
        return locationsData;
    }
    return locationsData.filter(loc => loc.State === selectedStateFilter);
  }, [locationsData, selectedStateFilter]);

  return (
    <div className="space-y-8">
      <Card className="shadow-xl print-hide">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <Warehouse className="mr-2 h-7 w-7 text-primary" /> Universal Lookup
          </CardTitle>
          <CardDescription>
            A unified search tool for Agents, Zones, VIP Contacts, and Remote Area Surcharges.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="print-hide">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center flex-wrap">
          <Select value={searchFilter} onValueChange={(v) => setSearchFilter(v as FilterType)} disabled={showAllAgents}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Filter by Type" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="agent">Agents / Depots</SelectItem>
                <SelectItem value="zone">Zones</SelectItem>
                <SelectItem value="vip">VIP Contacts</SelectItem>
                <SelectItem value="ras">Remote Areas</SelectItem>
            </SelectContent>
          </Select>
           <div className="flex flex-wrap justify-center gap-2">
              <Button
                  variant={viewMode === 'card' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('card')}
                  disabled={searchResults.length === 0 && !showAllAgents}
              >
                  <LayoutGrid className="mr-2 h-4 w-4" /> Card View
              </Button>
              <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  disabled={searchResults.length === 0 && !showAllAgents}
              >
                  <List className="mr-2 h-4 w-4" /> List View
              </Button>
              <Button variant="outline" size="sm" onClick={handleToggleShowAllAgents}>
                {showAllAgents ? 'Back to Search' : 'Show All Agents'}
              </Button>
               {showAllAgents && (
                 <Select value={selectedStateFilter} onValueChange={setSelectedStateFilter}>
                    <SelectTrigger className="w-full md:w-[180px] h-9 text-xs">
                        <SelectValue placeholder="Filter by State" />
                    </SelectTrigger>
                    <SelectContent>
                        {agentStates.map(state => (
                            <SelectItem key={state} value={state}>{state}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
               )}
               <Button variant="outline" size="sm" onClick={handlePrint} disabled={(searchResults.length === 0 && !showAllAgents) || (showAllAgents && filteredAgents.length === 0)}>
                  <Printer className="mr-2 h-4 w-4" /> Export PDF
              </Button>
            </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center items-center py-10 print-hide">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      ) : (
        <div className="mt-6 print-expand">
          {mapCenter && nearbyLocations.length > 0 && (
            <Card className="mb-6 card-print">
              <CardHeader>
                <CardTitle className="text-xl flex items-center"><MapIcon className="mr-2 h-6 w-6 text-primary"/>Nearby Agent Locations</CardTitle>
                <CardDescription>Showing agents within a 200km radius of your search.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="aspect-video w-full rounded-md overflow-hidden border">
                    <iframe
                        width="100%"
                        height="100%"
                        loading="lazy"
                        allowFullScreen
                        src={`https://www.google.com/maps/embed/v1/view?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY}&center=${mapCenter.lat},${mapCenter.lng}&zoom=8`}
                    ></iframe>
                </div>
              </CardContent>
            </Card>
          )}

          {!showAllAgents && viewMode === 'card' && searchResults.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {searchResults.map((result, index) => {
                switch(result.type) {
                  case 'agent':
                    const location = result.data;
                    const zones = getZonesForLocation(location);
                    return (
                        <Card key={`agent-${index}`} className="flex flex-col card-print">
                          <CardHeader>
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-xl flex items-center">
                                        <Building className="mr-2 h-6 w-6 text-primary" />
                                        {location["BUSINESS NAME"]}
                                    </CardTitle>
                                    <CardDescription>{location["AREA SERVICED"]}</CardDescription>
                                </div>
                                <Badge variant="secondary">{location.State}</Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3 text-sm flex-grow">
                             <div className="flex items-start">
                                <Phone className="mr-2 mt-1 h-4 w-4 flex-shrink-0" />
                                <div>
                                    <strong>Phone:</strong>{' '}
                                    {location["OFFICE NUMBER"] ? (
                                        <Button variant="link" className="p-0 h-auto" onClick={() => handlePhoneClick(location["OFFICE NUMBER"]!)}>
                                            {location["OFFICE NUMBER"]}
                                        </Button>
                                    ) : 'N/A'}
                                </div>
                            </div>
                             <div className="flex items-start">
                                <Phone className="mr-2 mt-1 h-4 w-4 flex-shrink-0" />
                                <div>
                                    <strong>Manager:</strong>{' '}
                                    {location["SITE MANAGER"] || 'N/A'}
                                    {location["MANAGER MOBILE NUMBER"] && (
                                        <Button variant="link" className="p-0 h-auto ml-1" onClick={() => handlePhoneClick(location["MANAGER MOBILE NUMBER"]!)}>
                                            ({location["MANAGER MOBILE NUMBER"]})
                                        </Button>
                                    )}
                                </div>
                            </div>
                             <div className="flex items-start">
                                <Mail className="mr-2 mt-1 h-4 w-4 flex-shrink-0" />
                                <div>
                                    <strong>Email:</strong>{' '}
                                    {location["EMAIL ADDRESS"] ? (
                                        <a href={`mailto:${location["EMAIL ADDRESS"]}`} className="text-primary hover:underline">{location["EMAIL ADDRESS"]}</a>
                                    ) : 'N/A'}
                                </div>
                            </div>
                            <div className="flex items-start">
                                <MapPin className="mr-2 mt-1 h-4 w-4 flex-shrink-0" />
                                <div><strong>Address:</strong> {location["BUSINESS ADDRESS"] || 'N/A'}</div>
                            </div>
                            <Separator className="my-3" />
                            <div className="space-y-2 text-sm">
                                <h4 className="font-semibold flex items-center"><Route className="mr-2 h-4 w-4 text-muted-foreground"/>Zones</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                    <div className="p-2 bg-muted/50 rounded-md"><strong>IPEC:</strong> {zones.ipec}</div>
                                    <div className="p-2 bg-muted/50 rounded-md"><strong>PRIO:</strong> {zones.prio}</div>
                                    <div className="p-2 bg-muted/50 rounded-md"><strong>PE:</strong> {zones.pe}</div>
                                </div>
                            </div>
                          </CardContent>
                        </Card>
                    );
                  default: return null;
                }
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
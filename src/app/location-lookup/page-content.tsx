"use client";

import React, { useState, useEffect, useMemo } from 'react';
import type { LocationLookupData, PostcodeData, VipContact, RASRateEntry, PEZonesEntry } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Building, User, Phone, Mail, MapPin, Search, Warehouse, Route, LayoutGrid, List, Printer, UserCheck, AlertCircle, Map as MapIcon } from 'lucide-react';
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
  const { profile, company, actualRole, tokenCompanyId, loading: authLoading } = useAuth();
  
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

  const isLoading = authLoading || isLoadingRates || isLoadingVips;

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

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground font-medium animate-pulse">Initializing Universal Lookup...</p>
      </div>
    );
  }

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

      <div className="mt-6 print-expand">
          {mapCenter && nearbyLocations.length > 0 && !showAllAgents && (
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
                        <Card key={`agent-${index}`} className="flex flex-col card-print border-l-4 border-l-primary">
                          <CardHeader className="pb-3">
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <Badge variant="outline" className="text-[10px] font-black uppercase tracking-tighter">Agent / Depot</Badge>
                                    <CardTitle className="text-xl flex items-center">
                                        <Building className="mr-2 h-5 w-5 text-primary" />
                                        {location["BUSINESS NAME"]}
                                    </CardTitle>
                                    <CardDescription className="text-xs">{location["AREA SERVICED"]}</CardDescription>
                                </div>
                                <Badge variant="secondary" className="font-bold">{location.State}</Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3 text-sm flex-grow">
                             <div className="flex items-start">
                                <Phone className="mr-2 mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                <div>
                                    <strong>Phone:</strong>{' '}
                                    {location["OFFICE NUMBER"] ? (
                                        <Button variant="link" className="p-0 h-auto text-primary" onClick={() => handlePhoneClick(location["OFFICE NUMBER"]!)}>
                                            {location["OFFICE NUMBER"]}
                                        </Button>
                                    ) : 'N/A'}
                                </div>
                            </div>
                             <div className="flex items-start">
                                <User className="mr-2 mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                <div>
                                    <strong>Manager:</strong>{' '}
                                    {location["SITE MANAGER"] || 'N/A'}
                                    {location["MANAGER MOBILE NUMBER"] && (
                                        <Button variant="link" className="p-0 h-auto ml-1 text-primary" onClick={() => handlePhoneClick(location["MANAGER MOBILE NUMBER"]!)}>
                                            ({location["MANAGER MOBILE NUMBER"]})
                                        </Button>
                                    )}
                                </div>
                            </div>
                             <div className="flex items-start">
                                <Mail className="mr-2 mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                <div>
                                    <strong>Email:</strong>{' '}
                                    {location["EMAIL ADDRESS"] ? (
                                        <a href={`mailto:${location["EMAIL ADDRESS"]}`} className="text-primary hover:underline font-medium">{location["EMAIL ADDRESS"]}</a>
                                    ) : 'N/A'}
                                </div>
                            </div>
                            <div className="flex items-start">
                                <MapPin className="mr-2 mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                <div><strong>Address:</strong> {location["BUSINESS ADDRESS"] || 'N/A'}</div>
                            </div>
                            <Separator className="my-2" />
                            <div className="space-y-2">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center"><Route className="mr-1.5 h-3 w-3"/>Service Zones</h4>
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="p-2 bg-primary/5 rounded border border-primary/10 text-center">
                                        <p className="text-[8px] font-bold text-muted-foreground uppercase">IPEC</p>
                                        <p className="text-xs font-black text-primary">{zones.ipec}</p>
                                    </div>
                                    <div className="p-2 bg-primary/5 rounded border border-primary/10 text-center">
                                        <p className="text-[8px] font-bold text-muted-foreground uppercase">PRIO</p>
                                        <p className="text-xs font-black text-primary">{zones.prio}</p>
                                    </div>
                                    <div className="p-2 bg-primary/5 rounded border border-primary/10 text-center">
                                        <p className="text-[8px] font-bold text-muted-foreground uppercase">PE</p>
                                        <p className="text-xs font-black text-primary">{zones.pe}</p>
                                    </div>
                                </div>
                            </div>
                          </CardContent>
                        </Card>
                    );
                  case 'zone':
                    const zone = result.data;
                    const peZone = getPEZoneFromSuburbState(zone);
                    const rasForZone = rasData.find(r => Number(r.postcode) === Number(zone.postcode) && r.suburb.toUpperCase() === zone.suburb.toUpperCase());
                    
                    return (
                        <Card key={`zone-${index}`} className="flex flex-col card-print border-l-4 border-l-accent">
                            <CardHeader className="pb-3">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <Badge variant="outline" className="text-[10px] font-black uppercase tracking-tighter border-accent text-accent">Postcode / Zone</Badge>
                                        <CardTitle className="text-xl flex items-center">
                                            <MapPin className="mr-2 h-5 w-5 text-accent" />
                                            {zone.suburb}
                                        </CardTitle>
                                        <CardDescription className="text-xs">Postcode: <span className="font-bold text-foreground">{zone.postcode}</span></CardDescription>
                                    </div>
                                    <Badge className="font-bold bg-accent hover:bg-accent">{zone.state}</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm flex-grow">
                                <div className="space-y-2">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center"><Route className="mr-1.5 h-3 w-3"/>Calculated Zones</h4>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="p-2 bg-accent/5 rounded border border-accent/10 text-center">
                                            <p className="text-[8px] font-bold text-muted-foreground uppercase">IPEC</p>
                                            <p className="text-xs font-black text-accent">{zone.ipec}</p>
                                        </div>
                                        <div className="p-2 bg-accent/5 rounded border border-accent/10 text-center">
                                            <p className="text-[8px] font-bold text-muted-foreground uppercase">PRIO</p>
                                            <p className="text-xs font-black text-accent">{zone.prio}</p>
                                        </div>
                                        <div className="p-2 bg-accent/5 rounded border border-accent/10 text-center">
                                            <p className="text-[8px] font-bold text-muted-foreground uppercase">PE</p>
                                            <p className="text-xs font-black text-accent">{peZone}</p>
                                        </div>
                                    </div>
                                </div>

                                {rasForZone && (
                                    <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <AlertCircle className="h-4 w-4 text-amber-600" />
                                            <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-500">Remote Area Surcharge</h4>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-[8px] font-bold text-muted-foreground uppercase">IPEC Surcharge</p>
                                                <p className="text-sm font-black text-amber-700 dark:text-amber-500">${rasForZone.ipec.toFixed(2)}</p>
                                            </div>
                                            <div>
                                                <p className="text-[8px] font-bold text-muted-foreground uppercase">PRIO Surcharge</p>
                                                <p className="text-sm font-black text-amber-700 dark:text-amber-500">${rasForZone.prio.toFixed(2)}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    );
                  case 'ras':
                    const rasEntry = result.data;
                    return (
                        <Card key={`ras-${index}`} className="flex flex-col card-print border-l-4 border-l-amber-500">
                             <CardHeader className="pb-3">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <Badge variant="outline" className="text-[10px] font-black uppercase tracking-tighter border-amber-500 text-amber-600">RAS Only Entry</Badge>
                                        <CardTitle className="text-xl flex items-center">
                                            <AlertCircle className="mr-2 h-5 w-5 text-amber-500" />
                                            {rasEntry.suburb}
                                        </CardTitle>
                                        <CardDescription className="text-xs">Postcode: <span className="font-bold text-foreground">{rasEntry.postcode}</span></CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm flex-grow">
                                <p className="text-xs text-muted-foreground italic mb-2">This location is flagged specifically in the Remote Area Surcharge database.</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-2 bg-amber-500/5 rounded border border-amber-500/10">
                                        <p className="text-[8px] font-bold text-muted-foreground uppercase">IPEC Surcharge</p>
                                        <p className="text-lg font-black text-amber-600">${rasEntry.ipec.toFixed(2)}</p>
                                    </div>
                                    <div className="p-2 bg-amber-500/5 rounded border border-amber-500/10">
                                        <p className="text-[8px] font-bold text-muted-foreground uppercase">PRIO Surcharge</p>
                                        <p className="text-lg font-black text-amber-600">${rasEntry.prio.toFixed(2)}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                  case 'vip':
                    const contact = result.data;
                    return (
                        <Card key={`vip-${index}`} className="flex flex-col card-print border-l-4 border-l-blue-500">
                             <CardHeader className="pb-3">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <Badge variant="outline" className="text-[10px] font-black uppercase tracking-tighter border-blue-500 text-blue-600">VIP Contact</Badge>
                                        <CardTitle className="text-xl flex items-center">
                                            <UserCheck className="mr-2 h-5 w-5 text-blue-500" />
                                            {contact.name}
                                        </CardTitle>
                                        <CardDescription className="text-xs">{contact.businessUnit}</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm flex-grow">
                                 <div className="flex items-start">
                                    <User className="mr-2 mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                    <div><strong>Role:</strong> {contact.role || 'N/A'}</div>
                                </div>
                                <div className="flex items-start">
                                    <Phone className="mr-2 mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                    <div>
                                        <strong>Phone:</strong>{' '}
                                        {contact.phone ? (
                                            <Button variant="link" className="p-0 h-auto text-primary" onClick={() => handlePhoneClick(contact.phone!)}>
                                                {contact.phone}
                                            </Button>
                                        ) : 'N/A'}
                                    </div>
                                </div>
                                <div className="flex items-start">
                                    <Mail className="mr-2 mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                    <div>
                                        <strong>Email:</strong>{' '}
                                        {contact.email ? (
                                            <a href={`mailto:${contact.email}`} className="text-primary hover:underline font-medium">{contact.email}</a>
                                        ) : 'N/A'}
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

          {!showAllAgents && viewMode === 'list' && searchResults.length > 0 && (
            <Card className="card-print overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="w-[80px] text-[10px] font-black uppercase">Type</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">Entity / Location</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">Detail / Area</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">Contact / Zones</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-right">State/PC</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {searchResults.map((result, index) => {
                            if (result.type === 'agent') {
                                const loc = result.data;
                                const zones = getZonesForLocation(loc);
                                return (
                                    <TableRow key={`list-agent-${index}`}>
                                        <TableCell><Badge variant="outline" className="text-[8px] font-bold">AGENT</Badge></TableCell>
                                        <TableCell className="font-bold">{loc["BUSINESS NAME"]}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{loc["AREA SERVICED"]}</TableCell>
                                        <TableCell className="text-xs">
                                            <div className="flex flex-col gap-0.5">
                                                <span>Z: I:{zones.ipec} P:{zones.prio} PE:{zones.pe}</span>
                                                <span className="opacity-70">{loc["OFFICE NUMBER"] || loc["MANAGER MOBILE NUMBER"]}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-xs">{loc.State}</TableCell>
                                    </TableRow>
                                );
                            }
                            if (result.type === 'zone') {
                                const z = result.data;
                                const peZ = getPEZoneFromSuburbState(z);
                                const rasZ = rasData.find(r => Number(r.postcode) === Number(z.postcode) && r.suburb.toUpperCase() === z.suburb.toUpperCase());
                                return (
                                    <TableRow key={`list-zone-${index}`} className={rasZ ? "bg-amber-500/5" : ""}>
                                        <TableCell><Badge variant="outline" className="text-[8px] font-bold border-accent text-accent">ZONE</Badge></TableCell>
                                        <TableCell className="font-bold">{z.suburb}</TableCell>
                                        <TableCell className="text-xs">
                                            {rasZ && <span className="text-amber-600 font-bold flex items-center gap-1"><AlertCircle className="h-3 w-3"/> RAS Applicable</span>}
                                        </TableCell>
                                        <TableCell className="text-xs font-mono">
                                            I:{z.ipec} P:{z.prio} PE:{peZ}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-xs">{z.state} {z.postcode}</TableCell>
                                    </TableRow>
                                );
                            }
                            if (result.type === 'ras') {
                                const r = result.data;
                                return (
                                    <TableRow key={`list-ras-${index}`} className="bg-amber-500/5">
                                        <TableCell><Badge variant="outline" className="text-[8px] font-bold border-amber-500 text-amber-600">RAS</Badge></TableCell>
                                        <TableCell className="font-bold text-amber-700">{r.suburb}</TableCell>
                                        <TableCell className="text-xs italic">Direct RAS Lookup</TableCell>
                                        <TableCell className="text-xs font-bold text-amber-600">IPEC: ${r.ipec.toFixed(2)} | PRIO: ${r.prio.toFixed(2)}</TableCell>
                                        <TableCell className="text-right font-mono text-xs">{r.postcode}</TableCell>
                                    </TableRow>
                                );
                            }
                            if (result.type === 'vip') {
                                const v = result.data;
                                return (
                                    <TableRow key={`list-vip-${index}`}>
                                        <TableCell><Badge variant="outline" className="text-[8px] font-bold border-blue-500 text-blue-600">VIP</Badge></TableCell>
                                        <TableCell className="font-bold">{v.name}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{v.businessUnit}</TableCell>
                                        <TableCell className="text-xs">
                                            <div className="flex flex-col gap-0.5">
                                                <span>{v.email}</span>
                                                <span className="opacity-70">{v.phone}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right text-xs italic">{v.role}</TableCell>
                                    </TableRow>
                                );
                            }
                            return null;
                        })}
                    </TableBody>
                </Table>
            </Card>
          )}

          {!showAllAgents && searchResults.length === 0 && searchQuery.length >= 3 && (
            <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in slide-in-from-bottom-4">
              <div className="p-6 bg-muted/50 rounded-full mb-6">
                <Search className="h-12 w-12 text-muted-foreground opacity-20" />
              </div>
              <h3 className="text-xl font-bold font-headline mb-2">No results found for "{searchQuery}"</h3>
              <p className="text-muted-foreground max-w-sm mb-6">Try refining your search terms, checking for typos, or switching the filter type.</p>
              <Button onClick={() => router.push('/location-lookup')} variant="outline">
                Clear Search & Try Again
              </Button>
            </div>
          )}

          {showAllAgents && (
              <div className="space-y-6">
                  <div className="flex items-center justify-between px-2">
                    <h2 className="text-xl font-black uppercase tracking-tighter text-primary">All Network Agents ({filteredAgents.length})</h2>
                    <Badge variant="secondary" className="font-mono">{selectedStateFilter}</Badge>
                  </div>
                  {viewMode === 'card' ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {filteredAgents.map((loc, idx) => {
                            const zones = getZonesForLocation(loc);
                            return (
                                <Card key={`all-agent-${idx}`} className="flex flex-col border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow">
                                    <CardHeader className="pb-3">
                                        <div className="flex justify-between items-start">
                                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                                <Building className="h-4 w-4 text-primary" />
                                                {loc["BUSINESS NAME"]}
                                            </CardTitle>
                                            <Badge variant="secondary" className="text-[10px]">{loc.State}</Badge>
                                        </div>
                                        <CardDescription className="text-xs truncate">{loc["AREA SERVICED"]}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-3 text-xs flex-grow">
                                        <div className="flex items-start gap-2">
                                            <Phone className="h-3 w-3 text-muted-foreground mt-0.5" />
                                            <span>{loc["OFFICE NUMBER"] || 'No Phone'}</span>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <Mail className="h-3 w-3 text-muted-foreground mt-0.5" />
                                            <span className="truncate">{loc["EMAIL ADDRESS"] || 'No Email'}</span>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <MapPin className="h-3 w-3 text-muted-foreground mt-0.5" />
                                            <span className="line-clamp-2">{loc["BUSINESS ADDRESS"]}</span>
                                        </div>
                                        <Separator className="my-1" />
                                        <div className="grid grid-cols-3 gap-1 text-[9px] font-bold text-center">
                                            <div className="p-1 bg-muted rounded">IPEC: {zones.ipec}</div>
                                            <div className="p-1 bg-muted rounded">PRIO: {zones.prio}</div>
                                            <div className="p-1 bg-muted rounded">PE: {zones.pe}</div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                      </div>
                  ) : (
                      <Card className="overflow-hidden shadow-sm">
                          <Table>
                              <TableHeader className="bg-muted/50">
                                  <TableRow>
                                      <TableHead className="text-[10px] font-black uppercase">Business Name</TableHead>
                                      <TableHead className="text-[10px] font-black uppercase">Area Serviced</TableHead>
                                      <TableHead className="text-[10px] font-black uppercase">Contact</TableHead>
                                      <TableHead className="text-[10px] font-black uppercase">Zones (I/P/PE)</TableHead>
                                      <TableHead className="text-right text-[10px] font-black uppercase">State</TableHead>
                                  </TableRow>
                              </TableHeader>
                              <TableBody>
                                  {filteredAgents.map((loc, idx) => {
                                      const zones = getZonesForLocation(loc);
                                      return (
                                          <TableRow key={`all-list-agent-${idx}`} className="hover:bg-muted/30 transition-colors">
                                              <TableCell className="font-bold text-sm">{loc["BUSINESS NAME"]}</TableCell>
                                              <TableCell className="text-xs text-muted-foreground">{loc["AREA SERVICED"]}</TableCell>
                                              <TableCell className="text-xs">
                                                  <div className="flex flex-col">
                                                      <span>{loc["OFFICE NUMBER"]}</span>
                                                      <span className="opacity-60 truncate max-w-[150px]">{loc["EMAIL ADDRESS"]}</span>
                                                  </div>
                                              </TableCell>
                                              <TableCell className="text-xs font-mono">
                                                  {zones.ipec} / {zones.prio} / {zones.pe}
                                              </TableCell>
                                              <TableCell className="text-right font-bold">{loc.State}</TableCell>
                                          </TableRow>
                                      );
                                  })}
                              </TableBody>
                          </Table>
                      </Card>
                  )}
              </div>
          )}
      </div>
    </div>
  );
}

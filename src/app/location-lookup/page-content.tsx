
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
    
    // Clean number but keep '+' for country codes
    const cleanedNumber = phoneNumber.replace(/[\s()-]/g, '');

    // Attempt to open in Microsoft Teams
    window.location.href = `msteams:l/call/0/0?users=${cleanedNumber}`;

    let hasSwitched = false;
    const visibilityChangeHandler = () => {
        if (document.visibilityState === 'hidden') {
            hasSwitched = true;
        }
        document.removeEventListener('visibilitychange', visibilityChangeHandler);
    };
    document.addEventListener('visibilitychange', visibilityChangeHandler);

    // Fallback to standard telephone link after a short delay
    // if the visibility hasn't changed (i.e., Teams didn't open)
    setTimeout(() => {
        if (!hasSwitched) {
            window.location.href = `tel:${cleanedNumber}`;
        }
    }, 500);
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
  
  // HARDENED: Use tokenCompanyId as the primary filter source to satisfy Security Rules during sync
  const activeCompanyId = actualRole === 'superadmin' ? (company?.id || profile?.companyId) : (tokenCompanyId || profile?.companyId);

  const contactsQuery = useMemoFirebase(() => {
    if (!firestore || !activeCompanyId) return null;
    const base = collection(firestore, 'vipContacts');
    // Superadmins can query the entire collection, others must filter by companyId
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

    // --- Search Logic ---
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

    // --- Map Logic ---
    const isPostcodeSearch = /^\d{4}$/.test(currentQuery);
    const firstZoneResult = results.find(r => r.type === 'zone' && (isPostcodeSearch ? r.data.postcode.toString() === currentQuery : true)) as SearchResult & { type: 'zone' } | undefined;
    
    if (firstZoneResult && firstZoneResult.data.lat && firstZoneResult.data.lng) {
        const center = { lat: firstZoneResult.data.lat, lng: firstZoneResult.data.lng };
        setMapCenter(center);
        
        const nearby = (locationsData || []).filter(loc => {
            if (loc.LAT && loc.LONG) {
                const distance = getDistanceInKm(center.lat, center.lng, loc.LAT, loc.LONG);
                return distance <= 200; // Radius for nearby agents
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

  const handlePrint = () => {
    window.print();
  };
  
  const handleToggleShowAllAgents = () => {
    if (showAllAgents) {
      setShowAllAgents(false);
      setSearchResults([]);
      setSelectedStateFilter('All');
    } else {
      setShowAllAgents(true);
      router.push('/location-lookup'); // Clear search query from URL when showing all
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

  const handleEmailLocation = (location: LocationLookupData) => {
    if (!location) return;

    const subject = `Location Details: ${location["BUSINESS NAME"]}`;
    const body = `
Hi,

Here are the details for the requested location:

Business Name: ${location["BUSINESS NAME"] || 'N/A'}
Area Serviced: ${location["AREA SERVICED"] || 'N/A'}
Address: ${location["BUSINESS ADDRESS"] || 'N/A'}
Office Phone: ${location["OFFICE NUMBER"] || 'N/A'}
Manager Mobile: ${location["MANAGER MOBILE NUMBER"] || 'N/A'}
Email: ${location["EMAIL ADDRESS"] || 'N/A'}

Regards,
${company?.name || company?.settings?.logoText || 'Freight assist.online'}
    `.trim();

    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };


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

          {showAllAgents && (
            <Card className="card-print">
              <CardHeader>
                <CardTitle>All Agents & Depots {selectedStateFilter !== 'All' && `(${selectedStateFilter})`}</CardTitle>
                 <div className="p-4 mt-4 border-l-4 border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                    <div className="flex">
                      <AlertCircle className="h-5 w-5 mr-3" />
                      <div className="flex-1">
                        <h4 className="font-semibold">Important Notice for Customers</h4>
                        <p className="text-sm">
                          The details below are for general reference. Please call the relevant agent or depot to confirm hours of operation and service availability before sending freight.
                        </p>
                      </div>
                    </div>
                  </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Business Name</TableHead>
                      <TableHead>Area Serviced</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Phone</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAgents.map((loc, index) => (
                      <TableRow key={`${loc['BUSINESS NAME']}-${index}`}>
                        <TableCell className="font-semibold">{loc['BUSINESS NAME']}</TableCell>
                        <TableCell>{loc['AREA SERVICED']}</TableCell>
                        <TableCell>{loc['BUSINESS ADDRESS']}</TableCell>
                        <TableCell>
                           {loc["OFFICE NUMBER"] ? (
                            <Button variant="link" className="p-0 h-auto" onClick={() => handlePhoneClick(loc["OFFICE NUMBER"]!)}>
                                {loc["OFFICE NUMBER"]}
                            </Button>
                           ) : 'N/A'}
                        </TableCell>
                      </TableRow>
                    ))}
                     {filteredAgents.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={4} className="h-24 text-center">
                                No agents found for the selected state.
                            </TableCell>
                        </TableRow>
                     )}
                  </TableBody>
                </Table>
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
                          <CardFooter className="pt-2 flex gap-2">
                             <Button size="sm" variant="outline" className="w-full" onClick={() => handleEmailLocation(location)}>
                               <Mail className="mr-2 h-4 w-4" /> Email Details
                             </Button>
                           </CardFooter>
                           <div className="w-full mt-auto print-hide">
                            <iframe
                                width="100%" height="200" loading="lazy" allowFullScreen className="border-t"
                                src={`https://maps.google.com/maps?q=${encodeURIComponent(location["BUSINESS ADDRESS"] || `${location["AREA SERVICED"]} ${location.State}`)}&hl=en&z=14&output=embed`}
                            ></iframe>
                           </div>
                        </Card>
                    );
                  case 'zone':
                      const postcodeInfo = result.data;
                      const zoneZones = { ipec: postcodeInfo.ipec || 'N/A', prio: postcodeInfo.prio || 'N/A', pe: getPEZoneFromSuburbState(postcodeInfo) };
                      return (
                          <Card key={`zone-${index}`} className="flex flex-col col-span-1 card-print">
                              <CardHeader><CardTitle className="text-xl flex items-center"><Route className="mr-2 h-6 w-6 text-primary" />Zone Information</CardTitle><CardDescription>{postcodeInfo.suburb}, {postcodeInfo.state} {postcodeInfo.postcode}</CardDescription></CardHeader>
                              <CardContent className="space-y-3 text-sm flex-grow"><p className="text-muted-foreground">No specific agent found. Displaying zone data only.</p><Separator className="my-3" /><div className="space-y-2 text-sm"><h4 className="font-semibold flex items-center"><Route className="mr-2 h-4 w-4 text-muted-foreground"/>Zones</h4><div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs"><div className="p-2 bg-muted/50 rounded-md"><strong>IPEC:</strong> {zoneZones.ipec}</div><div className="p-2 bg-muted/50 rounded-md"><strong>PRIO:</strong> {zoneZones.prio}</div><div className="p-2 bg-muted/50 rounded-md"><strong>PE:</strong> {zoneZones.pe}</div></div></div></CardContent>
                          </Card>
                      );
                   case 'vip':
                        const contact = result.data;
                        return (
                             <Card key={`vip-${index}`} className="flex flex-col card-print">
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle className="text-xl flex items-center"><UserCheck className="mr-2 h-6 w-6 text-primary" />{contact.name}</CardTitle>
                                            <CardDescription>{contact.role}</CardDescription>
                                        </div>
                                        <Badge variant="outline">{contact.businessUnit}</Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-3 text-sm flex-grow">
                                    <div className="flex items-start"><Mail className="mr-2 mt-1 h-4 w-4 flex-shrink-0" /><div><strong>Email:</strong> <a href={`mailto:${contact.email}`} className="text-primary hover:underline">{contact.email}</a></div></div>
                                    <div className="flex items-start"><Phone className="mr-2 mt-1 h-4 w-4 flex-shrink-0" /><div><strong>Phone:</strong> {contact.phone ? (<Button variant="link" className="p-0 h-auto text-xs" onClick={(e) => { e.stopPropagation(); handlePhoneClick(contact.phone); }} >{contact.phone}</Button>) : 'N/A'}</div></div>
                                    <div className="flex items-start"><MapPin className="mr-2 mt-1 h-4 w-4 flex-shrink-0" /><div><strong>State:</strong> {contact.state}</div></div>
                                </CardContent>
                             </Card>
                        );
                    case 'ras':
                        const ras = result.data;
                        return (
                           <Card key={`ras-${index}`} className="flex flex-col card-print">
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle className="text-xl flex items-center"><Shield className="mr-2 h-6 w-6 text-primary" />Remote Area Surcharge</CardTitle>
                                            <CardDescription>{ras.suburb}, {ras.postcode}</CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-3 text-sm flex-grow">
                                    <div className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                                        <span className="font-medium flex items-center"><Route className="mr-2 h-4 w-4"/>IPEC (Road)</span>
                                        <span className="font-bold text-lg">${ras.ipec.toFixed(2)}</span>
                                    </div>
                                     <div className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                                        <span className="font-medium flex items-center"><Car className="mr-2 h-4 w-4"/>PRIO (Air/Express)</span>
                                        <span className="font-bold text-lg">${ras.prio.toFixed(2)}</span>
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
            <Card className="card-print">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Type</TableHead>
                            <TableHead>Name / Location</TableHead>
                            <TableHead>Details</TableHead>
                            <TableHead>State/Value</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {searchResults.map((result, index) => {
                           switch(result.type) {
                             case 'agent':
                                const location = result.data;
                                return (
                                    <TableRow key={`list-agent-${index}`}>
                                        <TableCell><Badge variant="secondary">Agent</Badge></TableCell>
                                        <TableCell>{location["BUSINESS NAME"] || "N/A"}</TableCell>
                                        <TableCell>{location["BUSINESS ADDRESS"] || `${location["AREA SERVICED"]}`}</TableCell>
                                        <TableCell>{location.State || "N/A"}</TableCell>
                                    </TableRow>
                                );
                             case 'zone':
                                 const p = result.data;
                                 return (
                                    <TableRow key={`list-zone-${index}`}>
                                        <TableCell><Badge variant="outline">Zone</Badge></TableCell>
                                        <TableCell className="font-semibold">{p.suburb}, {p.state} {p.postcode}</TableCell>
                                        <TableCell>IPEC: {p.ipec || 'N/A'}, PRIO: {p.prio || 'N/A'}, PE: {getPEZoneFromSuburbState(p)}</TableCell>
                                        <TableCell>{p.state}</TableCell>
                                    </TableRow>
                                 );
                            case 'vip':
                                 const c = result.data;
                                 return (
                                    <TableRow key={`list-vip-${index}`}>
                                        <TableCell><Badge>VIP</Badge></TableCell>
                                        <TableCell className="font-semibold">{c.name}</TableCell>
                                        <TableCell>{c.role} ({c.email})</TableCell>
                                        <TableCell>{c.state}</TableCell>
                                    </TableRow>
                                 );
                             case 'ras':
                                 const r = result.data;
                                 return (
                                    <TableRow key={`list-ras-${index}`}>
                                        <TableCell><Badge variant="destructive">RAS</Badge></TableCell>
                                        <TableCell className="font-semibold">{r.suburb}, {r.postcode}</TableCell>
                                        <TableCell>IPEC: ${r.ipec.toFixed(2)}, PRIO: ${r.prio.toFixed(2)}</TableCell>
                                        <TableCell>N/A</TableCell>
                                    </TableRow>
                                 );
                             default: return null;
                           }
                        })}
                    </TableBody>
                </Table>
            </Card>
          )}

          {!showAllAgents && searchQuery.length < 3 && !isLoading && (
            <Card className="col-span-1 lg:col-span-2 print-hide">
              <CardContent className="py-10 text-center text-muted-foreground">
                <p>Please enter at least 3 characters in the global search bar to begin a search.</p>
              </CardContent>
            </Card>
          )}
          
          {!showAllAgents && searchResults.length === 0 && searchQuery.length >= 3 && !isLoading && (
            <Card className="col-span-1 lg:col-span-2 print-hide">
              <CardContent className="py-10 text-center text-muted-foreground">
                <p>No agent locations, zones, contacts, or remote areas found matching your criteria.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

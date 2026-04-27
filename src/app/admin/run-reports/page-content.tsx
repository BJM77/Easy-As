"use client";

import React, { useState, useMemo } from 'react';
import { useAuth, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ListOrdered, Search, Calendar as CalendarIcon, User, Package, MapPin } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { type DeliveryRun } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { collection, query, where } from 'firebase/firestore';


export default function RunReportsPageContent() {
  const { user, role, loading: authLoading } = useAuth();
  const firestore = useFirestore();

  const [dateFilter, setDateFilter] = useState<Date | undefined>();
  const [userFilter, setUserFilter] = useState('');
  const [connoteFilter, setConnoteFilter] = useState('');
  const [suburbFilter, setSuburbFilter] = useState('');

  const runsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'deliveryRuns');
  }, [firestore]);

  const { data: allRunsData, isLoading: isLoadingRuns } = useCollection<DeliveryRun>(runsQuery);
  const allRuns = allRunsData ?? [];

  const filteredRuns = useMemo(() => {
    if (!allRuns) return [];

    let filtered = allRuns;

    if (dateFilter) {
      const dateString = format(dateFilter, 'yyyy-MM-dd');
      filtered = filtered.filter(run => run.date === dateString);
    }
    if (userFilter) {
      filtered = filtered.filter(run => run.userEmail?.toLowerCase().includes(userFilter.toLowerCase()));
    }
    if (connoteFilter || suburbFilter) {
      filtered = filtered.map(run => {
        const matchingConsignments = run.consignments?.filter(con => 
          (!connoteFilter || con.consignmentNumber.toLowerCase().includes(connoteFilter.toLowerCase())) &&
          (!suburbFilter || con.address.toLowerCase().includes(suburbFilter.toLowerCase()))
        );
        if (matchingConsignments && matchingConsignments.length > 0) {
          return { ...run, consignments: matchingConsignments };
        }
        return null;
      }).filter((run): run is DeliveryRun => run !== null);
    }

    return filtered;
  }, [allRuns, dateFilter, userFilter, connoteFilter, suburbFilter]);
  
  const clearFilters = () => {
    setDateFilter(undefined);
    setUserFilter('');
    setConnoteFilter('');
    setSuburbFilter('');
  };

  if (authLoading || isLoadingRuns) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-16 w-16 animate-spin" /></div>;
  }
  
  if (role !== 'superadmin') {
     return (
      <Card className="shadow-xl">
        <CardHeader><CardTitle>Access Denied</CardTitle></CardHeader>
        <CardContent><p>You must be a super administrator to view this page.</p></CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <ListOrdered className="mr-2 h-7 w-7 text-primary" /> Delivery Run Reports
          </CardTitle>
          <CardDescription>
            A central dashboard for super admins to view and filter all delivery runs across all users.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
          <CardHeader>
              <CardTitle className="text-xl flex items-center"><Search className="mr-2 h-5 w-5"/>Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
              <div className="space-y-1">
                  <Label htmlFor="date-filter">Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dateFilter && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{dateFilter ? format(dateFilter, "PPP") : <span>Pick a date</span>}</Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateFilter} onSelect={setDateFilter} /></PopoverContent>
                  </Popover>
              </div>
              <div className="space-y-1">
                  <Label htmlFor="user-filter">User Email</Label>
                  <Input id="user-filter" value={userFilter} onChange={e => setUserFilter(e.target.value)} placeholder="user@example.com" />
              </div>
              <div className="space-y-1">
                  <Label htmlFor="connote-filter">Consignment #</Label>
                  <Input id="connote-filter" value={connoteFilter} onChange={e => setConnoteFilter(e.target.value)} placeholder="TGE123..." />
              </div>
              <div className="space-y-1">
                  <Label htmlFor="suburb-filter">Suburb</Label>
                  <Input id="suburb-filter" value={suburbFilter} onChange={e => setSuburbFilter(e.target.value)} placeholder="Perth, Sydney..." />
              </div>
              <Button onClick={clearFilters} variant="outline">Clear Filters</Button>
          </CardContent>
      </Card>
      
      <Card>
          <CardHeader>
              <CardTitle>Filtered Runs ({filteredRuns.length})</CardTitle>
          </CardHeader>
          <CardContent>
              <div className="border rounded-md max-h-[80vh] overflow-y-auto">
                  <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                          <TableRow>
                              <TableHead>Run Date</TableHead>
                              <TableHead>User</TableHead>
                              <TableHead>Consignment #</TableHead>
                              <TableHead>Address</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {filteredRuns.length > 0 ? (
                              filteredRuns.flatMap(run => 
                                  (run.consignments || []).map(con => (
                                      <TableRow key={`${run.id}-${con.id}`}>
                                          <TableCell>{format(parseISO(run.date), 'PPP')}</TableCell>
                                          <TableCell>{run.userEmail || run.userId}</TableCell>
                                          <TableCell className="font-mono">{con.consignmentNumber}</TableCell>
                                          <TableCell>{con.address}</TableCell>
                                      </TableRow>
                                  ))
                              )
                          ) : (
                              <TableRow>
                                  <TableCell colSpan={4} className="h-24 text-center">
                                      No delivery runs found for the selected filters.
                                  </TableCell>
                              </TableRow>
                          )}
                      </TableBody>
                  </Table>
              </div>
          </CardContent>
      </Card>
    </div>
  );
}
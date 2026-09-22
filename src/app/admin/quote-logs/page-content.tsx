
"use client";

import React, { useMemo, useState } from 'react';
import { useAuth, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { History, Search, Loader2, RefreshCcw, User, ArrowRightLeft } from 'lucide-react';
import { collection, query, orderBy, limit, where } from 'firebase/firestore';
import { format, subDays } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import type { QuoteLog } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { cn, formatCurrency } from '@/lib/utils';

export default function QuoteLogsPageContent() {
  const { actualRole } = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');

  // FILTER: Only show the last 30 days of data
  const logsQuery = useMemoFirebase(() => {
    if (!firestore || actualRole !== 'superadmin') return null;
    const thirtyDaysAgo = subDays(new Date(), 30);
    return query(
        collection(firestore, 'quote_logs'), 
        where('timestamp', '>=', thirtyDaysAgo),
        orderBy('timestamp', 'desc'), 
        limit(1000)
    );
  }, [firestore, actualRole]);

  const { data: logs, isLoading } = useCollection<QuoteLog>(logsQuery);

  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    return logs.filter(log => {
        const q = searchQuery.toLowerCase();
        return (
            log.userEmail.toLowerCase().includes(q) ||
            log.origin.toLowerCase().includes(q) ||
            log.destination.toLowerCase().includes(q) ||
            log.service.toLowerCase().includes(q)
        );
    });
  }, [logs, searchQuery]);

  const handleReplicate = (log: QuoteLog) => {
    if (!log.inputState) {
        toast({ title: "Cannot Replicate", description: "Input data snapshot missing.", variant: "destructive" });
        return;
    }
    
    // Store in session and move to calculator
    sessionStorage.setItem('rehydration_state', JSON.stringify(log.inputState));
    router.push('/calculator');
    toast({ title: "Replicating Quote", description: "Setting form parameters from historical audit." });
  };

  if (actualRole !== 'superadmin') return <div className="p-20 text-center">Unauthorized. Superadmin access only.</div>;

  return (
    <div className="space-y-8 pb-20">
      <Card className="shadow-xl border-t-4 border-primary">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start gap-4">
            <div>
              <CardTitle className="text-2xl font-headline flex items-center">
                <History className="mr-2 h-7 w-7 text-primary" /> Global Quote History Log
              </CardTitle>
              <CardDescription>Monitor platform-wide freight calculations. Rolling 30-day history window.</CardDescription>
            </div>
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search user, lane, or service..." className="pl-9 h-9" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card className="shadow-lg overflow-hidden">
        <CardContent className="p-0">
          <ScrollArea className="h-[700px] w-full">
            <Table>
              <TableHeader className="bg-muted/30 sticky top-0 z-10">
                <TableRow>
                  <TableHead className="w-[150px]">Time</TableHead>
                  <TableHead>User / Workspace</TableHead>
                  <TableHead>Lane (From {'>'} To)</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead className="text-right">Weight</TableHead>
                  <TableHead className="text-right">Total (Ex GST)</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                ) : filteredLogs.length > 0 ? (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="text-[11px] font-mono text-muted-foreground">
                        {log.timestamp ? format(log.timestamp.toDate ? log.timestamp.toDate() : new Date(log.timestamp), 'dd MMM, HH:mm') : '--'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                            <span className="text-xs font-bold flex items-center gap-1"><User className="h-3 w-3"/> {log.userEmail}</span>
                            <span className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">{log.companyId}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-xs">
                            <span className="font-semibold">{log.origin}</span>
                            <RefreshCcw className="h-3 w-3 text-muted-foreground" />
                            <span className="font-semibold">{log.destination}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[9px] uppercase font-bold">{log.service}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {log.chargeWeight.toFixed(2)}kg
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                            <span className="font-bold text-primary text-sm font-headline">{formatCurrency(log.totalExGst)}</span>
                            <span className="text-[9px] text-muted-foreground uppercase font-black tracking-tighter">Markup: {log.markup}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 text-[10px] uppercase font-bold"
                            onClick={() => handleReplicate(log)}
                        >
                            <ArrowRightLeft className="mr-1.5 h-3 w-3" /> Replicate
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={7} className="text-center py-24 text-muted-foreground italic font-headline">No calculations found in the rolling 30-day window.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

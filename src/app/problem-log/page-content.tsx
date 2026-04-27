
'use client';

import React, { useState } from 'react';
import { useAuth, useCollection, useFirestore, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import type { ProblemEntry, Lead } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, PlusCircle, Loader2, Lightbulb, User, MapPin, Building2, TrendingUp } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { collection, query, orderBy, doc, where, limit } from 'firebase/firestore';
import NewProblemDialog from '@/components/NewProblemDialog';
import NewLeadDialog from '@/components/NewLeadDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';

const PROBLEM_STATUSES: ProblemEntry['status'][] = ['open', 'in_progress', 'resolved'];

const ConnoteLink = ({ connote }: { connote: string }) => {
    const isLinkable = /^240\d+$/.test(connote) || /^[A-Z]{4}\d{6}$/.test(connote);
    if (isLinkable) {
        return (
            <a
                href={`https://teamglobalexp.com/myparcel?shipmentID=${encodeURIComponent(connote)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-primary hover:underline"
            >
                {connote}
            </a>
        );
    }
    return <span className="font-mono">{connote}</span>;
};

export default function ActivityLogPageContent() {
  const [activeTab, setActiveTab] = useState<'problems' | 'leads'>('problems');
  const [filter, setFilter] = useState<'all' | 'mine'>('all');
  const { user, profile, company, actualRole, isSuperadmin } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isNewProblemDialogOpen, setIsNewProblemDialogOpen] = useState(false);
  const [isNewLeadDialogOpen, setIsNewLeadDialogOpen] = useState(false);

  // Use the synchronized profile company ID
  const activeCompanyId = company?.id || profile?.companyId;

  // HARDENED QUERIES: Ensuring strict tenant isolation at the query level
  const problemsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !activeCompanyId) return null;
    const baseQuery = collection(firestore, 'problems');
    
    if (filter === 'mine') {
        return query(baseQuery, where('userId', '==', user.uid), orderBy('date', 'desc'), limit(50));
    }

    if (actualRole === 'superadmin' && filter === 'all') {
      return query(baseQuery, orderBy('date', 'desc'), limit(50));
    }
    
    return query(baseQuery, where('companyId', '==', activeCompanyId), orderBy('date', 'desc'), limit(50));
  }, [firestore, filter, user, actualRole, activeCompanyId]);

  const leadsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !activeCompanyId) return null;
    const baseQuery = collection(firestore, 'leads');
    
    if (filter === 'mine') {
        return query(baseQuery, where('userId', '==', user.uid), orderBy('date', 'desc'), limit(50));
    }

    if (actualRole === 'superadmin' && filter === 'all') {
      return query(baseQuery, orderBy('date', 'desc'), limit(50));
    }
    
    return query(baseQuery, where('companyId', '==', activeCompanyId), orderBy('date', 'desc'), limit(50));
  }, [firestore, filter, user, actualRole, activeCompanyId]);

  const { data: problems = [], isLoading: isLoadingProblems } = useCollection<ProblemEntry>(problemsQuery);
  const { data: leads = [], isLoading: isLoadingLeads } = useCollection<Lead>(leadsQuery);

  const handleStatusUpdate = async (itemId: string, newStatus: any) => {
    if (!firestore) return;
    try {
      const docRef = doc(firestore, 'problems', itemId);
      updateDocumentNonBlocking(docRef, { status: newStatus });
      toast({ title: 'Status Updated' });
    } catch (error) {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  const getProblemStatusClasses = (status: ProblemEntry['status']): string => {
    switch (status) {
      case 'open': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'in_progress': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'resolved': return 'bg-green-500/10 text-green-700 border-green-500/20';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex justify-between items-end">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold font-headline tracking-tight">Activity Log</h1>
          <p className="text-muted-foreground text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            Monitoring {company?.name || 'Workspace'} operations.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setIsNewProblemDialogOpen(true)} variant="outline" size="sm" className="font-bold">
            <ShieldAlert className="mr-2 h-4 w-4" /> Log Problem
          </Button>
          <Button onClick={() => setIsNewLeadDialogOpen(true)} size="sm" className="font-bold">
            <PlusCircle className="mr-2 h-4 w-4" /> New Lead
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <div className="flex justify-between items-center mb-4">
            <TabsList className="bg-muted/50">
                <TabsTrigger value="problems" className="gap-2 font-bold"><ShieldAlert className="h-4 w-4"/> Problems ({(problems || []).length})</TabsTrigger>
                <TabsTrigger value="leads" className="gap-2 font-bold"><Lightbulb className="h-4 w-4"/> Leads ({(leads || []).length})</TabsTrigger>
            </TabsList>
            
            <div className="flex items-center gap-2">
                <Label htmlFor="filter-select" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Scope:</Label>
                <Select value={filter} onValueChange={(v) => setFilter(v as 'all' | 'mine')}>
                    <SelectTrigger id="filter-select" className="h-8 w-[130px] text-xs font-bold">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">{isSuperadmin ? 'Global Access' : 'Company Items'}</SelectItem>
                        <SelectItem value="mine">My Items Only</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>

        <TabsContent value="problems" className="mt-0">
            <Card className="shadow-lg">
                <CardContent className="p-0">
                    <ScrollArea className="h-[600px] w-full">
                        <Table>
                            <TableBody>
                                {isLoadingProblems ? (
                                    <TableRow><TableCell className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                                ) : (problems || []).length > 0 ? (
                                    problems.map((p) => (
                                        <TableRow key={p.id} className="hover:bg-muted/30">
                                            <TableCell className="py-4">
                                                <div className="flex justify-between items-start">
                                                    <div className="space-y-1.5">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <ConnoteLink connote={p.consignmentNumber} />
                                                            <Badge variant="outline" className="text-[9px] uppercase tracking-tighter font-bold">{p.carrier}</Badge>
                                                            {p.customerImpacted && <Badge variant="secondary" className="text-[9px] uppercase tracking-tighter font-bold">{p.customerImpacted}</Badge>}
                                                        </div>
                                                        <p className="text-sm font-medium leading-tight">{p.description}</p>
                                                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">
                                                            Logged {p.date ? format(parseISO(p.date), 'dd MMM') : '--'} by {p.reportedBy?.split('@')[0] || 'Unknown'}
                                                        </p>
                                                    </div>
                                                    <Select value={p.status} onValueChange={(s) => handleStatusUpdate(p.id, s)}>
                                                        <SelectTrigger className={cn("w-[120px] h-7 text-[10px] uppercase font-black tracking-widest", getProblemStatusClasses(p.status))}>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {PROBLEM_STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize text-xs font-bold">{s.replace('_', ' ')}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell className="text-center py-20 text-muted-foreground italic">No problems logged for this scope.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="leads" className="mt-0">
            <Card className="shadow-lg">
                <CardContent className="p-0">
                    <ScrollArea className="h-[600px] w-full">
                        <Table>
                            <TableBody>
                                {isLoadingLeads ? (
                                    <TableRow><TableCell className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                                ) : (leads || []).length > 0 ? (
                                    leads.map((l) => (
                                        <TableRow key={l.id} className="hover:bg-muted/30">
                                            <TableCell className="py-4">
                                                <div className="flex justify-between items-start">
                                                    <div className="space-y-1.5">
                                                        <h4 className="font-bold text-base flex items-center gap-2 text-primary">
                                                            <Building2 className="h-4 w-4" />
                                                            {l.companyName}
                                                        </h4>
                                                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                                                            <span className="flex items-center gap-1"><User className="h-3 w-3"/> {l.firstName} {l.lastName}</span>
                                                            <Separator orientation="vertical" className="h-3" />
                                                            <span className="flex items-center gap-1"><MapPin className="h-3 w-3"/> {l.suburb} {l.state}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-2">
                                                            <Badge variant="outline" className="text-[9px] uppercase tracking-widest font-black">{l.businessUnit}</Badge>
                                                            <Badge variant="secondary" className="text-[9px] uppercase tracking-widest font-black">{l.status?.replace('_', ' ')}</Badge>
                                                        </div>
                                                    </div>
                                                    <div className="text-right space-y-1">
                                                        <p className="text-lg font-bold text-primary font-mono">${l.estimatedValue?.toLocaleString() || '0'}</p>
                                                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Updated {l.date ? format(parseISO(l.date), 'dd MMM') : '--'}</p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell className="text-center py-20 text-muted-foreground italic">No sales leads found for this scope.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>

      <NewProblemDialog isOpen={isNewProblemDialogOpen} onOpenChange={setIsNewProblemDialogOpen} />
      <NewLeadDialog isOpen={isNewLeadDialogOpen} onOpenChange={setIsNewLeadDialogOpen} />
    </div>
  );
}

"use client";

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/context/SessionContext';
import { useAuth, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import ReportLauncher from '@/components/dashboard/ReportLauncher';
import ActivityFeed from '@/components/dashboard/ActivityFeed';
import { useSettings } from '@/context/SettingsContext';
import { format, isValid } from 'date-fns';
import { updateFuelSurcharges } from '@/ai/flows/update-fuel-surcharges-flow';
import { generateBusinessPulse } from '@/ai/flows/dashboard-pulse-flow';
import { Badge } from '@/components/ui/badge';
import DashboardCalculator from '@/components/dashboard/DashboardCalculator';

import {
  Fuel,
  ShieldCheck,
  Loader2,
  RefreshCw,
  TrendingUp,
  BrainCircuit,
  Settings2
} from 'lucide-react';

const FuelSecurityWidget = () => {
  const { 
    standardFuelSurcharge, priorityFuelSurcharge, palletFuelSurcharge, 
    globalSecuritySurchargePercent, updateGroupFuelSurcharge,
    standardFuelLastUpdated,
    saveSettingsToServer
  } = useSettings();
  const { addTokens } = useSession();
  const [isFetchingFuel, setIsFetchingFuel] = useState(false);
  const { toast } = useToast();

  const handleFetchLatestFuelRates = async () => {
    setIsFetchingFuel(true);
    toast({ title: "Connecting to TGE...", description: "Fetching live fuel rates." });

    try {
      const { update, success, error, usage } = await updateFuelSurcharges();
      if (!success) throw new Error(error || "Fetch failed");
      
      addTokens(usage.totalTokens);
      
      updateGroupFuelSurcharge('pallet', update.pallet, update.lastUpdated);
      updateGroupFuelSurcharge('standard', update.road, update.lastUpdated);
      updateGroupFuelSurcharge('priority', update.air, update.lastUpdated);
      
      await saveSettingsToServer('LCPTGE');
      toast({ title: "Rates Updated", variant: "default" });
    } catch(error) {
       toast({ title: "Fetch Failed", variant: "destructive" });
    } finally {
      setIsFetchingFuel(false);
    }
  };

  const lastUpdatedDate = standardFuelLastUpdated ? new Date(standardFuelLastUpdated) : null;

  return (
    <Card className="shadow-md">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
            <CardTitle className="text-lg text-primary">Live Rates</CardTitle>
             {lastUpdatedDate && isValid(lastUpdatedDate) && (
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">
                    Persistent: {format(lastUpdatedDate, 'dd MMM')}
                </p>
             )}
        </div>
         <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleFetchLatestFuelRates} disabled={isFetchingFuel}>
            {isFetchingFuel ? <Loader2 className="h-4 w-4 animate-spin"/> : <RefreshCw className="h-4 w-4"/>}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 pt-2">
        <div className="grid grid-cols-3 gap-2">
            <div className="p-2 rounded bg-muted/30 text-center">
                <p className="text-[9px] uppercase text-muted-foreground font-bold">Standard</p>
                <p className="text-sm font-bold">{standardFuelSurcharge.toFixed(2)}%</p>
            </div>
            <div className="p-2 rounded bg-muted/30 text-center">
                <p className="text-[9px] uppercase text-muted-foreground font-bold">Priority</p>
                <p className="text-sm font-bold">{priorityFuelSurcharge.toFixed(2)}%</p>
            </div>
            <div className="p-2 rounded bg-muted/30 text-center">
                <p className="text-[9px] uppercase text-muted-foreground font-bold">Pallet</p>
                <p className="text-sm font-bold">{palletFuelSurcharge.toFixed(2)}%</p>
            </div>
        </div>
        <div className="flex items-center justify-between p-2 rounded-md bg-primary/5 border border-primary/10">
          <div className="flex items-center">
            <ShieldCheck className="mr-2 h-4 w-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-tight">Global Security</span>
          </div>
          <div className="text-sm font-bold text-primary">
            {globalSecuritySurchargePercent.toFixed(2)}%
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const AIPulseWidget = ({ activityItems }: { activityItems: any[] }) => {
    const { company } = useAuth();
    const [pulse, setPulse] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const hasRun = React.useRef(false);

    const runPulse = async () => {
        if (activityItems.length === 0) return;
        setIsLoading(true);
        try {
            const summary = activityItems.slice(0, 10).map(i => `[${i.type}] ${i.title}: ${i.subtitle}`).join('\n');
            const result = await generateBusinessPulse({ 
                activitySummary: summary, 
                companyName: company?.name || 'FreightAssist.Online' 
            });
            setPulse(result);
        } catch (e) {
            console.error("Pulse error:", e);
        } finally {
            setIsLoading(false);
        }
    };

    React.useEffect(() => {
        if (activityItems.length > 0 && !hasRun.current && !isLoading && !pulse) {
            hasRun.current = true;
            runPulse();
        }
    }, [activityItems, isLoading, pulse]);

    return (
        <Card className="bg-accent/5 border-accent/20 border shadow-md overflow-hidden">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-widest text-accent">
                    <BrainCircuit className="h-4 w-4" />
                    Strategic Pulse
                </CardTitle>
                <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={runPulse} disabled={isLoading || activityItems.length === 0}>
                    {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                </Button>
            </CardHeader>
            <CardContent>
                {pulse ? (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                        <div className="flex items-start gap-2">
                            <Badge variant={pulse.sentiment === 'warning' ? 'destructive' : 'default'} className="mt-0.5 text-[8px] h-4">
                                {pulse.sentiment}
                            </Badge>
                            <p className="text-sm font-bold leading-tight">{pulse.headline}</p>
                        </div>
                        <p className="text-xs text-muted-foreground italic leading-relaxed border-l-2 border-accent/30 pl-2">
                            "{pulse.recommendation}"
                        </p>
                    </div>
                ) : (
                    <div className="py-4 text-center space-y-2">
                        {isLoading ? (
                            <p className="text-xs text-muted-foreground italic flex items-center justify-center gap-2">
                                <Loader2 className="h-3 w-3 animate-spin" /> Analyzing recent trends...
                            </p>
                        ) : activityItems.length > 0 ? (
                            <p className="text-xs text-muted-foreground italic">Ready for strategic analysis.</p>
                        ) : (
                            <p className="text-xs text-muted-foreground italic">Awaiting activity data...</p>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default function DashboardPageContent() {
    const { profile, company, role, actualRole, tokenCompanyId } = useAuth();
    const firestore = useFirestore();
    
    // CRITICAL: Derive active company context primarily from the Security Token
    // This ensures query filters always match what the Firestore rules are expecting.
    const activeCompanyId = actualRole === 'superadmin' ? (company?.id || profile?.companyId) : tokenCompanyId;

    const problemsQ = useMemoFirebase(() => {
        if (!firestore || !activeCompanyId) return null;
        const base = collection(firestore, 'problems');
        const q = actualRole === 'superadmin' ? base : query(base, where('companyId', '==', activeCompanyId));
        return query(q, orderBy('date', 'desc'), limit(15));
    }, [firestore, activeCompanyId, actualRole]);

    const quotesQ = useMemoFirebase(() => {
        if (!firestore || !activeCompanyId) return null;
        const base = collection(firestore, 'ai_quotes');
        const q = actualRole === 'superadmin' ? base : query(base, where('companyId', '==', activeCompanyId));
        return query(q, orderBy('createdAt', 'desc'), limit(10));
    }, [firestore, activeCompanyId, actualRole]);

    const { data: problems = [], isLoading: loadingProblems } = useCollection(problemsQ);
    const { data: quotes = [], isLoading: loadingQuotes } = useCollection(quotesQ);

    const mergedActivity = useMemo(() => {
        const parseDate = (ts: any) => {
            if (!ts) return new Date(0);
            if (typeof ts === 'string') return new Date(ts);
            if (ts?.toDate) return ts.toDate();
            if (ts?.seconds) return new Date(ts.seconds * 1000);
            return new Date(ts);
        };

        const items: any[] = [
            ...(problems || []).map(p => ({ id: p.id, type: 'problem' as const, title: p.consignmentNumber, subtitle: p.description, timestamp: parseDate(p.date), user: p.reportedBy })),
            ...(quotes || []).map(q => ({ id: q.id, type: 'quote' as const, title: `AI Quote: ${q.results?.[0]?.serviceName || 'Pricing'}`, subtitle: q.query, timestamp: parseDate(q.createdAt), user: q.userId }))
        ];
        return items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }, [problems, quotes]);

    return (
        <div className="space-y-8 pb-20">
            <div className="flex justify-between items-end">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold font-headline tracking-tight">Command Center</h1>
                    <p className="text-muted-foreground text-sm flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        Operational status: <span className="font-bold text-foreground">Optimal</span>
                    </p>
                </div>
                <div className="hidden md:flex gap-2">
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/status"><Settings2 className="mr-2 h-4 w-4" /> System Health</Link>
                    </Button>
                </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-3 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <DashboardCalculator />
                        <div className="space-y-6">
                            <AIPulseWidget activityItems={mergedActivity} />
                            <FuelSecurityWidget />
                        </div>
                    </div>
                    <ReportLauncher />
                </div>
                
                <div className="lg:col-span-1">
                    <ActivityFeed 
                        items={mergedActivity} 
                        isLoading={loadingProblems || loadingQuotes} 
                    />
                </div>
            </div>
        </div>
    );
}
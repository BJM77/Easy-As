"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/context/SessionContext';
import { useAuth, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import ReportLauncher from '@/components/dashboard/ReportLauncher';
import { useSettings } from '@/context/SettingsContext';
import { format } from 'date-fns';
import { updateFuelSurcharges } from '@/ai/flows/update-fuel-surcharges-flow';
import { generateBusinessPulse } from '@/ai/flows/dashboard-pulse-flow';
import { Badge } from '@/components/ui/badge';
import DashboardCalculator from '@/components/dashboard/DashboardCalculator';
import { cn } from '@/lib/utils';
import QuickActionsConfigDialog, { ALL_QUICK_ACTIONS_MAP } from '@/components/dashboard/QuickActionsConfigDialog';
import NewProblemDialog from '@/components/NewProblemDialog';
import NewLeadDialog from '@/components/NewLeadDialog';

import {
  Fuel,
  ShieldCheck,
  Loader2,
  RefreshCw,
  TrendingUp,
  BrainCircuit,
  Settings2,
  Sparkles,
  ArrowRight,
  Calculator as CalculatorIcon,
  Zap,
  Activity,
  User as UserIcon,
  ChevronRight,
  Shield,
  AlertTriangle,
  History,
  LayoutGrid,
  Clock
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
      const result = await updateFuelSurcharges();
      const { update, success, error, usage } = result;

      if (!success) {
        throw new Error(error || "Fetch failed");
      }
      
      if (usage && usage.totalTokens > 0) {
        addTokens(usage.totalTokens);
      }
      
      if (update) {
          updateGroupFuelSurcharge('pallet', update.pallet, update.lastUpdated);
          updateGroupFuelSurcharge('standard', update.road, update.lastUpdated);
          updateGroupFuelSurcharge('priority', update.air, update.lastUpdated);
          
          await saveSettingsToServer('LCPTGE');
          
          toast({ 
            title: "Rates Updated", 
            description: `Live data retrieved for ${format(new Date(update.lastUpdated), 'dd MMM')}.`,
            variant: "default" 
          });
      }
    } catch(error: any) {
       console.error("[Dashboard Fuel Fetch Error]", error);
       toast({ 
         title: "Update Required", 
         description: error.message || "Manual adjustment recommended.", 
         variant: "destructive" 
       });
    } finally {
      setIsFetchingFuel(false);
    }
  };

  return (
    <Card className="shadow-md overflow-hidden border-none bg-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2 p-4 bg-muted/20 border-b">
        <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Fuel className="h-3.5 w-3.5" />
            Live Rates
        </CardTitle>
         <Button size="sm" variant="ghost" className="h-6 w-6 p-0 rounded-full" onClick={handleFetchLatestFuelRates} disabled={isFetchingFuel}>
            {isFetchingFuel ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
        </Button>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 rounded bg-muted/30 border border-border/50">
                <p className="text-[8px] uppercase text-muted-foreground font-black mb-1">Std</p>
                <p className="text-xs font-bold font-mono">{standardFuelSurcharge.toFixed(2)}%</p>
            </div>
            <div className="text-center p-2 rounded bg-muted/30 border border-border/50">
                <p className="text-[8px] uppercase text-muted-foreground font-black mb-1">Prio</p>
                <p className="text-xs font-bold font-mono">{priorityFuelSurcharge.toFixed(2)}%</p>
            </div>
            <div className="text-center p-2 rounded bg-muted/30 border border-border/50">
                <p className="text-[8px] uppercase text-muted-foreground font-black mb-1">Pallet</p>
                <p className="text-xs font-bold font-mono">{palletFuelSurcharge.toFixed(2)}%</p>
            </div>
        </div>
        <div className="p-2 rounded bg-primary/5 border border-primary/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <span className="text-[9px] font-black uppercase tracking-widest text-primary">Security</span>
          </div>
          <span className="text-xs font-bold text-primary font-mono">{globalSecuritySurchargePercent.toFixed(2)}%</span>
        </div>
        {standardFuelLastUpdated && (
          <div className="pt-1 flex items-center justify-center gap-1 text-[8px] text-muted-foreground uppercase font-black tracking-widest">
            <Clock className="h-2 w-2" />
            Last Updated: {format(new Date(standardFuelLastUpdated), 'dd MMM HH:mm')}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const AIPulseWidget = ({ activityItems }: { activityItems: any[] }) => {
    const { company } = useAuth();
    const [pulse, setPulse] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const hasTriggeredRef = useRef(false);

    const runPulse = async () => {
        if (activityItems.length === 0) return;
        setIsLoading(true);
        try {
            const summary = activityItems.slice(0, 15).map(i => `[${i.type}] ${i.title}: ${i.subtitle}`).join('\n');
            const result = await generateBusinessPulse({ 
                activitySummary: summary, 
                companyName: company?.name || 'LedgerLight'
            });
            setPulse(result);
        } catch (e: any) {
            setPulse({
              headline: "Pulse Offline",
              sentiment: 'warning',
              recommendation: "Strategic analysis unavailable."
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (activityItems.length > 0 && !pulse && !isLoading && !hasTriggeredRef.current && company) {
            hasTriggeredRef.current = true;
            runPulse();
        }
    }, [activityItems, pulse, isLoading, company]);

    return (
        <Card className="bg-accent/5 border-accent/20 border shadow-md overflow-hidden">
            <CardHeader className="pb-2 p-4 flex flex-row items-center justify-between bg-accent/5 border-b border-accent/10">
                <CardTitle className="text-xs font-black text-primary uppercase tracking-widest flex items-center gap-2">
                    <BrainCircuit className="h-3.5 w-3.5" />
                    Strategic Pulse
                </CardTitle>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-full" onClick={runPulse} disabled={isLoading || activityItems.length === 0}>
                    {isLoading ? <Loader2 className="h-3 w-3 animate-spin text-primary" /> : <RefreshCw className="h-3 w-3" />}
                </Button>
            </CardHeader>
            <CardContent className="p-6 min-h-[80px] flex flex-col justify-center">
                {isLoading ? (
                    <div className="flex items-center gap-2 animate-pulse">
                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Analyzing Workspace Data...</span>
                    </div>
                ) : pulse ? (
                    <div className="space-y-2 animate-in fade-in slide-in-from-bottom-1 duration-500">
                        <p className="text-sm font-bold leading-tight text-primary font-headline">{pulse.headline}</p>
                        <p className="text-xs text-muted-foreground italic leading-relaxed">
                            {pulse.recommendation}
                        </p>
                    </div>
                ) : (
                    <p className="text-xs text-muted-foreground italic">Identify patterns and strategic opportunities in your recent workspace activity.</p>
                )}
            </CardContent>
        </Card>
    );
};

const QuickActionsSidebar = ({ onConfigOpen, onProblemOpen, onLeadOpen }: { onConfigOpen: () => void, onProblemOpen: () => void, onLeadOpen: () => void }) => {
  const { quickActions } = useSettings();
  const router = useRouter();

  return (
    <Card className="shadow-md border-none bg-primary/5">
      <CardHeader className="pb-2 p-4 border-b border-primary/10 flex flex-row items-center justify-between">
        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
          <LayoutGrid className="h-3.5 w-3.5" />
          Quick Actions
        </CardTitle>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-full" onClick={onConfigOpen}>
            <Settings2 className="h-3.5 w-3.5 text-primary" />
        </Button>
      </CardHeader>
      <CardContent className="p-2 grid grid-cols-2 gap-1.5">
        {quickActions.slice(0, 4).map(key => {
          const action = ALL_QUICK_ACTIONS_MAP[key];
          if (!action) return null;
          const Icon = action.icon;
          return (
            <Button 
              key={key} 
              variant="ghost" 
              size="sm" 
              className="h-14 flex-col gap-1 justify-center bg-background border hover:bg-primary/10 hover:text-primary transition-all group"
              onClick={() => {
                if (action.isDialog) {
                  if (key === 'problem-log') onProblemOpen();
                  else if (key === 'new-lead') onLeadOpen();
                } else if (action.href) {
                  if (action.href.startsWith('http')) {
                    window.open(action.href, '_blank');
                  } else {
                    router.push(action.href);
                  }
                }
              }}
            >
              <Icon className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
              <span className="text-[9px] font-bold uppercase truncate w-full">{action.label}</span>
            </Button>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default function DashboardPageContent() {
    const { profile, company, actualRole, tokenCompanyId, loading: authLoading } = useAuth();
    const { quickActions, setQuickActions, isLoadingSettings } = useSettings();
    const firestore = useFirestore();
    const router = useRouter();
    const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
    const [isProblemDialogOpen, setIsProblemDialogOpen] = useState(false);
    const [isLeadDialogOpen, setIsLeadDialogOpen] = useState(false);
    
    if (authLoading || isLoadingSettings) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
                <div className="text-center space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary animate-pulse">Initializing Command Center...</p>
                    <p className="text-[9px] text-muted-foreground">Checking authentication and global settings</p>
                </div>
                
                {(authLoading || isLoadingSettings) && (
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="mt-8 text-[9px] font-bold opacity-30 hover:opacity-100 uppercase tracking-tighter"
                        onClick={() => {
                            console.warn("User manually bypassed initialization hang.");
                            // Force page to render by tricking the conditional if possible, 
                            // but since this is a local component state we can't easily force it 
                            // without adding a 'forceRender' state. Let's just suggest a refresh or wait.
                        }}
                    >
                        Taking too long? Try refreshing or check your connection.
                    </Button>
                )}
            </div>
        );
    }
    
    const activeCompanyId = actualRole === 'superadmin' ? (company?.id || profile?.companyId) : (tokenCompanyId || profile?.companyId);

    const problemsQ = useMemoFirebase(() => {
        if (!firestore || !activeCompanyId) return null;
        const baseQuery = collection(firestore, 'problems');
        const q = actualRole === 'superadmin' ? baseQuery : query(baseQuery, where('companyId', '==', activeCompanyId));
        return query(q, orderBy('date', 'desc'), limit(10));
    }, [firestore, activeCompanyId, actualRole]);

    const quotesQ = useMemoFirebase(() => {
        if (!firestore || !activeCompanyId) return null;
        const baseQuery = collection(firestore, 'quote_logs');
        const q = actualRole === 'superadmin' ? baseQuery : query(baseQuery, where('companyId', '==', activeCompanyId));
        return query(q, orderBy('timestamp', 'desc'), limit(15));
    }, [firestore, activeCompanyId, actualRole]);

    const { data: problems = [] } = useCollection(problemsQ);
    const { data: auditLogs = [] } = useCollection(quotesQ);

    const mergedActivity = useMemo(() => {
        const parseDate = (ts: any) => {
            if (!ts) return new Date(0);
            if (typeof ts === 'string') return new Date(ts);
            if (ts?.toDate) return ts.toDate();
            if (ts?.seconds) return new Date(ts.seconds * 1000);
            return new Date(ts);
        };

        const items: any[] = [
            ...(problems || []).map(p => ({ id: p.id, type: 'problem' as const, title: p.consignmentNumber, subtitle: p.description, timestamp: parseDate(p.date) })),
            ...(auditLogs || []).map(l => ({ id: l.id, type: 'quote' as const, title: `${l.origin} &gt; ${l.destination}`, subtitle: `${l.service}: ${l.chargeWeight}kg`, timestamp: parseDate(l.timestamp) }))
        ];
        return items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }, [problems, auditLogs]);

    return (
        <div className="space-y-6 pb-20">
            <div className="flex justify-between items-end">
                <div className="space-y-0.5">
                    <h1 className="text-2xl md:text-3xl font-bold font-headline tracking-tight text-primary">Command Center</h1>
                    <p className="text-muted-foreground text-xs flex items-center gap-2">
                        <TrendingUp className="h-3 w-3 text-green-500" />
                        Workspace: <span className="font-bold text-foreground capitalize">{company?.name || 'System'}</span>
                    </p>
                </div>
                <div className="hidden md:flex gap-2">
                    <Button variant="outline" size="sm" asChild className="h-7 text-[9px] font-black uppercase tracking-widest">
                        <Link href="/status"><Activity className="mr-1.5 h-3.5 w-3.5" /> System Health</Link>
                    </Button>
                </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-8 space-y-6">
                    <DashboardCalculator />
                    <ReportLauncher />
                </div>

                <div className="lg:col-span-4 space-y-4">
                    <QuickActionsSidebar 
                        onConfigOpen={() => setIsConfigDialogOpen(true)} 
                        onProblemOpen={() => setIsProblemDialogOpen(true)} 
                        onLeadOpen={() => setIsLeadDialogOpen(true)}
                    />
                    <FuelSecurityWidget />
                </div>
            </div>

            <div className="pt-2">
                <AIPulseWidget activityItems={mergedActivity} />
            </div>

            <QuickActionsConfigDialog
                isOpen={isConfigDialogOpen}
                onOpenChange={setIsConfigDialogOpen}
                currentActions={quickActions}
                onSave={setQuickActions}
            />
            
            <NewProblemDialog 
                isOpen={isProblemDialogOpen}
                onOpenChange={setIsProblemDialogOpen}
            />

            <NewLeadDialog 
                isOpen={isLeadDialogOpen}
                onOpenChange={setIsLeadDialogOpen}
            />
        </div>
    );
}

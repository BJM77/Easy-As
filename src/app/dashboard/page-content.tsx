"use client";

import React, { useState, useMemo } from 'react';
import { useAuth, useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Settings2, 
  Loader2, 
  TrendingUp,
  Activity,
  Calculator,
  BrainCircuit,
  MessageSquareWarning,
  Search,
  ArrowRight
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useSettings } from '@/context/SettingsContext';
import Link from 'next/link';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import  NewProblemDialog  from '@/components/NewProblemDialog';
import  NewLeadDialog  from '@/components/NewLeadDialog';
import QuickActionsConfigDialog from '@/components/dashboard/QuickActionsConfigDialog';
import DashboardCalculator from '@/components/dashboard/DashboardCalculator';
import ReportLauncher from '@/components/dashboard/ReportLauncher';
import { FuelSecurityWidget } from '@/components/dashboard/FuelSecurityWidget';
import { AIPulseWidget } from '@/components/dashboard/AIPulseWidget';
import type { QuickActionKey } from '@/lib/types';

const ALL_QUICK_ACTIONS_MAP: Record<string, { label: string, icon: any, href?: string, isDialog?: boolean }> = {
  'calculator': { label: 'Calculator', icon: Calculator, href: '/calculator' },
  'ai-guru': { label: 'AI Guru', icon: BrainCircuit, href: '/ai-guru' },
  'problem-log': { label: 'Log Problem', icon: MessageSquareWarning, isDialog: true },
  'location-lookup': { label: 'Locations', icon: Search, href: '/location-lookup' },
  'new-lead': { label: 'New Lead', icon: ArrowRight, isDialog: true }
};

const QuickActionsSidebar = ({ 
  onConfigOpen, 
  onProblemOpen, 
  onLeadOpen 
}: { 
  onConfigOpen: () => void, 
  onProblemOpen: () => void, 
  onLeadOpen: () => void 
}) => {
  const { quickActions } = useSettings();
  const router = useRouter();

  return (
    <Card className="shadow-lg border-none bg-card/50 backdrop-blur-sm">
      <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Quick Access</CardTitle>
        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-50 hover:opacity-100" onClick={onConfigOpen}>
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
    const [forceReady, setForceReady] = useState(false);
    
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
            ...(auditLogs || []).map(l => ({ id: l.id, type: 'quote' as const, title: `${l.origin} > ${l.destination}`, subtitle: `${l.service}: ${l.chargeWeight}kg`, timestamp: parseDate(l.timestamp) }))
        ];
        return items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }, [problems, auditLogs]);

    if ((authLoading || isLoadingSettings) && !forceReady) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
                <div className="text-center space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary animate-pulse">Initializing Command Center...</p>
                    <p className="text-[9px] text-muted-foreground">Checking authentication and global settings</p>
                </div>
                
                <Button 
                    variant="ghost" 
                    size="sm" 
                    className="mt-8 text-[9px] font-bold opacity-30 hover:opacity-100 uppercase tracking-tighter"
                    onClick={() => {
                        console.warn("User manually bypassed initialization hang.");
                        setForceReady(true);
                    }}
                >
                    Taking too long? Click here to bypass loading.
                </Button>
            </div>
        );
    }

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

            <div className="grid grid-cols-1 gap-6">
                <ReportLauncher />
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


"use client";

import React, { useMemo } from 'react';
import { useAuth, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import ActivityFeed from '@/components/dashboard/ActivityFeed';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, ShieldCheck, TrendingUp, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function AdminActivityPulsePageContent() {
    const { profile, company, actualRole, tokenCompanyId } = useAuth();
    const firestore = useFirestore();
    
    const activeCompanyId = actualRole === 'superadmin' ? (company?.id || profile?.companyId) : (tokenCompanyId || profile?.companyId);

    const problemsQ = useMemoFirebase(() => {
        if (!firestore || !activeCompanyId) return null;
        const base = collection(firestore, 'problems');
        const q = actualRole === 'superadmin' ? base : query(base, where('companyId', '==', activeCompanyId));
        return query(q, orderBy('date', 'desc'), limit(50));
    }, [firestore, activeCompanyId, actualRole]);

    const quotesQ = useMemoFirebase(() => {
        if (!firestore || !activeCompanyId) return null;
        const base = collection(firestore, 'ai_quotes');
        const q = actualRole === 'superadmin' ? base : query(base, where('companyId', '==', activeCompanyId));
        return query(q, orderBy('createdAt', 'desc'), limit(50));
    }, [firestore, activeCompanyId, actualRole]);

    const logsQ = useMemoFirebase(() => {
        if (!firestore || !activeCompanyId || actualRole !== 'superadmin') return null;
        return query(collection(firestore, 'quote_logs'), orderBy('timestamp', 'desc'), limit(50));
    }, [firestore, activeCompanyId, actualRole]);

    const { data: problems = [], isLoading: loadingProblems } = useCollection(problemsQ);
    const { data: quotes = [], isLoading: loadingQuotes } = useCollection(quotesQ);
    const { data: auditLogs = [], isLoading: loadingAudit } = useCollection(logsQ);

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
            ...(quotes || []).map(q => ({ id: q.id, type: 'quote' as const, title: `AI Quote: ${q.results?.[0]?.serviceName || 'Pricing'}`, subtitle: q.query, timestamp: parseDate(q.createdAt), user: q.userId })),
            ...(auditLogs || []).map(l => ({ id: l.id, type: 'quote' as const, title: `Quote Run: ${l.origin} > ${l.destination}`, subtitle: `${l.service}: ${l.chargeWeight}kg`, timestamp: parseDate(l.timestamp), user: l.userEmail }))
        ];
        return items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }, [problems, quotes, auditLogs]);

    if (actualRole !== 'superadmin') {
        return <div className="p-20 text-center">Unauthorized. Superadmin only.</div>;
    }

    return (
        <div className="space-y-8 max-w-5xl mx-auto pb-20">
            <Card className="shadow-xl border-t-4 border-primary">
                <CardHeader>
                    <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                        <div>
                            <CardTitle className="text-2xl font-headline flex items-center">
                                <Activity className="mr-2 h-7 w-7 text-primary" />
                                Global Activity Pulse
                            </CardTitle>
                            <CardDescription>
                                Centralized real-time monitoring of all organization events, quotes, and service issues.
                            </CardDescription>
                        </div>
                        <Badge variant="outline" className="bg-primary/5 text-primary">Live Context: {activeCompanyId || 'Global'}</Badge>
                    </div>
                </CardHeader>
            </Card>

            <div className="grid grid-cols-1 gap-6">
                <ActivityFeed 
                    items={mergedActivity} 
                    isLoading={loadingProblems || loadingQuotes || loadingAudit} 
                />
            </div>
        </div>
    );
}


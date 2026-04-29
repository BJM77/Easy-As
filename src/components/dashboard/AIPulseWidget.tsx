"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/firebase';
import { generateBusinessPulse } from '@/ai/flows/dashboard-pulse-flow';
import { 
  BrainCircuit, 
  Loader2, 
  RefreshCw 
} from 'lucide-react';

export const AIPulseWidget = ({ activityItems }: { activityItems: any[] }) => {
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

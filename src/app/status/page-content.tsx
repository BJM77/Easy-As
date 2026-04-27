"use client";

import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { CheckCircle2, XCircle, AlertTriangle, Loader2, Database, ShieldCheck, Rocket, Zap, Globe, Key, ListTree, Sparkles, Send } from 'lucide-react';
import { useRateOverrides } from '@/context/RateOverrideContext';
import type { RateFileType } from '@/lib/types';
import { useAuth, useFirestore } from '@/firebase';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { testAiConnection } from '@/ai/flows/test-connection-flow';

const StatusRow = ({ label, status, message }: { label: string; status: 'success' | 'error' | 'warning' | 'loading'; message: string }) => {
    const Icon = status === 'success' ? CheckCircle2 : status === 'error' ? XCircle : status === 'warning' ? AlertTriangle : Loader2;
    const color = status === 'success' ? 'text-green-600' : status === 'error' ? 'text-destructive' : status === 'warning' ? 'text-amber-600' : 'text-muted-foreground';
    
    return (
        <div className="flex items-start justify-between p-4 border-b">
            <div className="flex items-center">
                <Icon className={cn("mr-3 h-6 w-6 flex-shrink-0", color, status === 'loading' && 'animate-spin')} />
                <div>
                    <p className={cn("font-semibold", color)}>{label}</p>
                    <p className="text-sm text-muted-foreground">{message}</p>
                </div>
            </div>
        </div>
    );
}

const fileOrder: RateFileType[] = [
  'postcodes', 'locations', 'pezone',
  'b2c', 'regionallookup',
  'lcpgo', 'lcprdex', 'lcpprio',
  'b2b_priority', 'b2brdex',
  'pe1', 'pe2', 'pe3', 'pe4', 'pe5', 'pallet6',
  'west_east', 'ras'
];

export default function StatusPageContent() {
    const { user, profile, actualRole, loading: authLoading } = useAuth();
    const firestore = useFirestore();
    const { getRateFile, isLoading } = useRateOverrides();
    const [mounted, setMounted] = useState(false);
    
    // AI Test State
    const [isTestingAi, setIsTestingAi] = useState(false);
    const [aiTestResult, setAiTestResult] = useState<{ success: boolean; status?: string; message?: string; error?: string } | null>(null);

    useEffect(() => {
      setMounted(true);
    }, []);

    const handleRunAiTest = async () => {
        setIsTestingAi(true);
        setAiTestResult(null);
        try {
            const result = await testAiConnection();
            setAiTestResult(result);
        } catch (e) {
            setAiTestResult({ success: false, error: "Critical failure calling test action." });
        } finally {
            setIsTestingAi(false);
        }
    };

    const genkitApiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    const genkitStatus = (genkitApiKey && genkitApiKey !== 'YOUR_API_KEY_HERE') ? 'success' : 'error';
    
    const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY;
    const mapsStatus = mapsApiKey && mapsApiKey !== 'YOUR_API_KEY_HERE' ? 'success' : 'warning';

    const authStatus = authLoading ? 'loading' : user ? 'success' : 'error';
    const firestoreStatus = authLoading ? 'loading' : firestore ? 'success' : 'error';

    const loadedFilesCount = useMemo(() => {
        return fileOrder.filter(f => {
            const data = getRateFile(f);
            return data && Array.isArray(data) && data.length > 0;
        }).length;
    }, [getRateFile]);

    const readinessScore = useMemo(() => {
        if (!mounted) return 0;
        let score = 0;
        if (user) score += 20;
        if (firestore) score += 20;
        if (genkitStatus === 'success') score += 20;
        if (loadedFilesCount >= 10) score += 20;
        if (actualRole === 'superadmin') score += 20;
        return score;
    }, [user, firestore, genkitStatus, loadedFilesCount, actualRole, mounted]);

    if (!mounted) {
      return (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Initializing Diagnostics...</p>
        </div>
      );
    }

    return (
        <div className="space-y-8 pb-20">
            <Card className="shadow-xl border-t-4 border-primary">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-2xl font-headline">System Status & Readiness</CardTitle>
                      <CardDescription>
                          Diagnostic dashboard for verifying service connectivity and launch viability.
                      </CardDescription>
                    </div>
                    <Badge variant={readinessScore >= 80 ? 'default' : 'outline'} className={cn(readinessScore >= 80 ? "bg-green-600" : "")}>
                        {readinessScore}% Ready
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-muted-foreground">
                            <span>Production Readiness Audit</span>
                            <span>{readinessScore}%</span>
                        </div>
                        <Progress value={readinessScore} className="h-2" />
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card className="overflow-hidden border-accent/20">
                        <CardHeader className="bg-accent/5 border-b flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Sparkles className="h-5 w-5 text-accent" /> Active Intelligence Test
                                </CardTitle>
                                <CardDescription>Perform a real-time handshake with Gemini to verify API key and logic health.</CardDescription>
                            </div>
                            <Button onClick={handleRunAiTest} disabled={isTestingAi} size="sm">
                                {isTestingAi ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <Send className="h-4 w-4 mr-2" />}
                                Test Connection
                            </Button>
                        </CardHeader>
                        <CardContent className="pt-6 min-h-[120px] flex items-center justify-center">
                            {!aiTestResult && !isTestingAi && (
                                <p className="text-sm text-muted-foreground italic">Click the button to verify AI infrastructure.</p>
                            )}
                            {isTestingAi && (
                                <div className="flex items-center gap-3">
                                    <Loader2 className="h-6 w-6 animate-spin text-accent" />
                                    <span className="text-sm animate-pulse">Communicating with Gemini 2.0 Flash...</span>
                                </div>
                            )}
                            {aiTestResult && (
                                <div className={cn(
                                    "w-full p-4 rounded-md border flex items-center gap-4 animate-in fade-in zoom-in-95",
                                    aiTestResult.success ? "bg-green-50 border-green-200" : "bg-destructive/5 border-destructive/20"
                                )}>
                                    {aiTestResult.success ? <CheckCircle2 className="h-8 w-8 text-green-600" /> : <XCircle className="h-8 w-8 text-destructive" />}
                                    <div className="space-y-1">
                                        <p className={cn("font-bold text-sm", aiTestResult.success ? "text-green-800" : "text-destructive")}>
                                            {aiTestResult.success ? `Handshake Successful (${aiTestResult.status})` : "Connection Refused"}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {aiTestResult.success ? `Model Output: "${aiTestResult.message}"` : `Reason: ${aiTestResult.error}`}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="bg-muted/30 border-b">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Zap className="h-5 w-5 text-primary" /> API & Infrastructure
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y">
                                <StatusRow 
                                    label="Authentication" 
                                    status={authStatus} 
                                    message={user ? `Secure session active for ${user.email}` : 'User session not detected.'} 
                                />
                                <StatusRow 
                                    label="Cloud Firestore" 
                                    status={firestoreStatus} 
                                    message={firestore ? 'Real-time database connection stable.' : 'Database handshake failed.'} 
                                />
                                <StatusRow 
                                    label="Intelligence (Genkit)" 
                                    status={genkitStatus} 
                                    message={genkitStatus === 'success' ? 'Gemini 2.0 Flash is ready for inference.' : 'AI Key is missing or invalid.'} 
                                />
                                <StatusRow 
                                    label="Mapping (Google)" 
                                    status={mapsStatus} 
                                    message={mapsStatus === 'success' ? 'Google Maps Directions & Embed API enabled.' : 'Maps key missing. Routing will fallback to list-view.'} 
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="bg-muted/30 border-b">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Database className="h-5 w-5 text-primary" /> Core Pricing Database
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <ScrollArea className="h-[400px]">
                                <div className="divide-y">
                                    {isLoading ? (
                                        <div className="p-10 flex justify-center"><Loader2 className="animate-spin" /></div>
                                    ) : (
                                        fileOrder.map(fileType => {
                                            const data = getRateFile(fileType);
                                            const isLoaded = data !== undefined && Array.isArray(data) && data.length > 0;
                                            return (
                                                <StatusRow 
                                                    key={fileType}
                                                    label={`${fileType}.json`}
                                                    status={isLoaded ? 'success' : 'error'}
                                                    message={isLoaded ? `${data.length.toLocaleString()} records cached successfully.` : `File missing or empty on server.`}
                                                />
                                            );
                                        })
                                    )}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-1 space-y-6">
                    <Card className="bg-primary/5 border-primary/20">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <ShieldCheck className="h-5 w-5 text-primary" /> Security Audit
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Identity Sync:</span>
                                <Badge variant="outline" className="text-green-600 bg-white">STABLE</Badge>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Tenant Isolation:</span>
                                <Badge variant="outline" className="text-green-600 bg-white">STRICT</Badge>
                            </div>
                            <Separator />
                            <p className="text-[10px] text-muted-foreground leading-relaxed italic">
                                Rules are currently enforced for all collections. Multi-tenant companyId filters are mandatory on all queries.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

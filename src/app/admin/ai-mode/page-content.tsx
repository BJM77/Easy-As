"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  BrainCircuit, 
  Activity, 
  CheckCircle2, 
  Loader2, 
  Terminal, 
  Play,
  AlertTriangle,
  Route,
  Calculator
} from 'lucide-react';
import { useAuth } from '@/firebase';
import { processQuoteQuery } from '@/ai/flows/quote-agent-flow';
import type { QuoteAgentOutput } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { cn, formatCurrency } from '@/lib/utils';

const LogicStep = ({ number, title, detail, status = 'success' }: { number: number; title: string; detail: string; status?: 'success' | 'warning' | 'error' }) => (
  <div className="flex gap-3 items-start group">
    <div className={cn(
      "h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 shadow-sm",
      status === 'success' ? "bg-green-100 text-green-700" : 
      status === 'warning' ? "bg-amber-100 text-amber-700" : "bg-destructive/10 text-destructive"
    )}>
      {number}
    </div>
    <div className="space-y-1">
      <p className="text-xs font-bold leading-tight uppercase tracking-tight">{title}</p>
      <p className="text-[11px] text-muted-foreground leading-relaxed italic">{detail}</p>
    </div>
  </div>
);

export default function AiModePageContent() {
  const { actualRole, user, profile } = useAuth();
  const { toast } = useToast();
  
  const [testQuery, setTestQuery] = useState("Price for 10kg from Perth 6000 to Sydney 2000");
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<QuoteAgentOutput | null>(null);
  const [latency, setLatency] = useState<number | null>(null);

  const isAuthorized = actualRole === 'superadmin';

  const runDiagnostic = async () => {
    if (!isAuthorized || !testQuery.trim()) return;
    setIsTesting(true);
    setTestResult(null);
    const start = performance.now();
    
    try {
      const result = await processQuoteQuery({ 
        query: testQuery,
        userId: user?.uid,
        companyId: profile?.companyId
      });
      
      const end = performance.now();
      setLatency(Math.round(end - start));
      setTestResult(result);
      toast({ title: "Diagnostic Complete" });
    } catch (error: any) {
      toast({ 
        title: "Diagnostic Failed", 
        description: error.message || "An error occurred.", 
        variant: "destructive" 
      });
    } finally {
      setIsTesting(false);
    }
  };

  if (!isAuthorized) {
    return <div className="p-20 text-center">Unauthorized. Superadmin only.</div>;
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20">
      <Card className="shadow-xl border-t-4 border-accent">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start gap-4">
            <div>
              <CardTitle className="text-2xl font-headline flex items-center">
                <BrainCircuit className="mr-2 h-7 w-7 text-accent" /> AI Mode: Enterprise Diagnostic
              </CardTitle>
              <CardDescription>
                Visualize the "Interpreter → Executor" handshake and verify pricing logic transparency.
              </CardDescription>
            </div>
            <Badge variant="outline" className="bg-accent/10 text-accent">Logic v3.0 (STABLE)</Badge>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Column */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Test Controller</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Natural Language Query</Label>
                <Textarea 
                  value={testQuery}
                  onChange={(e) => setTestQuery(e.target.value)}
                  placeholder="Ask for a price..."
                  className="min-h-[120px] font-medium text-xs leading-relaxed"
                />
              </div>
              <Button onClick={runDiagnostic} disabled={isTesting || !testQuery.trim()} className="w-full bg-accent hover:bg-accent/90">
                {isTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                Run Route Trace
              </Button>
            </CardContent>
            <CardFooter className="bg-muted/30 py-3 grid grid-cols-2 gap-2 text-center text-[10px] font-mono border-t">
              <div>LATENCY: {latency ? `${latency}ms` : '--'}</div>
              <div>AUTH: VERIFIED</div>
            </CardFooter>
          </Card>

          {testResult?.rawIntent && (
            <Card className="bg-slate-900 text-slate-100 border-none shadow-2xl overflow-hidden">
              <CardHeader className="pb-2 border-b border-white/10">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <Terminal className="h-3 w-3" /> Interpreter Step (AI)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[200px] w-full">
                  <pre className="p-4 text-[10px] leading-relaxed text-blue-300">
                    {JSON.stringify(testResult.rawIntent, null, 2)}
                  </pre>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Trace Column */}
        <div className="lg:col-span-2 space-y-6">
          {testResult ? (
            <>
              <Card>
                <CardHeader className="pb-3 bg-muted/10 border-b">
                  <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Route className="h-4 w-4" /> Deterministic Logic Trace (Executor)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                    {testResult.trace?.map((t) => (
                        <LogicStep 
                            key={t.step}
                            number={t.step}
                            title={t.title}
                            detail={t.detail}
                            status={t.status as any}
                        />
                    )) || (
                        <p className="text-xs text-muted-foreground italic">No dynamic trace data returned from agent.</p>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-accent flex items-center gap-2">
                        <Calculator className="h-3.5 w-3.5" /> Resolved Results
                    </h4>
                    <div className="border rounded-md overflow-hidden">
                        <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                            <TableHead className="text-[10px]">Service</TableHead>
                            <TableHead className="text-right text-[10px]">Price (inc. GST)</TableHead>
                            <TableHead className="text-[10px]">Formula Mapping</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {testResult.results?.map((res: any, i: number) => (
                            <TableRow key={i}>
                                <TableCell className="font-semibold text-xs">{res.serviceName}</TableCell>
                                <TableCell className="text-right font-mono text-primary font-bold text-xs">
                                    {formatCurrency(res.price)}
                                </TableCell>
                                <TableCell className="text-[10px] italic text-muted-foreground">
                                    {res.breakdown?.formula || 'Resolved via Tiered Table'}
                                </TableCell>
                            </TableRow>
                            ))}
                        </TableBody>
                        </Table>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {testResult.warnings && testResult.warnings.length > 0 && (
                <div className="p-4 bg-destructive/5 border-l-4 border-destructive rounded-r-md">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <p className="font-bold text-sm text-destructive">Accuracy Threshold Warning</p>
                  </div>
                  <div className="text-xs space-y-1">
                    {testResult.warnings.map((w, i) => <p key={i}>• {w}</p>)}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-32 text-muted-foreground border-2 border-dashed rounded-lg bg-muted/5">
              <Activity className="h-12 w-12 mb-4 opacity-10" />
              <p className="text-sm italic">Execute a model test to visualize the logic trace.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
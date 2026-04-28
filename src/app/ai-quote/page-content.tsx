"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Sparkles, 
  Send, 
  Loader2, 
  User, 
  Bot, 
  ArrowRightLeft, 
  Save, 
  AlertTriangle,
  History,
  Info,
  CheckCircle2,
  Route
} from 'lucide-react';
import { processQuoteQuery } from '@/ai/flows/quote-agent-flow';
import type { QuoteAgentOutput } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { cn, formatCurrency } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { useSettings } from '@/context/SettingsContext';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  data?: QuoteAgentOutput;
  timestamp: Date;
}

export default function AiQuotePageContent() {
  const router = useRouter();
  const { user, profile, actualRole, loading } = useAuth();
  const { serviceSettings, surchargeDefinitions } = useSettings();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isSuperadmin = actualRole === 'superadmin';

  useEffect(() => {
    if (scrollRef.current) {
        const scrollElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (scrollElement) {
            scrollElement.scrollTop = scrollElement.scrollHeight;
        }
    }
  }, [messages, isThinking]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isThinking) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    const currentHistory = messages.map(m => ({
      role: m.role,
      content: m.content
    }));

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsThinking(true);

    try {
      const apiKeyOverride = localStorage.getItem('gemini_api_key_override') || undefined;

      const result = await processQuoteQuery({ 
        query: input,
        history: currentHistory,
        userId: user?.uid,
        companyId: profile?.companyId,
        apiKey: apiKeyOverride,
        serviceSettings: serviceSettings ?? [],
        surchargeDefinitions: surchargeDefinitions ?? []
      });

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.summary,
        data: result,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      // If the result contains an error in the trace, surface it as a toast for the developer/admin
      const errorTrace = result.trace?.find(t => t.status === 'error');
      if (errorTrace) {
        console.error("Quote agent internal error:", errorTrace.detail);
        toast({ 
          title: errorTrace.title, 
          description: errorTrace.detail, 
          variant: "destructive" 
        });
      }

    } catch (error: any) {
      console.error("Quote agent transport error:", error);
      toast({ title: "Intelligence Error", description: error.message || "Failed to process request.", variant: "destructive" });
    } finally {
      setIsThinking(false);
    }
  };

  const handleRehydrate = (data: QuoteAgentOutput) => {
    if (!data?.resolvedInput) return;
    sessionStorage.setItem('rehydration_state', JSON.stringify(data.resolvedInput));
    router.push('/calculator');
    toast({ title: "Rehydrating Form", description: "Loading parameters into the calculator..." });
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-10rem)] flex flex-col gap-6">
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-2xl font-bold font-headline flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-accent" />
            Autonomous Quote Assistant
          </h1>
          <p className="text-muted-foreground text-sm">Deterministic intelligence mapped directly to production data.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setMessages([])}>
          <History className="mr-2 h-4 w-4" /> Reset Chat
        </Button>
      </div>

      <Card className="flex-grow overflow-hidden flex flex-col shadow-2xl border-none bg-muted/20">
        <CardContent className="flex-grow overflow-hidden p-0">
          <ScrollArea className="h-full p-4 md:p-8" ref={scrollRef}>
            <div className="space-y-10">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
                  <div className="p-5 bg-accent/10 rounded-2xl shadow-inner border border-accent/20">
                    <Sparkles className="h-12 w-12 text-accent" />
                  </div>
                  <div className="space-y-2 max-w-sm">
                    <h3 className="text-xl font-bold font-headline tracking-tight">Direct Model Interface</h3>
                    <p className="text-sm text-muted-foreground">Example: "What's the price for a 50kg pallet from Perth to Sydney 2000? I need the best Priority rate."</p>
                  </div>
                </div>
              )}

              {messages.map((m) => (
                <div key={m.id} className={cn(
                  "flex gap-4",
                  m.role === 'user' ? "ml-auto flex-row-reverse max-w-[85%]" : "mr-auto max-w-[95%]"
                )}>
                  <div className={cn(
                    "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-md",
                    m.role === 'user' ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"
                  )}>
                    {m.role === 'user' ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
                  </div>
                  <div className="space-y-4">
                    <div className={cn(
                      "p-5 rounded-2xl text-sm leading-relaxed shadow-sm border",
                      m.role === 'user' ? "bg-primary text-primary-foreground border-primary/20 rounded-tr-none" : "bg-card text-foreground border-border/50 rounded-tl-none"
                    )}>
                      {m.content}
                    </div>

                    {m.data?.trace && (
                        <div className="space-y-2 ml-2">
                             <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                                <Route className="h-3 w-3" /> Execution Trace
                             </p>
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {m.data.trace.map((t, idx) => (
                                    <div key={idx} className="flex items-center gap-2 p-2 bg-muted/30 border border-dashed rounded-lg">
                                        <CheckCircle2 className={cn("h-3 w-3", t.status === 'success' ? "text-green-500" : "text-amber-500")} />
                                        <div className="min-w-0">
                                            <p className="text-[9px] font-bold uppercase truncate">{t.title}</p>
                                            <p className="text-[9px] text-muted-foreground truncate">{t.detail}</p>
                                        </div>
                                    </div>
                                ))}
                             </div>
                        </div>
                    )}

                    {m.data?.results && m.data.results.length > 0 && (
                      <Card className="shadow-lg border-accent/20 animate-in zoom-in-95 duration-300 overflow-hidden">
                        <CardHeader className="p-4 border-b bg-muted/30">
                          <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center justify-between">
                            Calculated Results
                            <Badge variant="outline" className="h-4 text-[8px] font-black border-accent text-accent">DETERMINISTIC</Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                          <Table>
                            <TableBody>
                              {m.data.results.map((res, idx) => (
                                <TableRow key={idx}>
                                  <TableCell className="text-xs font-bold font-headline py-3">{res.serviceName}</TableCell>
                                  <TableCell className="text-xs text-muted-foreground py-3 italic">{res.transitTime}</TableCell>
                                  <TableCell className="text-right font-bold text-primary font-headline py-3">
                                      {formatCurrency(res.price)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CardContent>
                        <CardFooter className="p-2 border-t bg-accent/5 flex gap-2">
                          <Button variant="ghost" size="sm" className="h-8 text-[10px] uppercase font-black tracking-widest w-full hover:bg-accent hover:text-white" onClick={() => handleRehydrate(m.data!)}>
                            <ArrowRightLeft className="mr-1.5 h-3.5 w-3.5" /> Rehydrate Form
                          </Button>
                        </CardFooter>
                      </Card>
                    )}
                  </div>
                </div>
              ))}

              {isThinking && (
                <div className="flex gap-4 items-center animate-pulse">
                  <div className="h-10 w-10 rounded-xl bg-accent/20 flex items-center justify-center shadow-inner">
                    <Loader2 className="h-5 w-5 animate-spin text-accent" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 w-32 bg-muted rounded-full"></div>
                    <div className="h-3 w-48 bg-muted rounded-full opacity-50"></div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
        <CardFooter className="p-6 border-t bg-card shrink-0">
          <form onSubmit={handleSend} className="flex w-full gap-3 relative">
            <Input 
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Query the autonomous engine..."
              className="h-12 bg-background border-primary/20 focus-visible:ring-accent font-medium text-base shadow-sm"
              disabled={isThinking}
            />
            <Button type="submit" size="icon" className="h-12 w-12 bg-accent hover:bg-accent/90 shadow-md transition-transform active:scale-95" disabled={!input.trim() || isThinking}>
              <Send className="h-5 w-5" />
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}
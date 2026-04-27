
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Search, 
  X as XIcon, 
  Loader2, 
  Mic, 
  Sparkles, 
  MessagesSquare, 
  Cloud, 
  Package 
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useSpeechRecognition } from '@/hooks/use-speech-recognition';
import { processQuoteQuery } from '@/ai/flows/quote-agent-flow';
import AiQuoteResultsDialog from './dashboard/AiQuoteResultsDialog';
import { cn } from '@/lib/utils';
import type { UserRole, Company, QuoteAgentOutput } from '@/lib/types';

interface GlobalSearchProps {
  role: UserRole | null;
  company: Company | null;
  isSuperadmin: boolean;
}

export function GlobalSearch({ role, company, isSuperadmin }: GlobalSearchProps) {
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [isSearching, setIsSearching] = useState(false);
  const [isAiMode, setIsAiMode] = useState(false);
  const [aiResult, setAiResult] = useState<QuoteAgentOutput | null>(null);
  const [isResultDialogOpen, setIsResultDialogOpen] = useState(false);

  const { transcript, listening, isSupported, startListening, stopListening } = useSpeechRecognition();

  useEffect(() => {
    const currentQuery = searchParams.get('q') || '';
    if (currentQuery !== searchQuery) {
      setSearchQuery(currentQuery);
    }
    setIsSearching(false);
  }, [searchParams]);

  useEffect(() => {
    if (transcript && isSuperadmin) {
      setSearchQuery(transcript);
    }
  }, [transcript, isSuperadmin]);

  const handleAppSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    if (isAiMode && isSuperadmin) {
      setIsSearching(true);
      try {
        const result = await processQuoteQuery({ query: searchQuery });
        setAiResult(result);
        setIsResultDialogOpen(true);
      } catch (error) {
        toast({ title: "AI Error", description: "Could not process quote request.", variant: "destructive" });
      } finally {
        setIsSearching(false);
      }
      return;
    }

    if (searchQuery.trim().length > 0) {
      setIsSearching(true);
      router.push(`/location-lookup?q=${encodeURIComponent(searchQuery)}`);
    } else {
      router.push('/location-lookup');
    }
  };

  const handleSalesforceSearch = () => {
    if (!searchQuery.trim()) {
      toast({ title: "Search Term Required", description: "Please enter a term to search in Salesforce.", variant: "destructive" });
      return;
    }
    const payload = {
      componentDef: "forceSearch:searchPageDesktop",
      attributes: { term: searchQuery, scopeMap: { type: "TOP_RESULTS" } }
    };
    const encodedPayload = btoa(JSON.stringify(payload));
    const url = `https://teamglobalexp.lightning.force.com/one/one.app#${encodedPayload}`;
    window.open(url, '_blank');
  };

  const handleMyParcelSearch = () => {
    if (!searchQuery.trim()) {
      toast({ title: "Consignment Number Required", description: "Please enter a connote to search in MyParcel.", variant: "destructive" });
      return;
    }
    const connote = encodeURIComponent(searchQuery.trim());
    const url = `https://teamglobalexp.com/myparcel?shipmentID=${connote}`;
    window.open(url, '_blank');
  };

  const toggleAiMode = () => {
    if (!isSuperadmin) return;
    setIsAiMode(!isAiMode);
    toast({ 
      title: !isAiMode ? "AI Mode Active" : "Search Mode Active", 
      description: !isAiMode ? "Ask for a quote or info in natural language." : "Searching Locations, VIPs and Data." 
    });
  };

  const handleMicClick = () => {
    if (listening) stopListening();
    else startListening();
  };

  const showSalesforceButton = isSuperadmin || company?.enabledFeatures?.['salesforce-search-bar'] !== false;

  return (
    <>
      <form onSubmit={handleAppSearch} className="relative w-full max-w-lg">
        <Input
          type="text"
          placeholder={isAiMode ? "Ask the AI (e.g. Price for 10kg to SYD)" : "Universal Tools (Postcodes, VIPs, RAS)"}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={cn(
            "h-11 bg-background text-primary placeholder:text-primary/70 border-primary/30 focus-visible:ring-accent pr-2 md:pr-[240px]",
            (isAiMode && isSuperadmin) && "border-accent ring-1 ring-accent/30"
          )}
        />
        <div className="absolute inset-y-0 right-0 hidden md:flex items-center pr-2">
          {searchQuery && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => setSearchQuery('')}
            >
              <XIcon className="h-4 w-4" />
            </Button>
          )}
          <Separator orientation="vertical" className="h-6 mx-1" />
          <TooltipProvider>
            {isSuperadmin && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    type="button" 
                    size="icon" 
                    className="h-9 w-9 bg-muted text-muted-foreground hover:bg-muted/80"
                    onClick={() => router.push('/ai-quote')}
                  >
                    <MessagesSquare className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Launch Conversational AI</p></TooltipContent>
              </Tooltip>
            )}
            {(isSupported && isSuperadmin) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    type="button" 
                    size="icon" 
                    className={cn("h-9 w-9 ml-1", listening ? "bg-red-500 animate-pulse text-white" : "bg-muted text-muted-foreground")} 
                    onClick={handleMicClick}
                  >
                    <Mic className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>{listening ? "Listening..." : "Search by Voice"}</p></TooltipContent>
              </Tooltip>
            )}
            {isSuperadmin && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    type="button" 
                    size="icon" 
                    className={cn("h-9 w-9 ml-1 transition-all", isAiMode ? "bg-accent text-white" : "bg-muted text-muted-foreground hover:bg-muted/80")} 
                    onClick={toggleAiMode}
                  >
                    <Sparkles className={cn("h-4 w-4", isAiMode && "animate-spin-slow")} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>{isAiMode ? "Switch to Search" : "Switch to AI Assistant"}</p></TooltipContent>
              </Tooltip>
            )}
            {!isAiMode && (
              <>
                {showSalesforceButton && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button type="button" size="icon" className="h-9 w-9 bg-blue-600 hover:bg-blue-700 ml-1" onClick={handleSalesforceSearch}>
                        <Cloud className="h-4 w-4 text-white" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Search Salesforce</p></TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button type="button" size="icon" className="h-9 w-9 bg-orange-600 hover:bg-orange-700 ml-1" onClick={handleMyParcelSearch}>
                      <Package className="h-4 w-4 text-white" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Track in MyParcel</p></TooltipContent>
                </Tooltip>
              </>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="submit" size="icon" className={cn("h-9 w-9 ml-1", (isAiMode && isSuperadmin) ? "bg-accent text-white" : "bg-muted text-muted-foreground")} disabled={isSearching}>
                  {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Submit</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </form>
      <AiQuoteResultsDialog 
        isOpen={isResultDialogOpen}
        onOpenChange={setIsResultDialogOpen}
        data={aiResult}
      />
    </>
  );
}

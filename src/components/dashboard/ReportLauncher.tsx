"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
    Search, 
    BookOpen, 
    X as XIcon, 
    Cloud, 
    Table as TableIcon, 
    Truck, 
    BarChart3, 
    History, 
    Globe,
    Zap,
    ExternalLink,
    Maximize2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/context/SettingsContext';
import { useAuth } from '@/firebase';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function ReportLauncher() {
  const { toast } = useToast();
  const { company, actualRole } = useAuth();
  const [queryValue, setQueryQueryValue] = useState('');

  // Smart Detection
  const isConnote = useMemo(() => {
    const val = queryValue.trim().toUpperCase();
    return val.startsWith('TGE') || val.startsWith('NCA') || (val.length >= 8 && /^\d+$/.test(val));
  }, [queryValue]);

  const isAccountCode = useMemo(() => {
    const val = queryValue.trim();
    return val.length >= 4 && val.length <= 7 && /^\d+$/.test(val);
  }, [queryValue]);

  const handleGlobalSearch = () => {
    if (!queryValue.trim()) return;
    
    // Default fallback: Salesforce Search
    const payload = {
        componentDef: "forceSearch:searchPageDesktop",
        attributes: { term: queryValue, scopeMap: { type: "TOP_RESULTS" },}
    };
    const encodedPayload = btoa(JSON.stringify(payload));
    const url = `https://teamglobalexp.lightning.force.com/one/one.app#${encodedPayload}`;
    window.open(url, '_blank');
  };

  const openAction = (type: string) => {
    const val = queryValue.trim();
    if (!val) return;

    let url = '';
    switch(type) {
        case 'myparcel':
            url = `https://teamglobalexp.com/myparcel?shipmentID=${encodeURIComponent(val)}`;
            break;
        case 'myteamge':
            url = `https://www.myteamge.com/search-shipment?p_p_id=searchportlet_WAR_searchportlet&p_p_lifecycle=0&p_p_state=normal&_searchportlet_WAR_searchportlet_shipmentReferences=${encodeURIComponent(val)}`;
            break;
        case 'live-connote':
            url = `http://ted-prod-reports.awsagreenspace.local/Reports/report/EDS_Reports/Connote%20Detail%20incl%20GPS%20Report?connote_id=${encodeURIComponent(val)}`;
            break;
        case 'archive-connote':
            url = `http://ted-prod-reports.awsagreenspace.local/Reports/report/EDS_Reports/Connote%20Detail%20Archive%20incl%20GPS%20Report?connote_id=${encodeURIComponent(val)}`;
            break;
        case 'trading':
            url = `https://fleapaup005.agreenspace.local/Reports/report/TGE-Live/IPEC/Sales/General/Detailed%20Trading%20Stats?AccountCode=${encodeURIComponent(val)}`;
            break;
        case 'difot':
            url = `https://fleapaup005.agreenspace.local/Reports/report/DIFOT/Delivery%20Performance%20Report/GE%20Delivery%20Performance%20Report-Long%20Term%20Summary?account=${encodeURIComponent(val)}`;
            break;
        case 'rates':
            url = `https://fleapaup005.agreenspace.local/Reports/report/TGE-Live/IPEC/Sales/Quotes%20Analysis/Quote%20Enquiry?Account=${encodeURIComponent(val)}`;
            break;
        case 'salesforce-acc':
             const payload = {
                componentDef: "forceSearch:searchPageDesktop",
                attributes: { term: val, scopeMap: { type: "TOP_RESULTS" } }
            };
            url = `https://teamglobalexp.lightning.force.com/one/one.app#${btoa(JSON.stringify(payload))}`;
            break;
    }
    if (url) window.open(url, '_blank');
  };

  const showSalesforce = actualRole === 'superadmin' || company?.enabledFeatures?.['salesforce-widgets'] !== false;

  return (
    <Card className="shadow-xl border-none bg-card overflow-hidden">
      <CardHeader className="pb-6 bg-muted/20 border-b">
        <div className="flex items-center justify-between">
            <div className="space-y-1">
                <CardTitle className="text-xl font-black font-headline flex items-center gap-2 text-primary">
                    <Zap className="h-5 w-5 fill-primary" />
                    Intelligence & External Tools
                </CardTitle>
                <CardDescription className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/70">
                    Unified Organization Reporting & Salesforce Gateway
                </CardDescription>
            </div>
            <div className="hidden md:flex gap-1">
                <div className={cn("px-2 py-1 rounded text-[8px] font-black uppercase tracking-tighter border transition-colors", isConnote ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground opacity-30")}>Connote Mode</div>
                <div className={cn("px-2 py-1 rounded text-[8px] font-black uppercase tracking-tighter border transition-colors", isAccountCode ? "bg-blue-600 text-white border-blue-600" : "bg-muted text-muted-foreground opacity-30")}>Account Mode</div>
            </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="p-6 md:p-8 space-y-8">
            {/* Unified Input Section */}
            <div className="max-w-4xl mx-auto space-y-4">
                <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Search className={cn("h-5 w-5 transition-colors", queryValue ? "text-primary" : "text-muted-foreground/50")} />
                    </div>
                    <Input 
                        value={queryValue}
                        onChange={(e) => setQueryQueryValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleGlobalSearch()}
                        placeholder="Enter Connote (TGE...), Account #, or Search Term..."
                        className="h-16 pl-12 pr-12 text-lg font-bold bg-muted/30 border-2 focus-visible:ring-primary/20 focus-visible:border-primary transition-all shadow-inner"
                    />
                    {queryValue && (
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="absolute inset-y-0 right-2 my-auto h-10 w-10 hover:bg-transparent"
                            onClick={() => setQueryQueryValue('')}
                        >
                            <XIcon className="h-4 w-4 text-muted-foreground" />
                        </Button>
                    )}
                </div>

                <div className="flex flex-wrap justify-center gap-2">
                    <Button 
                        onClick={handleGlobalSearch}
                        disabled={!queryValue.trim()}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-[10px] h-10 px-6 shadow-md"
                    >
                        <Cloud className="mr-2 h-4 w-4" /> Salesforce Global Search
                    </Button>
                </div>
            </div>

            {/* Contextual Actions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t">
                {/* Connote Logic Group */}
                <div className={cn("space-y-4 transition-opacity", !isConnote && queryValue ? "opacity-40 grayscale" : "opacity-100")}>
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-1 bg-primary rounded-full" />
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Connote Tracking</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" size="sm" className="h-11 justify-start font-bold text-[10px] uppercase tracking-tight hover:border-primary hover:text-primary transition-all" disabled={!queryValue} onClick={() => openAction('myparcel')}>
                            <Truck className="mr-2 h-3.5 w-3.5 text-primary" /> MyParcel
                        </Button>
                        <Button variant="outline" size="sm" className="h-11 justify-start font-bold text-[10px] uppercase tracking-tight hover:border-primary hover:text-primary transition-all" disabled={!queryValue} onClick={() => openAction('myteamge')}>
                            <Globe className="mr-2 h-3.5 w-3.5 text-primary" /> MyTeamGE
                        </Button>
                        <Button variant="outline" size="sm" className="h-11 justify-start font-bold text-[10px] uppercase tracking-tight hover:border-primary hover:text-primary transition-all" disabled={!queryValue} onClick={() => openAction('live-connote')}>
                            <Zap className="mr-2 h-3.5 w-3.5 text-primary" /> Live Report
                        </Button>
                        <Button variant="outline" size="sm" className="h-11 justify-start font-bold text-[10px] uppercase tracking-tight hover:border-primary hover:text-primary transition-all" disabled={!queryValue} onClick={() => openAction('archive-connote')}>
                            <History className="mr-2 h-3.5 w-3.5 text-primary" /> Archive
                        </Button>
                    </div>
                </div>

                {/* Account Logic Group */}
                <div className={cn("space-y-4 transition-opacity", !isAccountCode && queryValue ? "opacity-40 grayscale" : "opacity-100")}>
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-1 bg-blue-600 rounded-full" />
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">Account Performance</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" size="sm" className="h-11 justify-start font-bold text-[10px] uppercase tracking-tight hover:border-blue-600 hover:text-blue-600 transition-all" disabled={!queryValue} onClick={() => openAction('trading')}>
                            <BarChart3 className="mr-2 h-3.5 w-3.5 text-blue-600" /> Trading Stats
                        </Button>
                        <Button variant="outline" size="sm" className="h-11 justify-start font-bold text-[10px] uppercase tracking-tight hover:border-blue-600 hover:text-blue-600 transition-all" disabled={!queryValue} onClick={() => openAction('difot')}>
                            <Truck className="mr-2 h-3.5 w-3.5 text-blue-600" /> DIFOT Summary
                        </Button>
                        <Button variant="outline" size="sm" className="h-11 justify-start font-bold text-[10px] uppercase tracking-tight hover:border-blue-600 hover:text-blue-600 transition-all" disabled={!queryValue} onClick={() => openAction('rates')}>
                            <TableIcon className="mr-2 h-3.5 w-3.5 text-blue-600" /> IPEC Rates
                        </Button>
                        <Button variant="outline" size="sm" className="h-11 justify-start font-bold text-[10px] uppercase tracking-tight hover:border-blue-600 hover:text-blue-600 transition-all" disabled={!queryValue} onClick={() => openAction('salesforce-acc')}>
                            <Cloud className="mr-2 h-3.5 w-3.5 text-blue-600" /> Salesforce
                        </Button>
                    </div>
                </div>
            </div>
        </div>
      </CardContent>
      <div className="bg-muted/30 p-3 flex items-center justify-center gap-6 border-t">
          <div className="flex items-center gap-1.5 opacity-50">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span className="text-[8px] font-black uppercase tracking-tighter">Real-time Tracking</span>
          </div>
          <div className="flex items-center gap-1.5 opacity-50">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
              <span className="text-[8px] font-black uppercase tracking-tighter">Cloud Integration</span>
          </div>
          <div className="flex items-center gap-1.5 opacity-50">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="text-[8px] font-black uppercase tracking-tighter">Live Reporting</span>
          </div>
      </div>
    </Card>
  );
}

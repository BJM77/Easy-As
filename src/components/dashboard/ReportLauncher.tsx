"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, BookOpen, X as XIcon, Cloud, Table as TableIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/context/SettingsContext';
import { useAuth } from '@/firebase';

export default function ReportLauncher() {
  const { toast } = useToast();
  const { company, actualRole } = useAuth();
  const [accountCode, setAccountCode] = useState('');
  const [connote, setConnote] = useState('');
  const [salesforceQuery, setSalesforceQuery] = useState('');

  const handleSalesforceSearch = () => {
    if (!salesforceQuery) {
      toast({ title: "Search Term Required", description: "Please enter a term to search in Salesforce.", variant: "destructive" });
      return;
    }
     const payload = {
        componentDef: "forceSearch:searchPageDesktop",
        attributes: { term: salesforceQuery, scopeMap: { type: "TOP_RESULTS" },}
    };
    const encodedPayload = btoa(JSON.stringify(payload));
    const url = `https://teamglobalexp.lightning.force.com/one/one.app#${encodedPayload}`;
    window.open(url, '_blank');
  };
  
  const handleOpenTradingStats = () => {
    if (!accountCode) {
      toast({ title: "Account Number Required", description: "Please enter an account number.", variant: "destructive" });
      return;
    }
    const baseUrl = 'https://fleapaup005.agreenspace.local/Reports/report/TGE-Live/IPEC/Sales/General/Detailed%20Trading%20Stats';
    const url = `${baseUrl}?AccountCode=${encodeURIComponent(accountCode)}`;
    window.open(url, '_blank');
  };
  
  const handleOpenDifotReport = () => {
    if (!accountCode) {
      toast({ title: "Account Number Required", description: "Please enter an account number.", variant: "destructive" });
      return;
    }
    const baseUrl = 'https://fleapaup005.agreenspace.local/Reports/report/DIFOT/Delivery%20Performance%20Report/GE%20Delivery%20Performance%20Report-Long%20Term%20Summary';
    const url = `${baseUrl}?account=${encodeURIComponent(accountCode)}`;
    window.open(url, '_blank');
  };

  const showSalesforce = actualRole === 'superadmin' || company?.enabledFeatures?.['salesforce-widgets'] !== false;
  const showAccountReports = actualRole === 'superadmin' || company?.enabledFeatures?.['account-reports'] !== false;

  return (
    <Card className="shadow-lg border-none bg-muted/10">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl font-headline flex items-center">
            <BookOpen className="mr-2 h-6 w-6 text-primary" />
            Intelligence & External Tools
        </CardTitle>
        <CardDescription className="text-xs">
          Consolidated organizational reporting and Salesforce integration.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Connote Tracking */}
            <div className="space-y-4 p-4 border rounded-lg bg-card shadow-sm">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                <Search className="h-3 w-3" />
                Connote Tracking
              </h3>
              <div className="space-y-2">
                <div className="relative">
                  <Input id="connote" value={connote} onChange={(e) => setConnote(e.target.value)} placeholder="TGE12345678" className="h-8 text-[10px] font-mono" />
                  {connote && (
                      <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6" onClick={() => setConnote('')}>
                          <XIcon className="h-3 w-3 text-muted-foreground" />
                      </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                    <Button onClick={() => window.open(`https://teamglobalexp.com/myparcel?shipmentID=${encodeURIComponent(connote)}`, '_blank')} variant="outline" size="sm" className="h-7 text-[8px] font-bold uppercase" disabled={!connote}>
                      MyParcel
                    </Button>
                    <Button onClick={() => window.open(`https://www.myteamge.com/search-shipment?p_p_id=searchportlet_WAR_searchportlet&p_p_lifecycle=0&p_p_state=normal&_searchportlet_WAR_searchportlet_shipmentReferences=${encodeURIComponent(connote)}`, '_blank')} variant="outline" size="sm" className="h-7 text-[8px] font-bold uppercase" disabled={!connote}>
                      MyTeamGE
                    </Button>
                </div>
              </div>
            </div>

            {/* Salesforce Search */}
            {showSalesforce && (
              <div className="space-y-4 p-4 border rounded-lg bg-card shadow-sm">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                  <Cloud className="h-3 w-3 text-blue-600" />
                  Salesforce Search
                </h3>
                <div className="flex items-center gap-2">
                  <Input id="salesforce-query" value={salesforceQuery} onChange={(e) => setSalesforceQuery(e.target.value)} placeholder="Search SFDC..." className="h-8 text-[10px]" onKeyDown={(e) => e.key === 'Enter' && handleSalesforceSearch()}/>
                  <Button onClick={handleSalesforceSearch} size="sm" className="h-8 w-8 p-0 bg-blue-600 hover:bg-blue-700 shrink-0">
                      <Search className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="text-[9px] text-muted-foreground italic">Searches all standard objects.</p>
              </div>
            )}

            {/* Account Performance */}
            {showAccountReports && (
              <div className="space-y-4 p-4 border rounded-lg bg-card shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                      <TableIcon className="h-3 w-3" />
                      Performance
                  </h3>
                  <Input id="account" value={accountCode} onChange={(e) => setAccountCode(e.target.value)} placeholder="Acc #" className="h-7 w-16 text-[9px] font-mono px-1.5" />
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                    <Button onClick={handleOpenTradingStats} size="sm" className="h-7 text-[8px] font-bold uppercase" variant="secondary" disabled={!accountCode}>
                        Trading
                    </Button>
                    <Button onClick={handleOpenDifotReport} size="sm" className="h-7 text-[8px] font-bold uppercase" variant="secondary" disabled={!accountCode}>
                        DIFOT
                    </Button>
                </div>
                <p className="text-[9px] text-muted-foreground italic">Requires account number.</p>
              </div>
            )}
        </div>
      </CardContent>
    </Card>
  );
}

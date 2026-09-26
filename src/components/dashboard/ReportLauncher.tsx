"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ExternalLink, BookOpen, Search, Settings, ShieldAlert, X as XIcon, Calculator, Scale, FileText, BarChartHorizontalBig, GitCompareArrows, Route, Warehouse, FileUp, Cloud } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '../ui/separator';
import { useSettings } from '@/context/SettingsContext';
import QuickActionsConfigDialog, { ALL_QUICK_ACTIONS_MAP } from './QuickActionsConfigDialog';
import NewProblemDialog from '../NewProblemDialog';
import { useAuth } from '@/firebase';

export default function ReportLauncher() {
  const { toast } = useToast();
  const { company, role: actualRole } = useAuth();
  const [accountCode, setAccountCode] = useState('');
  const [connote, setConnote] = useState('');
  const [salesforceQuery, setSalesforceQuery] = useState('');

  const { quickActions, setQuickActions } = useSettings();
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [isProblemDialogOpen, setIsProblemDialogOpen] = useState(false);
  
  const handleActionClick = (isDialog?: boolean, href?: string) => {
    if (isDialog && href === '/problem-log') {
      setIsProblemDialogOpen(true);
    }
  };

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
  
  const openAccountSearchInSalesforce = () => {
    if (!accountCode) {
      toast({ title: "Account Number Required", description: "Please enter an account number to search in Salesforce.", variant: "destructive" });
      return;
    }
    const payload = {
      componentDef: "forceSearch:searchPageDesktop",
      attributes: { term: accountCode, scopeMap: { type: "TOP_RESULTS" } }
    };
    const encodedPayload = btoa(JSON.stringify(payload));
    const url = `https://teamglobalexp.lightning.force.com/one/one.app#${encodedPayload}`;
    window.open(url, '_blank');
  }

  const handleOpenTradingStats = () => {
    if (!accountCode) {
      toast({ title: "Account Number Required", description: "Please enter an account number.", variant: "destructive" });
      return;
    }
    const baseUrl = 'https://fleapaup005.agreenspace.local/Reports/report/TGE-Live/IPEC/Sales/General/Detailed%20Trading%20Stats';
    const url = `${baseUrl}?AccountCode=${encodeURIComponent(accountCode)}`;
    window.open(url, '_blank');
  };
  
  const handleOpenIpecRates = () => {
    if (!accountCode) {
      toast({ title: "Account Number Required", description: "Please enter an account number.", variant: "destructive" });
      return;
    }
    const baseUrl = 'https://fleapaup005.agreenspace.local/Reports/report/TGE-Live/IPEC/Sales/Quotes%20Analysis/Quote%20Enquiry?Account=';
    const url = `${baseUrl}${encodeURIComponent(accountCode)}`;
    window.open(url, '_blank');
  };

  const handleOpenIpecRatesForAccount = () => {
    if (!accountCode) {
      toast({ title: "Account Number Required", description: "Please enter an account number.", variant: "destructive" });
      return;
    }
    const baseUrl = 'https://fleapaup005.agreenspace.local/Reports/report/TGE-Live/IPEC/Sales/Quotes%20Analysis/Quote%20Enquiry?Account=';
    const url = `${baseUrl}${encodeURIComponent(accountCode)}`;
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
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
              <BookOpen className="mr-2 h-7 w-7 text-primary" />
              Reports & Actions
          </CardTitle>
          <CardDescription>
            Quickly open external reports or perform common actions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {showSalesforce && (
            <div className="space-y-4 p-4 border rounded-lg">
              <h3 className="font-semibold">Salesforce General Search</h3>
              <div className="flex flex-col sm:flex-row items-end gap-2">
                  <div className="space-y-1 flex-grow w-full sm:w-auto">
                    <Label htmlFor="salesforce-query">Search Term</Label>
                    <Input id="salesforce-query" value={salesforceQuery} onChange={(e) => setSalesforceQuery(e.target.value)} placeholder="Account, Opportunity, Contact..." onKeyDown={(e) => e.key === 'Enter' && handleSalesforceSearch()}/>
                  </div>
                  <Button onClick={handleSalesforceSearch} variant="outline" className="h-auto py-3 flex-col items-start w-full sm:w-auto">
                    <div className="flex items-center gap-2">
                      <Search className="h-5 w-5 text-primary" />
                      <span className="font-semibold">Search Salesforce</span>
                    </div>
                  </Button>
              </div>
            </div>
          )}
          
          <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-semibold">Detailed Connote Tracking</h3>
            <div className="flex flex-col items-stretch gap-2">
              <div className="space-y-1 w-full">
                <Label htmlFor="connote">Consignment Number</Label>
                <div className="relative">
                  <Input id="connote" value={connote} onChange={(e) => setConnote(e.target.value)} placeholder="Enter connote..." />
                  {connote && (
                      <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" onClick={() => setConnote('')}>
                          <XIcon className="h-4 w-4 text-muted-foreground" />
                      </Button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 w-full">
                  <Button onClick={() => window.open(`https://teamglobalexp.com/myparcel?shipmentID=${encodeURIComponent(connote)}`, '_blank')} variant="outline" className="h-auto py-3 flex-col items-start w-full" disabled={!connote}><div className="flex items-center gap-2"><ExternalLink className="h-5 w-5 text-primary" /><span className="font-semibold">MyParcel</span></div></Button>
                  <Button onClick={() => window.open(`https://www.myteamge.com/search-shipment?p_p_id=searchportlet_WAR_searchportlet&p_p_lifecycle=0&p_p_state=normal&_searchportlet_WAR_searchportlet_shipmentReferences=${encodeURIComponent(connote)}`, '_blank')} variant="outline" className="h-auto py-3 flex-col items-start w-full" disabled={!connote}><div className="flex items-center gap-2"><ExternalLink className="h-5 w-5 text-primary" /><span className="font-semibold">MyTeamGE</span></div></Button>
                  <Button onClick={() => window.open(`http://ted-prod-reports.awsagreenspace.local/Reports/report/EDS_Reports/Connote%20Detail%20incl%20GPS%20Report?connote_id=${encodeURIComponent(connote)}`, '_blank')} variant="outline" className="h-auto py-3 flex-col items-start w-full" disabled={!connote}><div className="flex items-center gap-2"><ExternalLink className="h-5 w-5 text-primary" /><span className="font-semibold">Live</span></div></Button>
                  <Button onClick={() => window.open(`http://ted-prod-reports.awsagreenspace.local/Reports/report/EDS_Reports/Connote%20Detail%20Archive%20incl%20GPS%20Report?connote_id=${encodeURIComponent(connote)}`, '_blank')} variant="outline" className="h-auto py-3 flex-col items-start w-full" disabled={!connote}><div className="flex items-center gap-2"><ExternalLink className="h-5 w-5 text-primary" /><span className="font-semibold">Archive</span></div></Button>
              </div>
            </div>
          </div>

          {showAccountReports && (
            <div className="space-y-4 p-4 border rounded-lg">
              <h3 className="font-semibold">Account Based Reports</h3>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="account">Account Number</Label>
                  <Input id="account" value={accountCode} onChange={(e) => setAccountCode(e.target.value)} placeholder="e.g., 80272019" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                    <Button onClick={handleOpenTradingStats} className="h-auto py-3 flex-col items-start w-full" variant="outline">
                        <div className="flex items-center gap-2"><ExternalLink className="h-5 w-5 text-primary" /><span className="font-semibold">IPEC Stats</span></div>
                    </Button>
                    <Button onClick={handleOpenIpecRatesForAccount} className="h-auto py-3 flex-col items-start w-full" variant="outline">
                        <div className="flex items-center gap-2"><ExternalLink className="h-5 w-5 text-primary" /><span className="font-semibold">IPEC Rates</span></div>
                    </Button>
                    <Button onClick={handleOpenDifotReport} className="h-auto py-3 flex-col items-start w-full" variant="outline">
                        <div className="flex items-center gap-2"><ExternalLink className="h-5 w-5 text-primary" /><span className="font-semibold">DIFOT Report</span></div>
                    </Button>
                    <Button onClick={openAccountSearchInSalesforce} variant="outline" className="h-auto py-3 flex-col items-start w-full" disabled={!accountCode}>
                      <div className="flex items-center gap-2">
                        <Search className="h-5 w-5 text-primary" />
                        <span className="font-semibold">Salesforce</span>
                      </div>
                    </Button>
                </div>
              </div>
            </div>
          )}

          <Separator className="my-6" />
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Quick Actions</h3>
              <Button variant="ghost" size="icon" onClick={() => setIsConfigDialogOpen(true)}>
                <Settings className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {quickActions.map(key => {
                const action = ALL_QUICK_ACTIONS_MAP[key];
                if (!action) return null;
                                if (!action) return null;
                const Icon = action.icon;
                
                if (action.isDialog) {
                  return (
                    <Button key={key} variant="outline" className="h-auto py-3 flex-col items-start" onClick={() => handleActionClick(true, action.href)}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-5 w-5 text-primary" />
                        <span className="font-semibold">{action.label}</span>
                      </div>
                    </Button>
                  );
                }
                
                return (
                  <Button key={key} asChild variant="outline" className="h-auto py-3 flex-col items-start">
                    <Link href={action.href || '#'}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-5 w-5 text-primary" />
                        <span className="font-semibold">{action.label}</span>
                      </div>
                    </Link>
                  </Button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
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
    </>
  );
}

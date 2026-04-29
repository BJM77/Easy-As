"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/context/SessionContext';
import { useSettings } from '@/context/SettingsContext';
import { format } from 'date-fns';
import { updateFuelSurcharges } from '@/ai/flows/update-fuel-surcharges-flow';
import { verifyAdminPassword } from '@/ai/flows/admin-auth-flow';
import { 
  Fuel, 
  ShieldCheck, 
  Loader2, 
  RefreshCw, 
  Clock 
} from 'lucide-react';

export const FuelSecurityWidget = () => {
  const { 
    standardFuelSurcharge, priorityFuelSurcharge, palletFuelSurcharge, 
    globalSecuritySurchargePercent, updateGroupFuelSurcharge,
    standardFuelLastUpdated,
    saveSettingsToServer
  } = useSettings();
  const { addTokens } = useSession();
  const [isFetchingFuel, setIsFetchingFuel] = useState(false);
  const { toast } = useToast();

  const handleFetchLatestFuelRates = async () => {
    setIsFetchingFuel(true);
    toast({ title: "Connecting to TGE...", description: "Fetching live fuel rates." });

    try {
      const result = await updateFuelSurcharges();
      const { update, success, error, usage } = result;

      if (!success) {
        throw new Error(error || "Fetch failed");
      }
      
      if (usage && usage.totalTokens > 0) {
        addTokens(usage.totalTokens);
      }
      
      if (update) {
          updateGroupFuelSurcharge('pallet', update.pallet, update.lastUpdated);
          updateGroupFuelSurcharge('standard', update.road, update.lastUpdated);
          updateGroupFuelSurcharge('priority', update.air, update.lastUpdated);
          
          // The server-side verifyAdminPassword will now check for either 
          // the Secret Manager value OR 'LCPTGE' as a fallback.
          await saveSettingsToServer('LCPTGE');
          
          toast({ 
            title: "Rates Updated", 
            description: `Live data retrieved for ${format(new Date(update.lastUpdated), 'dd MMM')}.`,
            variant: "default" 
          });
      }
    } catch(error: any) {
       console.error("[Dashboard Fuel Fetch Error]", error);
       toast({ 
         title: "Update Required", 
         description: error.message || "Manual adjustment recommended.", 
         variant: "destructive" 
       });
    } finally {
      setIsFetchingFuel(false);
    }
  };

  return (
    <Card className="shadow-md overflow-hidden border-none bg-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2 p-4 bg-muted/20 border-b">
        <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Fuel className="h-3.5 w-3.5" />
            Live Rates
        </CardTitle>
         <Button size="sm" variant="ghost" className="h-6 w-6 p-0 rounded-full" onClick={handleFetchLatestFuelRates} disabled={isFetchingFuel}>
            {isFetchingFuel ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
        </Button>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 rounded bg-muted/30 border border-border/50">
                <p className="text-[8px] uppercase text-muted-foreground font-black mb-1">Std</p>
                <p className="text-xs font-bold font-mono">{standardFuelSurcharge.toFixed(2)}%</p>
            </div>
            <div className="text-center p-2 rounded bg-muted/30 border border-border/50">
                <p className="text-[8px] uppercase text-muted-foreground font-black mb-1">Prio</p>
                <p className="text-xs font-bold font-mono">{priorityFuelSurcharge.toFixed(2)}%</p>
            </div>
            <div className="text-center p-2 rounded bg-muted/30 border border-border/50">
                <p className="text-[8px] uppercase text-muted-foreground font-black mb-1">Pallet</p>
                <p className="text-xs font-bold font-mono">{palletFuelSurcharge.toFixed(2)}%</p>
            </div>
        </div>
        <div className="p-2 rounded bg-primary/5 border border-primary/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <span className="text-[9px] font-black uppercase tracking-widest text-primary">Security</span>
          </div>
          <span className="text-xs font-bold text-primary font-mono">{globalSecuritySurchargePercent.toFixed(2)}%</span>
        </div>
        {standardFuelLastUpdated && (
          <div className="pt-1 flex items-center justify-center gap-1 text-[8px] text-muted-foreground uppercase font-black tracking-widest">
            <Clock className="h-2 w-2" />
            Last Updated: {format(new Date(standardFuelLastUpdated), 'dd MMM HH:mm')}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

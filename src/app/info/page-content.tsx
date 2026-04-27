
"use client";

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Info, Truck, Zap, Anchor, Map, AlertTriangle, HelpCircle, BookOpen, Sparkles, ArrowRight } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import { useAuth } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

const formatCurrency = (amount: number | undefined) => {
  if (amount === undefined) return "N/A";
  return amount.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });
};

export default function InfoHubPageContent() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);
  const { surchargeDefinitions } = useSettings();

  if (loading || !user) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  const serviceInfo = [
    {
      icon: Truck,
      title: 'B2B Std / LCP Std',
      description: 'Standard road express services for business-to-business deliveries. Primarily uses the IPEC zone network.',
    },
    {
      icon: Zap,
      title: 'B2B Priority / LCP Priority',
      description: 'Premium, faster services for time-sensitive deliveries. Primarily uses the PRIO zone network and often involves air freight.',
    },
    {
      icon: Anchor,
      title: 'B2B Pallets Express / General Tiered',
      description: 'Services specifically for palletized freight. Uses the PE (Pallet Express) zone network, which is distinct from IPEC and PRIO.',
    },
    {
      icon: Truck,
      title: 'B2C (Std & Priority)',
      description: 'Services tailored for business-to-consumer deliveries. Uses a combination of the regional lookup and PRIO zones to determine journey type and pricing.',
    },
    {
      icon: Truck,
      title: 'LCP GO (Std & Priority)',
      description: 'A specialized low-cost service for small parcels (under 10kg dead weight) within the PRIO network. Has strict dimension limits.',
    },
     {
      icon: Truck,
      title: 'WA PE Special',
      description: 'A special pallet-based service for freight originating from the PER (Perth) PRIO zone to major eastern cities (SYD, MEL, BNE, ADL).',
    },
  ];
  
  const zoneInfo = [
    {
      title: "IPEC Zone",
      description: "Used for standard road services like B2B Std and LCP Std. Found in postcodes.json.",
    },
    {
      title: "PRIO Zone",
      description: "Used for priority and B2C services like B2B Priority, LCP Priority, and B2C. Found in postcodes.json.",
    },
    {
      title: "PE Zone (Pallet Express)",
      description: "Used for all pallet services. Derived from a lookup in PEZones.json based on Suburb and State, not just postcode.",
    },
  ];

  return (
    <div className="space-y-8">
      <Card className="shadow-xl bg-primary text-primary-foreground border-none overflow-hidden relative">
        <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
            <BookOpen className="h-32 w-32" />
        </div>
        <CardHeader>
          <CardTitle className="text-3xl font-black font-headline flex items-center">
            <Sparkles className="mr-3 h-8 w-8 text-accent" /> New: How-To Master Guide
          </CardTitle>
          <CardDescription className="text-primary-foreground/80 text-lg">
            We've created a comprehensive guide to help you master every feature of the BD Assistant.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <Button asChild variant="secondary" className="font-bold">
                <Link href="/how-to">Open Master Guide <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
        </CardContent>
      </Card>

      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <Info className="mr-2 h-7 w-7 text-primary" /> Info Hub
          </CardTitle>
          <CardDescription>
            A quick-reference guide for service details, surcharge information, and zone definitions.
          </CardDescription>
        </CardHeader>
      </Card>
      
      <Accordion type="multiple" defaultValue={['services', 'surcharges']} className="w-full">
        <AccordionItem value="services">
          <AccordionTrigger className="text-xl font-semibold">Service Overviews</AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {serviceInfo.map((service, index) => (
                <Card key={index}>
                  <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-2">
                     <div className="p-2 bg-primary/10 rounded-full">
                       <service.icon className="h-6 w-6 text-primary" />
                     </div>
                     <CardTitle className="text-lg">{service.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{service.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="surcharges">
          <AccordionTrigger className="text-xl font-semibold">Surcharge Cheat Sheet</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">
                This list shows predefined surcharges and their default values. The final applied value can be configured in Settings.
              </p>
              {surchargeDefinitions.filter(def => def.isPredefined).map((def) => (
                  <div key={def.id} className="p-4 border rounded-lg bg-muted/30">
                      <div className="flex justify-between items-center">
                        <h4 className="font-semibold">{def.name}</h4>
                        <div className="text-right">
                           <p className="font-bold text-primary">{def.type === 'percentage' ? `${def.defaultValue}%` : formatCurrency(def.defaultValue)}</p>
                           <p className="text-xs text-muted-foreground">{def.type.replace(/_/g, ' ')}</p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Applies to: {def.applicableServices.join(', ')}</p>
                  </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
        
        <AccordionItem value="zones">
          <AccordionTrigger className="text-xl font-semibold">Zone Definitions</AccordionTrigger>
          <AccordionContent>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {zoneInfo.map((zone, index) => (
                <Card key={index}>
                  <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-2">
                     <div className="p-2 bg-primary/10 rounded-full">
                       <Map className="h-6 w-6 text-primary" />
                     </div>
                     <CardTitle className="text-lg">{zone.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{zone.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
        
         <AccordionItem value="faq">
          <AccordionTrigger className="text-xl font-semibold">Frequently Asked Questions</AccordionTrigger>
          <AccordionContent>
             <div className="space-y-4 pt-2">
                <div className="p-4 border rounded-lg bg-muted/30">
                    <h4 className="font-semibold">Why are my pallet rates not showing up?</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Pallet rates depend on a specific PE (Pallet Express) Zone. This zone is looked up using a combination of the Suburb and State (e.g., "ALBURY NSW") from the `PEZones.json` file. If the suburb/state combination isn't in that file, the PE Zone cannot be found, and pallet rates will fail. Use the main "Lookup" page to verify PE Zones for a location.
                    </p>
                </div>
                 <div className="p-4 border rounded-lg bg-muted/30">
                    <h4 className="font-semibold">Why can't I see LCP services in some tools?</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Access to services is role-based. The BDM (Business Development Manager) role is focused on B2B and B2C services and does not have access to LCP (Low-Cost Parcel) services in tools like the SB Comparison. Admin and RSM roles have access to all services.
                    </p>
                </div>
             </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Building2, 
  Truck, 
  Train, 
  Ship, 
  Plane, 
  Box, 
  Anchor, 
  Globe, 
  BarChart, 
  ShieldCheck, 
  Zap, 
  Target,
  ShoppingCart,
  Warehouse,
  ThermometerSnowflake,
  Info,
  Layers,
  Clock,
  CheckCircle,
  Briefcase
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

const StatCard = ({ label, value }: { label: string; value: string }) => (
  <div className="p-4 border rounded-lg bg-muted/30 flex flex-col items-center justify-center text-center h-full">
    <p className="text-2xl font-bold text-primary">{value}</p>
    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mt-1">{label}</p>
  </div>
);

const FeatureItem = ({ icon: Icon, title, description }: { icon: any; title: string; description: string }) => (
  <div className="flex gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
    <div className="shrink-0 p-2 bg-primary/10 rounded-full h-fit">
      <Icon className="h-5 w-5 text-primary" />
    </div>
    <div className="space-y-1">
      <h4 className="font-bold text-sm">{title}</h4>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  </div>
);

export default function AboutTGEPageContent() {
  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20">
      <Card className="shadow-xl overflow-hidden border-t-4 border-primary">
        <CardHeader className="bg-muted/30 pb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="text-3xl font-headline flex items-center gap-3">
                <Building2 className="h-8 w-8 text-primary" />
                Team Global Express: Our Services
              </CardTitle>
              <CardDescription className="text-base mt-2">
                Discover the unrivaled reach, scale, and multi-modal logistics solutions that define Team Global Express.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Tabs defaultValue="intermodal" className="w-full">
            <div className="border-b bg-muted/10">
              <ScrollArea className="w-full whitespace-nowrap">
                <TabsList className="h-14 bg-transparent p-0 justify-start px-6 gap-6">
                  <TabsTrigger value="intermodal" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full bg-transparent px-2 font-bold flex gap-2">
                    <Train className="h-4 w-4" /> Intermodal
                  </TabsTrigger>
                  <TabsTrigger value="pallets" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full bg-transparent px-2 font-bold flex gap-2">
                    <Anchor className="h-4 w-4" /> Palletised Express
                  </TabsTrigger>
                  <TabsTrigger value="parcels" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full bg-transparent px-2 font-bold flex gap-2">
                    <Box className="h-4 w-4" /> Express Parcels
                  </TabsTrigger>
                  <TabsTrigger value="courier" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full bg-transparent px-2 font-bold flex gap-2">
                    <Truck className="h-4 w-4" /> Courier
                  </TabsTrigger>
                  <TabsTrigger value="network" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full bg-transparent px-2 font-bold flex gap-2">
                    <Globe className="h-4 w-4" /> Brand & Network
                  </TabsTrigger>
                </TabsList>
              </ScrollArea>
            </div>

            <div className="p-6 md:p-10">
              {/* INTERMODAL TAB */}
              <TabsContent value="intermodal" className="mt-0 focus-visible:ring-0">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                  <div className="lg:col-span-2 space-y-8">
                    <section className="space-y-4">
                      <h3 className="text-2xl font-bold flex items-center gap-2">
                        <Train className="h-6 w-6 text-primary" /> 
                        Intermodal & Specialised Services
                      </h3>
                      <p className="text-muted-foreground leading-relaxed">
                        Team Global Express combines transport modes across our network to carry cargo by air, road, rail and sea to deliver flexible, cost-effective freight transport solutions. Our Australian mode-agnostic logistics solutions (FCL, FTL, Imex, Temp Control) capitalise on the strength of our network to provide end-to-end supply chain capability.
                      </p>
                    </section>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FeatureItem 
                        icon={Train} 
                        title="Rail Leadership" 
                        description="330 weekly rail departures – the highest frequency of any provider. Connecting all major cities North to South, East to West." 
                      />
                      <FeatureItem 
                        icon={Ship} 
                        title="Coastal Shipping" 
                        description="Regular, secure, and economical coastal shipping services integrated with road fleets at major ports." 
                      />
                      <FeatureItem 
                        icon={ThermometerSnowflake} 
                        title="Temperature Controlled" 
                        description="Specialist services for perishable freight, ensuring product arrives cool, fresh, and on time." 
                      />
                      <FeatureItem 
                        icon={Warehouse} 
                        title="Wharf & Warehousing" 
                        description="Dedicated wharf services including import/export cartage, quarantine-accredited fumigation, and bonded storage." 
                      />
                    </div>

                    <section className="space-y-4">
                      <h4 className="text-lg font-bold">Industries Serviced</h4>
                      <div className="flex flex-wrap gap-2">
                        {['Consumer and Beverage', 'Retail', 'Steel and Materials', 'Mining', 'Automotive and Industrials', 'Chemicals and Agriculture'].map(i => (
                          <Badge key={i} variant="secondary" className="px-3 py-1">{i}</Badge>
                        ))}
                      </div>
                    </section>
                  </div>

                  <div className="space-y-6">
                    <h4 className="text-lg font-bold uppercase tracking-widest text-muted-foreground">Key Statistics</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <StatCard label="Weekly Rail" value="330" />
                      <StatCard label="DIFOT" value="98.5%" />
                      <StatCard label="Shipping Vessels" value="1,000+" />
                      <StatCard label="Linehaul Fleet" value="800+" />
                      <StatCard label="Annual TEU (TAS)" value="250k" />
                      <StatCard label="TAS Fleet KM" value="4.3m" />
                    </div>
                    <Card className="bg-primary/5 border-primary/20">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold">Competitive Advantages</CardTitle>
                      </CardHeader>
                      <CardContent className="text-xs space-y-2 text-muted-foreground">
                        <p>• Customised supply chain design.</p>
                        <p>• Unmatched regional representation.</p>
                        <p>• Highest rail frequency in Australia.</p>
                        <p>• Chain of Responsibility expertise.</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              {/* PALLETS TAB */}
              <TabsContent value="pallets" className="mt-0 focus-visible:ring-0">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                  <div className="lg:col-span-2 space-y-8">
                    <section className="space-y-4">
                      <h3 className="text-2xl font-bold flex items-center gap-2">
                        <Anchor className="h-6 w-6 text-primary" /> 
                        Palletised Express
                      </h3>
                      <p className="text-muted-foreground leading-relaxed">
                        Pallets provide a smart, economical way of moving many boxes within one unit, minimising manual handling and ensuring product integrity. At TGE, we utilise Australia’s most extensive logistics network to deliver pallets to more locations than any other supplier, including the places no one else can reach.
                      </p>
                    </section>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FeatureItem 
                        icon={Zap} 
                        title="Express Services" 
                        description="Time-slotted linehaul runs ensuring speed-to-market for palletised freight." 
                      />
                      <FeatureItem 
                        icon={ShieldCheck} 
                        title="Safety Leadership" 
                        description="NHVAS accredited with a market-leading focus on Chain of Responsibility and drug/alcohol testing." 
                      />
                      <FeatureItem 
                        icon={Globe} 
                        title="Item Level Tracking" 
                        description="One of the first general carriers to offer ILFT, providing full visibility from pickup to delivery." 
                      />
                      <FeatureItem 
                        icon={Layers} 
                        title="Diverse Equipment" 
                        description="High cube mezzanine-floored vehicles and state-of-the-art fleet to reduce vehicle breakdowns." 
                      />
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h4 className="text-lg font-bold uppercase tracking-widest text-muted-foreground">At a Glance</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <StatCard label="Annual Pallets" value="2.6m" />
                      <StatCard label="Total Tonnes" value="2.3m" />
                      <StatCard label="Total Depots" value="35" />
                      <StatCard label="Regional Depots" value="28" />
                    </div>
                    <div className="p-4 bg-muted/30 rounded-lg space-y-3">
                      <h5 className="font-bold text-sm">Freight Profile</h5>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs"><span>Standard Pallets</span><span className="font-bold text-primary">65%</span></div>
                        <Separator />
                        <div className="flex justify-between text-xs"><span>"Uglies"</span><span className="font-bold text-primary">20%</span></div>
                        <Separator />
                        <div className="flex justify-between text-xs"><span>Hand Unload Smalls</span><span className="font-bold text-primary">15%</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* EXPRESS PARCELS TAB */}
              <TabsContent value="parcels" className="mt-0 focus-visible:ring-0">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                  <div className="lg:col-span-2 space-y-8">
                    <section className="space-y-4">
                      <h3 className="text-2xl font-bold flex items-center gap-2">
                        <Box className="h-6 w-6 text-primary" /> 
                        Express Parcels
                      </h3>
                      <p className="text-muted-foreground leading-relaxed">
                        Designed for speed and reliability. We operate Australia’s largest air freighter network, providing time-critical solutions from capital cities to the most remote sites across the country.
                      </p>
                    </section>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FeatureItem 
                        icon={Plane} 
                        title="Dedicated Air Network" 
                        description="40 dedicated TGE aircraft making 525 scheduled flights per week for maximum uplift options." 
                      />
                      <FeatureItem 
                        icon={ShoppingCart} 
                        title="eCommerce Strategy" 
                        description="New Priority Network tailored for B2C deliveries, offering 1-2 day commits for satchels and cartons." 
                      />
                      <FeatureItem 
                        icon={Clock} 
                        title="24/7 Availability" 
                        description="Dedicated customer service and pickup fleet available 24 hours a day, 365 days a year." 
                      />
                      <FeatureItem 
                        icon={Target} 
                        title="Specialist Handling" 
                        description="Experience with lifesaving deliveries, dangerous goods, and garment-on-hanger retail solutions." 
                      />
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h4 className="text-lg font-bold uppercase tracking-widest text-muted-foreground">Network Scale</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <StatCard label="Air Flights /wk" value="525" />
                      <StatCard label="Service Points" value="18,464" />
                      <StatCard label="Toll Road Fleet" value="2,400+" />
                      <StatCard label="Depots & Agencies" value="500+" />
                    </div>
                    <Card className="bg-primary/5 border-primary/20">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold text-center">B2C Weight Limit</CardTitle>
                      </CardHeader>
                      <CardContent className="text-center">
                        <p className="text-3xl font-bold text-primary">22kg</p>
                        <p className="text-[10px] text-muted-foreground uppercase mt-1">Max combined dims (L+W+H) 120cm</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              {/* COURIER TAB */}
              <TabsContent value="courier" className="mt-0 focus-visible:ring-0">
                <div className="space-y-8">
                  <section className="space-y-4">
                    <h3 className="text-2xl font-bold flex items-center gap-2">
                      <Truck className="mr-2 h-6 w-6 text-primary" /> 
                      Courier Services
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Courier is the largest and most responsive local transport company in Australia. From point-to-point bicycle couriers in the CBD through to specialized heavy haulage taxi trucks, we adapt to every "on-demand" need with last-mile coverage.
                    </p>
                  </section>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card>
                      <CardHeader><CardTitle className="text-base">On-Demand</CardTitle></CardHeader>
                      <CardContent className="text-sm text-muted-foreground">Fast, flexible delivery solutions across all capital cities with point-to-point speed.</CardContent>
                    </Card>
                    <Card>
                      <CardHeader><CardTitle className="text-base">Permanent Daily</CardTitle></CardHeader>
                      <CardContent className="text-sm text-muted-foreground">Dedicated metro runs with fixed delivery times and consistent vehicles/drivers.</CardContent>
                    </Card>
                    <Card>
                      <CardHeader><CardTitle className="text-base">Specialised Fleet</CardTitle></CardHeader>
                      <CardContent className="text-sm text-muted-foreground">Access to trucks, specialized vehicles, and dedicated contract fleets for complex moves.</CardContent>
                    </Card>
                  </div>

                  <div className="bg-muted/30 p-6 rounded-lg grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <h4 className="font-bold">Key Capabilities</h4>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Full track and trace at item level</li>
                        <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Sign-on-glass electronic POD</li>
                        <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Night-time delivery options</li>
                        <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Empathy Program driver training</li>
                      </ul>
                    </div>
                    <div className="space-y-4">
                      <h4 className="font-bold">Industries</h4>
                      <div className="flex flex-wrap gap-2">
                        {['Automotive', 'Healthcare', 'Technology', 'Consumer & Retail', 'Government', 'Law Firms'].map(i => <Badge key={i} variant="outline">{i}</Badge>)}
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* NETWORK TAB */}
              <TabsContent value="network" className="mt-0 focus-visible:ring-0">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                  <div className="lg:col-span-2 space-y-8">
                    <section className="space-y-4">
                      <h3 className="text-2xl font-bold flex items-center gap-2">
                        <Globe className="h-6 w-6 text-primary" /> 
                        Our Brand & Network
                      </h3>
                      <p className="text-muted-foreground leading-relaxed">
                        Team Global Express has unrivalled scale, reach, and speed. Our network spans Australia and New Zealand, providing flexible delivery solutions to communities across this extensive landscape. We are strategic partners, helping customers achieve unparalleled supply chain success.
                      </p>
                    </section>

                    <div className="p-6 border rounded-lg bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 dark:bg-green-900 rounded-full">
                          <Zap className="h-6 w-6 text-green-600" />
                        </div>
                        <h4 className="text-lg font-bold text-green-800 dark:text-green-300">Sustainability: Depot of the Future</h4>
                      </div>
                      <p className="text-sm text-green-700 dark:text-green-400">
                        In partnership with ARENA, we are investing $44.3 million in our vehicle electrification project. This includes 60 large electric trucks and renewable energy charging infrastructure to reduce our carbon footprint.
                      </p>
                    </div>

                    <FeatureItem 
                      icon={Briefcase} 
                      title="Strategic Partnerships" 
                      description="We are more than a logistics provider; we are strategic partners aiding in expansion and supply chain resilience." 
                    />
                  </div>

                  <div className="space-y-6">
                    <h4 className="text-lg font-bold uppercase tracking-widest text-muted-foreground">National Reach</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <StatCard label="Postcodes Serviced" value="18,000+" />
                      <StatCard label="Depots & Agencies" value="650+" />
                      <StatCard label="Owned Depots" value="68" />
                      <StatCard label="Efficiency Gain" value="25%" />
                    </div>
                    <div className="p-4 bg-muted/30 rounded-lg space-y-3">
                      <div className="flex items-center gap-2">
                        <Info className="h-4 w-4 text-primary" />
                        <h5 className="font-bold text-sm">Efficient Logistics</h5>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Our network utilizes 25% more efficient Super B-Double vehicles and ensures minimal hand-offs to third parties, maintaining integrity from collection to delivery.
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

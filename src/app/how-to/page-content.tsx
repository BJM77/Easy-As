"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { 
  BookOpen, 
  CreditCard, 
  LayoutDashboard, 
  Calculator, 
  Sparkles, 
  Layers, 
  Settings, 
  Key, 
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Truck,
  ArrowRight,
  Info,
  Mail,
  Zap,
  Lock,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function HowToPageContent() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);
  const sections = [
    {
      id: 'pricing',
      title: '1. Pricing & Monetization',
      icon: CreditCard,
      color: 'text-blue-500',
      content: (
        <div className="space-y-6">
          <p className="text-muted-foreground">
            This application operates on a simple and affordable pricing model designed to provide maximum value.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" /> Full-Featured Subscription
                </CardTitle>
                <CardDescription>For BDM, RSM, and Admin Roles</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span><strong>Subscription:</strong> $10 per month (paid annually).</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span><strong>AI Usage:</strong> Includes 100,000 AI tokens per month.</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span><strong>Live Tracking:</strong> One (1) delivery run per day.</span>
                </div>
              </CardContent>
            </Card>
            <Card className="border-accent/20 bg-accent/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Truck className="h-5 w-5 text-accent" /> Agent / Customer Subscription
                </CardTitle>
                <CardDescription>For our valued partners</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span><strong>Pricing:</strong> $5/mo (first user), $2/mo (additional).</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span><strong>Features:</strong> Core tools (Calc, Lookup, Info Hub).</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  <span><strong>Policy:</strong> Limited to one active session at a time.</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )
    },
    {
      id: 'dashboard',
      title: '2. Dashboard',
      icon: LayoutDashboard,
      color: 'text-indigo-500',
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">The Dashboard is your command center, providing an at-a-glance overview of key metrics and quick access to tools.</p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
            <li className="flex gap-3">
              <div className="mt-1 bg-indigo-100 p-1 rounded-full"><Zap className="h-3 w-3 text-indigo-600" /></div>
              <div>
                <p className="font-semibold text-sm">Quick Actions</p>
                <p className="text-xs text-muted-foreground">One-click access to frequently used tools, customizable in settings.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <div className="mt-1 bg-indigo-100 p-1 rounded-full"><Zap className="h-3 w-3 text-indigo-600" /></div>
              <div>
                <p className="font-semibold text-sm">Live Rates</p>
                <p className="text-xs text-muted-foreground">Real-time Fuel and Security surcharges fetched via AI agents.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <div className="mt-1 bg-indigo-100 p-1 rounded-full"><Zap className="h-3 w-3 text-indigo-600" /></div>
              <div>
                <p className="font-semibold text-sm">Problem Log Summary</p>
                <p className="text-xs text-muted-foreground">Snapshot of service issues with AI pattern analysis.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <div className="mt-1 bg-indigo-100 p-1 rounded-full"><Zap className="h-3 w-3 text-indigo-600" /></div>
              <div>
                <p className="font-semibold text-sm">Recent Activity</p>
                <p className="text-xs text-muted-foreground">Quickly jump back into your recent proposals or analyses.</p>
              </div>
            </li>
          </ul>
        </div>
      )
    },
    {
      id: 'calculator',
      title: '3. Freight Calculator',
      icon: Calculator,
      color: 'text-orange-500',
      content: (
        <div className="space-y-6">
          <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r-lg">
            <p className="text-sm text-orange-800 font-medium">Core tool for generating quotes for any TGE service.</p>
          </div>
          <div className="space-y-4">
            <h4 className="font-bold flex items-center gap-2"><ArrowRight className="h-4 w-4 text-orange-500" /> How to Use:</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm ml-4">
              <li>Select a <strong>Spend Band</strong>.</li>
              <li>Enter an <strong>Origin</strong> and <strong>Destination</strong> (use autocomplete).</li>
              <li>Enter <strong>Item Details</strong> (Weight, Dimensions, Quantity).</li>
              <li>Select <strong>Additional Requirements</strong> (Hand Unload, DG, etc.).</li>
              <li>Optional: Use <strong>Manual Rate Entry</strong> for competitor comparisons.</li>
              <li>Click <strong>Calculate Prices</strong>.</li>
            </ol>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg hover:border-orange-200 transition-colors">
              <h5 className="font-semibold mb-2 flex items-center gap-2"><Truck className="h-4 w-4 text-orange-500" /> Best Rates Overview</h5>
              <p className="text-xs text-muted-foreground">The top card highlights the most cost-effective service in each category.</p>
            </div>
            <div className="p-4 border rounded-lg hover:border-orange-200 transition-colors">
              <h5 className="font-semibold mb-2 flex items-center gap-2"><Mail className="h-4 w-4 text-orange-500" /> Email Quote</h5>
              <p className="text-xs text-muted-foreground">Generate pre-filled emails to send quotes directly to customers.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'ai-guru',
      title: '4. Perfect Plan / AI Guru',
      icon: Sparkles,
      color: 'text-purple-500',
      content: (
        <div className="space-y-6">
          <p className="text-muted-foreground font-medium">A powerful wizard for creating comprehensive new business proposals.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-bold flex items-center gap-2"><ArrowRight className="h-4 w-4 text-purple-500" /> Key Features:</h4>
              <ul className="space-y-3">
                <li className="flex gap-3 text-sm">
                  <div className="bg-purple-100 p-1 h-fit rounded"><CheckCircle2 className="h-3 w-3 text-purple-600" /></div>
                  <span><strong>AI Spend Band Analysis:</strong> Recommends the optimal spend band based on volume.</span>
                </li>
                <li className="flex gap-3 text-sm">
                  <div className="bg-purple-100 p-1 h-fit rounded"><CheckCircle2 className="h-3 w-3 text-purple-600" /></div>
                  <span><strong>Pricing Comparison:</strong> Instantly see TGE prices vs target prices with savings.</span>
                </li>
              </ul>
            </div>
            <div className="space-y-4">
               <h4 className="font-bold flex items-center gap-2"><ArrowRight className="h-4 w-4 text-purple-500" /> Output:</h4>
              <ul className="space-y-3">
                <li className="flex gap-3 text-sm">
                  <div className="bg-purple-100 p-1 h-fit rounded"><CheckCircle2 className="h-3 w-3 text-purple-600" /></div>
                  <span><strong>Reciprocal Rate Cards:</strong> Full rate sheets from any origin to all zones.</span>
                </li>
                <li className="flex gap-3 text-sm">
                  <div className="bg-purple-100 p-1 h-fit rounded"><CheckCircle2 className="h-3 w-3 text-purple-600" /></div>
                  <span><strong>Proposal Editor:</strong> Professional, multi-page branded documents.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'comparisons',
      title: '5. Comparison Suite',
      icon: Layers,
      color: 'text-emerald-500',
      content: (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { label: 'Rate Card', desc: 'Direct generation for multiple locations.', href: '/rate-card' },
            { label: 'SB Comparison', desc: 'Compare all bands for a single leg.', href: '/sb-comparison' },
            { label: 'New/Old Rates', desc: 'Price differences across structures.', href: '/rate-comparison' },
            { label: 'CRC', desc: 'Bulk competitor data analysis.', href: '/competitor-comparison' },
            { label: 'Multi-Leg', desc: 'Direct vs via intermediate hubs.', href: '/multi' },
            { label: 'Leg Discount', desc: 'Reverse-engineer per-kilo rates.', href: '/leg-discount' },
          ].map((item, i) => (
            <div key={i} className="p-4 border rounded-lg bg-emerald-50/30 hover:bg-emerald-50 transition-colors group">
              <h5 className="font-bold text-sm mb-1 group-hover:text-emerald-700 transition-colors">{item.label}</h5>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      )
    },
    {
      id: 'admin',
      title: '6. Admin & Management Tools',
      icon: Settings,
      color: 'text-gray-500',
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">Advanced tools for managing application data, settings, and diagnostics.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="p-4">
                <CardTitle className="text-sm font-bold flex items-center gap-2"><Settings className="h-4 w-4" /> Global Settings</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-xs text-muted-foreground space-y-1">
                <p>• Manage Fuel & Security surcharges</p>
                <p>• Define custom fees</p>
                <p>• Edit email quote templates</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="p-4">
                <CardTitle className="text-sm font-bold flex items-center gap-2"><Layers className="h-4 w-4" /> Data Tools</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-xs text-muted-foreground space-y-1">
                <p>• CSV to JSON Converter</p>
                <p>• Universal Location Lookup</p>
                <p>• Rate Uploader & Overrides</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )
    },
    {
      id: 'developer',
      title: '7. Developer Overrides (Zip)',
      icon: Key,
      color: 'text-red-500',
      content: (
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 p-4 rounded-lg flex gap-4 items-start">
            <AlertCircle className="h-5 w-5 text-red-500 mt-1 flex-shrink-0" />
            <div className="text-sm text-red-900">
              <p className="font-bold mb-1">Temporary Session Overrides</p>
              <p>Ideal for testing new rate structures or using personal API keys without modifying source code.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <p className="font-bold">How to Use:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Click the <strong>Key icon</strong> in the header.</li>
                <li>Upload a <code>.zip</code> file with rates or keys.</li>
                <li>Session lasts until browser is closed.</li>
              </ol>
            </div>
            <div className="space-y-2">
              <p className="font-bold"><code>api_keys.json</code> Example:</p>
              <pre className="bg-muted p-2 rounded text-[10px] overflow-auto">
{`{
  "gemini_api_key_override": "...",
  "maps_directions_api_key_override": "..."
}`}
              </pre>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'security',
      title: '8. Security Overview',
      icon: Lock,
      color: 'text-slate-500',
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">Built with security as a priority, leveraging modern web technologies and Firebase infrastructure.</p>
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="flex-1 space-y-2">
              <h5 className="font-bold text-sm flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /> Multi-Layered Defense</h5>
              <p className="text-xs text-muted-foreground">Combining front-end role restrictions with server-side Firebase Security Rules for robust access control.</p>
            </div>
            <div className="flex-1 space-y-2">
              <h5 className="font-bold text-sm flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-blue-500" /> Encrypted Transmission</h5>
              <p className="text-xs text-muted-foreground">All data transmission is secured using standard HTTPS protocols, protecting against data breaches.</p>
            </div>
          </div>
        </div>
      )
    }
  ];

  if (loading || !user) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-20">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl mb-2">
          <BookOpen className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-4xl md:text-5xl font-black font-headline tracking-tight">Master How-To Guide</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Welcome to your Just Easy BD Assistant! Everything you need to secure new business and analyze freight data.
        </p>
      </div>

      <Separator />

      <div className="grid grid-cols-1 gap-12">
        {sections.map((section, idx) => (
          <section key={section.id} id={section.id} className="scroll-mt-24 group">
            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="md:w-1/4 sticky top-24">
                <div className={cn("flex items-center gap-3 mb-2 font-black font-headline text-lg", section.color)}>
                  <section.icon className="h-6 w-6" />
                  <span>{section.title.split('. ')[1]}</span>
                </div>
                <div className="h-1 w-12 bg-muted group-hover:bg-primary transition-colors mb-4" />
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">SECTION {idx + 1}</p>
              </div>
              <Card className="flex-1 shadow-md group-hover:shadow-xl transition-all duration-300 border-primary/5">
                <CardContent className="p-8">
                  {section.content}
                </CardContent>
              </Card>
            </div>
          </section>
        ))}
      </div>

      <div className="bg-primary text-primary-foreground p-12 rounded-3xl text-center space-y-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Sparkles className="h-32 w-32" />
        </div>
        <h2 className="text-3xl font-black font-headline">Ready to boost your business?</h2>
        <p className="text-primary-foreground/80 max-w-xl mx-auto">
          If you have any further questions that aren't covered in this guide, our team is always here to help.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <a href="/info" className="bg-accent text-accent-foreground px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:scale-105 transition-transform">
            <Info className="h-5 w-5" /> Visit Info Hub
          </a>
          <a href="/calculator" className="bg-primary-foreground text-primary px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:scale-105 transition-transform">
            <Calculator className="h-5 w-5" /> Start Calculating
          </a>
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useState, useEffect } from 'react';
import { useAuth, useFirestore } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Palette, Save, Building2, Type, RefreshCw, MousePointer2 } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { Separator } from '@/components/ui/separator';

export default function BrandingPageContent() {
  const { company, role } = useAuth();
  const { toast } = useToast();
  const firestore = useFirestore();

  const [isSaving, setIsSaving] = useState(false);
  const [logoText, setLogoText] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#616161');
  const [accentColor, setAccentColor] = useState('#ffa857');
  const [topMenuColor, setTopMenuColor] = useState('#ffffff');
  const [hoverColor, setHoverColor] = useState('#3d3d3d');

  useEffect(() => {
    if (company) {
      setLogoText(company.settings?.logoText || company.name);
      setPrimaryColor(company.settings?.primaryColor || '#616161');
      setAccentColor(company.settings?.accentColor || '#ffa857');
      setTopMenuColor(company.settings?.topMenuColor || '#ffffff');
      setHoverColor(company.settings?.hoverColor || '#3d3d3d');
    }
  }, [company]);

  const handleSave = async () => {
    if (!company?.id || !firestore) {
      toast({ title: 'Configuration Error', description: 'Organization context not loaded. Please select a tenant first.', variant: 'destructive' });
      return;
    }
    setIsSaving(true);

    try {
      const docRef = doc(firestore, 'companies', company.id);
      await updateDoc(docRef, {
        settings: {
          ...company.settings,
          logoText,
          primaryColor,
          accentColor,
          topMenuColor,
          hoverColor
        }
      });
      toast({ title: 'Branding Updated', description: 'Your company theme has been saved and will apply to all users.' });
    } catch (error: any) {
      console.error("Save branding error:", error);
      toast({ title: 'Update Failed', description: error.message || 'An error occurred while saving branding.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setLogoText(company?.name || 'Just Easy');
    setPrimaryColor('#616161');
    setAccentColor('#ffa857');
    setTopMenuColor('#ffffff');
    setHoverColor('#3d3d3d');
    toast({ title: "Defaults Loaded", description: "Click Apply to save these settings." });
  };

  if (role !== 'admin' && role !== 'superadmin') {
    return <Card className="m-8"><CardContent className="pt-6">Unauthorized access.</CardContent></Card>;
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-20">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <Palette className="mr-2 h-7 w-7 text-primary" /> Company Branding Portal
          </CardTitle>
          <CardDescription>
            Personalize your organization's environment. Changes here update the interface for all your team members instantly.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-lg flex items-center"><Type className="mr-2 h-5 w-5 text-primary" /> Visual Identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="logo-text">Logo Text Display</Label>
              <Input id="logo-text" value={logoText} onChange={e => setLogoText(e.target.value)} placeholder="Enter organization name" />
              <p className="text-[10px] text-muted-foreground italic">This text appears in the top header.</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Main Menu Colour</Label>
                <div className="flex gap-2">
                  <Input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="h-10 w-12 p-1" />
                  <Input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="h-10 font-mono text-xs" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Accent Color</Label>
                <div className="flex gap-2">
                  <Input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)} className="h-10 w-12 p-1" />
                  <Input value={accentColor} onChange={e => setAccentColor(e.target.value)} className="h-10 font-mono text-xs" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Top Menu Colour</Label>
                <div className="flex gap-2">
                  <Input type="color" value={topMenuColor} onChange={e => setTopMenuColor(e.target.value)} className="h-10 w-12 p-1" />
                  <Input value={topMenuColor} onChange={e => setTopMenuColor(e.target.value)} className="h-10 font-mono text-xs" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Role Over Colour</Label>
                <div className="flex gap-2">
                  <Input type="color" value={hoverColor} onChange={e => setHoverColor(e.target.value)} className="h-10 w-12 p-1" />
                  <Input value={hoverColor} onChange={e => setHoverColor(e.target.value)} className="h-10 font-mono text-xs" />
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="bg-muted/30 border-t py-3">
            <Button variant="ghost" size="sm" onClick={handleReset} className="text-xs">
              <RefreshCw className="mr-1.5 h-3 w-3" /> Reset to Defaults
            </Button>
          </CardFooter>
        </Card>

        <Card className="shadow-md overflow-hidden">
          <CardHeader className="bg-muted/30 pb-3 border-b">
            <CardTitle className="text-lg">Live Preview</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="border rounded-lg overflow-hidden shadow-inner bg-zinc-50 dark:bg-zinc-900">
              {/* Top Bar Preview */}
              <div className="h-6 w-full flex items-center px-4 justify-between text-[10px]" style={{ backgroundColor: topMenuColor }}>
                <span className="text-zinc-500">Top Menu / Sub-Header</span>
                <div className="flex gap-2">
                    <div className="h-2 w-8 rounded-full bg-zinc-300"></div>
                    <div className="h-2 w-8 rounded-full bg-zinc-300"></div>
                </div>
              </div>
              {/* Header Preview */}
              <div className="h-12 w-full flex items-center px-4 gap-3 text-white font-bold" style={{ backgroundColor: primaryColor }}>
                <Building2 className="h-5 w-5" style={{ color: accentColor }} />
                <span className="text-sm">{logoText || 'Your Brand'}</span>
                <div className="flex-grow"></div>
                <div className="flex gap-2">
                    <div className="h-6 w-6 rounded bg-white/20"></div>
                    <div className="h-6 w-6 rounded bg-white/20"></div>
                </div>
              </div>
              {/* Menu Preview */}
              <div className="p-4 bg-white dark:bg-black border-b flex gap-2">
                <div className="px-3 py-1 rounded text-[10px] font-bold text-white flex items-center gap-1" style={{ backgroundColor: hoverColor }}>
                    <MousePointer2 className="h-3 w-3" /> Role Over
                </div>
                <div className="px-3 py-1 rounded text-[10px] border">Normal Link</div>
              </div>
              <div className="p-6 space-y-4 bg-white dark:bg-black">
                <div className="space-y-2">
                  <div className="h-2 w-3/4 rounded bg-gray-200 dark:bg-gray-800"></div>
                  <div className="h-2 w-1/2 rounded bg-gray-200 dark:bg-gray-800"></div>
                </div>
                <div className="flex gap-2">
                  <div className="h-8 w-24 rounded shadow-sm" style={{ backgroundColor: accentColor }}></div>
                  <div className="h-8 w-24 rounded shadow-sm border border-input"></div>
                </div>
              </div>
            </div>
            <p className="text-xs text-center text-muted-foreground">This preview shows how your chosen colors interact.</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end pt-4 border-t">
        <Button onClick={handleSave} disabled={isSaving} className="min-w-[150px]">
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Apply Branding
        </Button>
      </div>
    </div>
  );
}
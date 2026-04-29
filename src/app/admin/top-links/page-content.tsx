"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/firebase';
import { useSettings } from '@/context/SettingsContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  Link as LinkIcon, 
  PlusCircle, 
  Trash2, 
  Save, 
  Loader2, 
  GripVertical,
  Briefcase,
  Cloud,
  Globe,
  ExternalLink as ExternalLinkIcon,
  ShieldCheck,
  Lock
} from 'lucide-react';
import type { ExternalLink } from '@/lib/types';
import { verifyAdminPassword } from '@/ai/flows/admin-auth-flow';

const MAX_LINKS = 5;

const availableIcons = {
  'Briefcase': Briefcase,
  'Cloud': Cloud,
  'Globe': Globe,
  'ExternalLink': ExternalLinkIcon,
  'Link': LinkIcon
};

export default function TopLinksPageContent() {
  const { role } = useAuth();
  const { externalLinks, setExternalLinks, saveSettingsToServer } = useSettings();
  const { toast } = useToast();

  const [localLinks, setLocalLinks] = useState<ExternalLink[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newIcon, setNewIcon] = useState('Link');
  const [savePassword, setSavePassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isPasswordValid, setIsPasswordValid] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    setLocalLinks(externalLinks);
  }, [externalLinks]);

  useEffect(() => {
    const validate = async () => {
      if (!savePassword) {
        setIsPasswordValid(false);
        return;
      }
      const isValid = await verifyAdminPassword(savePassword);
      setIsPasswordValid(isValid);
    };
    const timer = setTimeout(validate, 300);
    return () => clearTimeout(timer);
  }, [savePassword]);

  const handleAddLink = () => {
    if (localLinks.length >= MAX_LINKS) {
      toast({ title: "Limit Reached", description: `You can only have up to ${MAX_LINKS} links.`, variant: "destructive" });
      return;
    }
    if (!newLabel || !newUrl) return;

    const newLink: ExternalLink = {
      id: `link-${Date.now()}`,
      label: newLabel,
      url: newUrl.startsWith('http') ? newUrl : `https://${newUrl}`,
      icon: newIcon
    };

    setLocalLinks([...localLinks, newLink]);
    setNewLabel('');
    setNewUrl('');
  };

  const handleRemoveLink = (id: string) => {
    setLocalLinks(localLinks.filter(l => l.id !== id));
  };

  const handleSaveChanges = async () => {
    if (!isPasswordValid) return;
    setIsSaving(true);
    setExternalLinks(localLinks);
    const success = await saveSettingsToServer(savePassword);
    if (success) {
      toast({ title: "Success", description: "Global links updated." });
    }
    setIsSaving(false);
  };

  if (role !== 'admin' && role !== 'superadmin') {
    return <div className="p-20 text-center">Unauthorized.</div>;
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-20">
      <Card className="shadow-xl border-t-4 border-primary">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <LinkIcon className="mr-2 h-7 w-7 text-primary" /> Top Links Management
          </CardTitle>
          <CardDescription>Manage global external links displayed in the top banner.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Add New Link</CardTitle></CardHeader>
        <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1"><Label>Label</Label><Input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="e.g. SharePoint" /></div>
                <div className="space-y-1"><Label>URL</Label><Input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="e.g. company.com" /></div>
                <div className="flex items-end"><Button onClick={handleAddLink} className="w-full" variant="outline" disabled={localLinks.length >= MAX_LINKS}><PlusCircle className="mr-2 h-4 w-4"/> Add to List</Button></div>
            </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Current Links ({localLinks.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
            {localLinks.map((link, idx) => (
                <div key={link.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border group">
                    <GripVertical className="h-4 w-4 text-muted-foreground opacity-30" />
                    <div className="flex-grow">
                        <p className="text-sm font-bold">{link.label}</p>
                        <p className="text-[10px] text-muted-foreground truncate max-w-md">{link.url}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveLink(link.id)} className="opacity-0 group-hover:opacity-100 text-destructive"><Trash2 className="h-4 w-4"/></Button>
                </div>
            ))}
        </CardContent>
      </Card>

      <Card className="bg-primary/5 border-primary">
        <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="space-y-1 flex-grow">
                    <Label className="flex items-center gap-2 text-[10px] uppercase font-black tracking-widest"><Lock className="h-3 w-3" /> Admin Auth</Label>
                    <Input type="password" value={savePassword} onChange={e => setSavePassword(e.target.value)} placeholder="Enter password..."/>
                </div>
                <Button onClick={handleSaveChanges} disabled={isSaving || !isPasswordValid} className="px-10">
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>} Update Global Links
                </Button>
            </div>
            {!isPasswordValid && savePassword && <p className="text-[10px] text-destructive mt-2">Incorrect password.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

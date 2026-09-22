
"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/context/SettingsContext';
import type { ExternalLink } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Trash2, BarChart, Package, Cloud, Briefcase, FileSignature, DollarSign, Mail, User, BookOpen, Layers, Orbit, Compass, Link2, AtSign, Frown, ALargeSmall, Truck, Building, Info } from 'lucide-react';
import { ALL_TIMEZONES } from '@/lib/types';


export const availableIcons = {
  BarChart: BarChart,
  Package: Package,
  Cloud: Cloud,
  Briefcase: Briefcase,
  FileSignature: FileSignature,
  DollarSign: DollarSign,
  Mail: Mail,
  User: User,
  BookOpen: BookOpen,
  Layers: Layers,
  Orbit: Orbit,
  Compass: Compass,
  Link2: Link2,
  AtSign: AtSign,
  Frown: Frown,
  ALargeSmall: ALargeSmall,
  Truck: Truck,
  Building: Building,
  Info: Info,
  W: () => <span className="font-bold w-4 h-4 flex items-center justify-center">W</span>,
  M: () => <span className="font-bold w-4 h-4 flex items-center justify-center">M</span>,
};
type IconKey = keyof typeof availableIcons;

interface HeaderConfigDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export default function HeaderConfigDialog({ isOpen, onOpenChange }: HeaderConfigDialogProps) {
  const { 
    externalLinks, 
    setExternalLinks, 
    visibleTimezones, 
    setVisibleTimezones 
  } = useSettings();
  const { toast } = useToast();

  const [localLinks, setLocalLinks] = useState<ExternalLink[]>([]);
  const [localVisibleTimezones, setLocalVisibleTimezones] = useState<Record<string, boolean>>({});
  
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [newLinkURL, setNewLinkURL] = useState('');
  const [newLinkIcon, setNewLinkIcon] = useState<IconKey>('Link2');


  useEffect(() => {
    if (isOpen) {
      setLocalLinks([...externalLinks]);
      setLocalVisibleTimezones({...visibleTimezones});
    }
  }, [isOpen, externalLinks, visibleTimezones]);
  
  const handleAddLink = () => {
    if (!newLinkLabel.trim() || !newLinkURL.trim()) {
        toast({ title: 'Invalid Link', description: 'Please provide a label and a valid URL.', variant: 'destructive'});
        return;
    }
    setLocalLinks(prev => [...prev, { id: `link-${Date.now()}`, label: newLinkLabel, url: newLinkURL, icon: newLinkIcon }]);
    setNewLinkLabel('');
    setNewLinkURL('');
    setNewLinkIcon('Link2');
  };

  const handleRemoveLink = (id: string) => {
    setLocalLinks(prev => prev.filter(link => link.id !== id));
  };
  
  const handleTimezoneToggle = (zoneId: string, checked: boolean) => {
    setLocalVisibleTimezones(prev => ({...prev, [zoneId]: checked }));
  };

  const handleSave = () => {
    setExternalLinks(localLinks);
    setVisibleTimezones(localVisibleTimezones);
    toast({ title: "Header Settings Saved", description: "Your customizations have been applied." });
    onOpenChange(false);
  };
  
  const handleToggleAllTimezones = (checked: boolean) => {
    const allToggled = Object.keys(ALL_TIMEZONES).reduce((acc, zoneId) => {
      acc[zoneId] = checked;
      return acc;
    }, {} as Record<string, boolean>);
    setLocalVisibleTimezones(allToggled);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Customize Header</DialogTitle>
          <DialogDescription>
            Manage external links and toggle timezone visibility in the top bar. Changes are saved locally to your browser.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-6 max-h-[60vh] overflow-y-auto pr-4">
            {/* Timezone Configuration */}
            <div className="space-y-3">
                <div className="flex justify-between items-center">
                    <Label className="text-lg font-semibold">Visible Timezones</Label>
                    <div className="flex items-center space-x-2">
                        <Checkbox id="toggle-all-tz" onCheckedChange={(checked) => handleToggleAllTimezones(Boolean(checked))} />
                        <Label htmlFor="toggle-all-tz" className="text-xs font-normal">Toggle All</Label>
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4 border rounded-md">
                    {Object.entries(ALL_TIMEZONES).map(([zoneId, {label}]) => (
                        <div key={zoneId} className="flex items-center space-x-2">
                            <Checkbox 
                                id={`tz-check-${zoneId}`}
                                checked={!!localVisibleTimezones[zoneId]}
                                onCheckedChange={(checked) => handleTimezoneToggle(zoneId, Boolean(checked))}
                            />
                            <Label htmlFor={`tz-check-${zoneId}`} className="font-normal">{label}</Label>
                        </div>
                    ))}
                </div>
            </div>

            {/* External Links Configuration */}
            <div className="space-y-3">
                <Label className="text-lg font-semibold">External Links</Label>
                <div className="space-y-2">
                    {localLinks.map((link) => (
                        <div key={link.id} className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
                            <Input value={link.label} readOnly className="h-8"/>
                            <Input value={link.url} readOnly className="h-8"/>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRemoveLink(link.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </div>
                    ))}
                </div>
                <div className="p-4 border border-dashed rounded-md space-y-3">
                    <h4 className="text-sm font-medium">Add New Link</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                         <div className="space-y-1">
                            <Label htmlFor="new-link-label">Label</Label>
                            <Input id="new-link-label" value={newLinkLabel} onChange={e => setNewLinkLabel(e.target.value)} placeholder="e.g., Power BI Home" />
                         </div>
                          <div className="space-y-1">
                            <Label htmlFor="new-link-url">URL</Label>
                            <Input id="new-link-url" value={newLinkURL} onChange={e => setNewLinkURL(e.target.value)} placeholder="https://..." />
                         </div>
                         <div className="space-y-1">
                            <Label htmlFor="new-link-icon">Icon</Label>
                             <Select value={newLinkIcon} onValueChange={(v) => setNewLinkIcon(v as IconKey)}>
                                <SelectTrigger id="new-link-icon">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.keys(availableIcons).map(iconKey => (
                                        <SelectItem key={iconKey} value={iconKey}>{iconKey}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                         </div>
                    </div>
                    <Button onClick={handleAddLink} size="sm"><PlusCircle className="mr-2 h-4 w-4"/>Add Link</Button>
                </div>
            </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

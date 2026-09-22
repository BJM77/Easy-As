"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { QuickActionKey } from '@/lib/types';
import { Calculator, Scale, ShieldAlert, Sparkles, FileText, BarChartHorizontalBig, GitCompareArrows, Route, Warehouse, FileUp, ExternalLink } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface QuickActionConfigDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  currentActions: QuickActionKey[];
  onSave: (newActions: QuickActionKey[]) => void;
}

export const ALL_QUICK_ACTIONS_MAP: Record<QuickActionKey, { label: string; href?: string; icon: LucideIcon; isDialog?: boolean }> = {
    'calculator': { label: 'New Quote', href: '/calculator', icon: Calculator },
    'competitor-comparison': { label: 'New CRC', href: '/competitor-comparison', icon: Scale },
    'problem-log': { label: 'Log Problem', href: '/problem-log', icon: ShieldAlert, isDialog: true },
    'ai-guru': { label: 'Perfect Plan', href: '/ai-guru', icon: Sparkles },
    'rate-card': { label: 'Rate Card', href: '/rate-card', icon: FileText },
    'sb-comparison': { label: 'Spend Band Comp', href: '/sb-comparison', icon: BarChartHorizontalBig },
    'rate-comparison': { label: 'New/Old Rates', href: '/rate-comparison', icon: GitCompareArrows },
    'multi': { label: 'Multi-Leg', href: '/multi', icon: Route },
    'location-lookup': { label: 'Location Lookup', href: '/location-lookup', icon: Warehouse },
    'csv-converter': { label: 'CSV to JSON', href: '/admin/csv-converter', icon: FileUp },
    'myteamge': { label: 'MyTeamGE', href: 'https://www.myteamge.com/group/guest/shipment?isEdit=true', icon: ExternalLink },
};

export default function QuickActionsConfigDialog({ isOpen, onOpenChange, currentActions, onSave }: QuickActionConfigDialogProps) {
  const [selectedActions, setSelectedActions] = useState<QuickActionKey[]>(currentActions);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      const validActions = currentActions.filter(a => ALL_QUICK_ACTIONS_MAP[a]);
      setSelectedActions(validActions);
    }
  }, [isOpen, currentActions]);

  const handleCheckedChange = (key: QuickActionKey, checked: boolean) => {
    let newSelection = [...selectedActions];
    if (checked) {
      if (newSelection.length < 4) {
        newSelection.push(key);
      } else {
        toast({ title: "Limit Reached", description: "You can select a maximum of 4 quick actions.", variant: "default" });
        return;
      }
    } else {
      newSelection = newSelection.filter(action => action !== key);
    }
    setSelectedActions(newSelection);
  };
  
  const handleSave = () => {
    onSave(selectedActions);
    onOpenChange(false);
    toast({title: "Quick Actions Updated"});
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configure Quick Actions</DialogTitle>
          <DialogDescription>
            Select up to 4 tools to display on your dashboard for easy access.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 grid grid-cols-2 gap-4">
            {Object.entries(ALL_QUICK_ACTIONS_MAP).map(([key, {label, icon: Icon}]) => (
                <div key={key} className="flex items-center space-x-2 p-2 border rounded-md">
                    <Checkbox
                        id={`qa-opt-${key}`}
                        checked={selectedActions.includes(key as QuickActionKey)}
                        onCheckedChange={(checked) => handleCheckedChange(key as QuickActionKey, Boolean(checked))}
                        disabled={!selectedActions.includes(key as QuickActionKey) && selectedActions.length >= 4}
                    />
                    <Label htmlFor={`qa-opt-${key}`} className="flex items-center gap-2 font-normal cursor-pointer">
                        <Icon className="h-4 w-4 text-muted-foreground"/>
                        {label}
                    </Label>
                </div>
            ))}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

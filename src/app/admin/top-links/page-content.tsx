import { verifyAdminPassword } from '@/ai/flows/admin-auth-flow';

"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/context/SettingsContext';
import { PlusCircle, Trash2, Link as LinkIcon, Save, Loader2, AlertCircle, GripVertical } from 'lucide-react';
import { availableIcons } from '@/components/HeaderConfigDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/firebase';
import { Separator } from '@/components/ui/separator';
import type { ExternalLink as ExternalLinkType } from '@/lib/types';
import { cn } from '@/lib/utils';

const MAX_LINKS = 15;

export default function TopLinksPageContent() {
  const { externalLinks, setExternalLinks, saveSettingsToServer } = useSettings();
  const { toast } = useToast();
  const { role } = useAuth();
  
  const [localLinks, setLocalLinks] = useState<ExternalLinkType[]>([]);
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkIcon, setNewLinkIcon] = useState<keyof typeof availableIcons>('Link2');
  
  const [isSaving, setIsSaving] = useState(false);
  const [isPasswordValid, setIsPasswordValid] = useState(false);
  useEffect(() => {
    const v = async () => { if(!password && !savePassword && !lcpPassword) return; const res = await verifyAdminPassword(password || savePassword || lcpPassword); setIsPasswordValid(res); };
    const t = setTimeout(v, 300);
    return () => clearTimeout(t);
  }, [password, savePassword, lcpPassword]);

  const [savePassword, setSavePassword] = useState('');

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    setLocalLinks([...externalLinks]);
  }, [externalLinks]);

  const handleAddLink = () => {
    if (localLinks.length >= MAX_LINKS) {
      toast({ title: "Limit Reached", description: `You can only have a maximum of ${MAX_LINKS} links.`, variant: "destructive" });
      return;
    }
    if (!newLinkLabel.trim() || !newLinkUrl.trim()) {
      toast({ title: "Invalid Input", description: "Please provide both a label and a URL.", variant: "destructive" });
      return;
    }

    const newLink: ExternalLinkType = {
      id: `link-${Date.now()}`,
      label: newLinkLabel.trim(),
      url: newLinkUrl.trim(),
      icon: newLinkIcon
    };

    const updatedLinks = [...localLinks, newLink];
    setLocalLinks(updatedLinks);
    setExternalLinks(updatedLinks); // Update local state
    
    setNewLinkLabel('');
    setNewLinkUrl('');
    setNewLinkIcon('Link2');
    toast({ title: "Link Added", description: `${newLink.label} added to your local session.` });
  };

  const handleRemoveLink = (id: string) => {
    const updatedLinks = localLinks.filter(l => l.id !== id);
    setLocalLinks(updatedLinks);
    setExternalLinks(updatedLinks); // Update local state
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    // Set transparent ghost image to avoid messy default browser dragging
    const ghost = new Image();
    ghost.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    e.dataTransfer.setDragImage(ghost, 0, 0);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newLinks = [...localLinks];
    const draggedItem = newLinks[draggedIndex];
    
    // Remove from old position, insert into new
    newLinks.splice(draggedIndex, 1);
    newLinks.splice(index, 0, draggedItem);
    
    setDraggedIndex(index);
    setLocalLinks(newLinks);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setExternalLinks(localLinks); // Finalize order in context
  };

  const handleSaveChanges = async () => {
    if (savePassword  === false) {
      toast({ title: "Unauthorized", description: "Incorrect password for server write.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    const success = await saveSettingsToServer(savePassword);
    if (success) {
      toast({ title: "Success", description: "Top banner links updated globally for all users." });
    }
    setIsSaving(false);
  };

  if (role !== 'admin' && role !== 'superadmin') {
    return <div className="p-8 text-center">Unauthorized Access</div>;
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <LinkIcon className="mr-2 h-7 w-7 text-primary" /> Top Links Management
          </CardTitle>
          <CardDescription>
            Manage and reorder the external links displayed in the top banner. Drag items to change their position. Maximum of {MAX_LINKS} links.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Current Banner Links ({localLinks.length}/{MAX_LINKS})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {localLinks.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No links configured.</p>
          ) : (
            <div className="space-y-2">
              {localLinks.map((link, index) => {
                const Icon = availableIcons[link.icon as keyof typeof availableIcons] || LinkIcon;
                const isDragging = draggedIndex === index;

                return (
                  <div 
                    key={link.id} 
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "flex items-center gap-3 p-3 border rounded-md transition-all",
                      isDragging ? "bg-primary/10 border-primary opacity-50 scale-[0.98]" : "bg-muted/30 hover:border-primary/50"
                    )}
                  >
                    <div className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded text-muted-foreground">
                      <GripVertical className="h-5 w-5" />
                    </div>
                    
                    <div className="p-2 bg-primary/10 rounded-md">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    
                    <div className="flex-grow min-w-0">
                      <p className="font-semibold truncate">{link.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{link.url}</p>
                    </div>
                    
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleRemoveLink(link.id)} 
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          <Separator className="my-6" />

          <div className="space-y-4 p-4 border border-dashed rounded-lg">
            <h3 className="font-semibold flex items-center"><PlusCircle className="mr-2 h-4 w-4" /> Add New Link</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="new-label">Link Label</Label>
                <Input id="new-label" value={newLinkLabel} onChange={e => setNewLinkLabel(e.target.value)} placeholder="e.g. MyTeamGE" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-url">URL</Label>
                <Input id="new-url" value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)} placeholder="https://..." />
              </div>
              <div className="space-y-1">
                <Label>Icon</Label>
                <Select value={newLinkIcon} onValueChange={(v) => setNewLinkIcon(v as keyof typeof availableIcons)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(availableIcons).map(iconKey => (
                      <SelectItem key={iconKey} value={iconKey}>{iconKey}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button onClick={handleAddLink} className="w-full" disabled={localLinks.length >= MAX_LINKS}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Add to List
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary bg-primary/5">
        <CardHeader>
          <CardTitle className="text-lg flex items-center text-primary">
            <Save className="mr-2 h-5 w-5" /> Save to Server
          </CardTitle>
          <CardDescription>
            Apply this link order globally for all users.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="space-y-1 flex-grow">
              <Label htmlFor="save-password">Server Write Password</Label>
              <Input 
                id="save-password" 
                type="password" 
                placeholder="Required to save..." 
                value={savePassword}
                onChange={(e) => setSavePassword(e.target.value)}
              />
            </div>
            <Button onClick={handleSaveChanges} disabled={isSaving || savePassword  === false} className="w-full sm:w-auto">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Update Global Links
            </Button>
          </div>
          {savePassword  === false && (
            <p className="text-xs text-muted-foreground mt-2 flex items-center">
              <AlertCircle className="mr-1 h-3 w-3 text-amber-500" /> 
              Enter the admin password to enable the save button.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

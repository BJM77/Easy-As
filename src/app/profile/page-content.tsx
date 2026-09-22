
"use client";

import React, { useState, useEffect } from 'react';
import { useAuth, useFirestore, updateDocumentNonBlocking } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, User, Mail, Shield, Building, Save, Key, UserCircle, Computer, FolderOpen, Info } from 'lucide-react';
import { doc } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useSettings } from '@/context/SettingsContext';
import { useRateOverrides } from '@/context/RateOverrideContext';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

export default function ProfilePageContent() {
  const { user, profile, company, role } = useAuth();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { isAccountManagerMode, setIsAccountManagerMode } = useSettings();
  const { linkLocalDirectory, localDirectoryName, isLocalLibrarySyncing } = useRateOverrides();

  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => {
    if (profile) {
      setName(profile.name);
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user || !firestore) return;
    setIsSaving(true);

    try {
      const userRef = doc(firestore, 'users', user.uid);
      updateDocumentNonBlocking(userRef, { name });
      toast({ title: 'Profile Updated', description: 'Your display name has been updated.' });
    } catch (error) {
      toast({ title: 'Update Failed', description: 'Could not update profile.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  if (!profile) return <div className="flex justify-center py-20"><Loader2 className="animate-spin h-12 w-12 text-primary" /></div>;

  return (
    <div className="space-y-8 max-w-2xl mx-auto pb-20">
      <Card className="shadow-xl overflow-hidden">
        <div className="h-32 bg-primary relative">
            <div className="absolute -bottom-12 left-8 p-1 bg-background rounded-full shadow-lg">
                <UserCircle className="h-24 w-24 text-muted-foreground fill-muted" />
            </div>
        </div>
        <CardHeader className="pt-16 pb-4">
          <div className="flex justify-between items-start">
            <div>
                <CardTitle className="text-3xl font-headline">{profile.name}</CardTitle>
                <CardDescription className="text-base">{profile.email}</CardDescription>
            </div>
            <Badge className="capitalize text-sm px-4 py-1">{role}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
            <Separator />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div className="space-y-1">
                        <Label className="flex items-center gap-2 text-muted-foreground"><User className="h-4 w-4"/> Display Name</Label>
                        <Input value={name} onChange={e => setName(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                        <Label className="flex items-center gap-2 text-muted-foreground"><Mail className="h-4 w-4"/> Email Address</Label>
                        <Input value={profile.email} disabled className="bg-muted/50" />
                    </div>
                </div>
                <div className="space-y-4">
                    <div className="space-y-1">
                        <Label className="flex items-center gap-2 text-muted-foreground"><Building className="h-4 w-4"/> Organization</Label>
                        <div className="p-2 border rounded-md bg-muted/30 font-semibold flex items-center justify-between">
                            {company?.name || 'Loading...'}
                            <Badge variant="outline" className="text-[10px]">{profile.companyId}</Badge>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <Label className="flex items-center gap-2 text-muted-foreground"><Key className="h-4 w-4"/> AI Token Balance</Label>
                        <div className="p-2 border rounded-md bg-primary/5 text-primary font-bold text-lg">
                            {profile.tokens?.toLocaleString() || 0} <span className="text-xs font-normal text-muted-foreground ml-1">Credits</span>
                        </div>
                    </div>
                </div>
            </div>
        </CardContent>
        <CardFooter className="bg-muted/30 border-t py-4 justify-end">
            <Button onClick={handleSave} disabled={isSaving || name === profile.name}>
                {isSaving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                Save Profile
            </Button>
        </CardFooter>
      </Card>

      <Card className="border-accent bg-accent/5">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Computer className="h-6 w-6 text-accent" />
                Power User: Account Manager Mode
              </CardTitle>
              <CardDescription>
                Enable this mode to link a local folder on your laptop. Perfect for managing 30+ custom rate cards without uploading to the cloud.
              </CardDescription>
            </div>
            <Switch 
              checked={isAccountManagerMode} 
              onCheckedChange={setIsAccountManagerMode}
            />
          </div>
        </CardHeader>
        {isAccountManagerMode && (
          <CardContent className="space-y-4 pt-4 border-t border-accent/10">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-background rounded-lg border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-accent/10 rounded-full">
                  <FolderOpen className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-bold">{localDirectoryName || 'No Folder Linked'}</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">
                    {localDirectoryName ? 'Syncing Active' : 'Select your rates folder'}
                  </p>
                </div>
              </div>
              <Button onClick={linkLocalDirectory} disabled={isLocalLibrarySyncing} variant="secondary">
                {isLocalLibrarySyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FolderOpen className="mr-2 h-4 w-4" />}
                Link Local Directory
              </Button>
            </div>
            
            <Alert className="bg-accent/10 border-accent/20">
              <Info className="h-4 w-4" />
              <AlertTitle className="text-xs font-bold">Local Workflow</AlertTitle>
              <AlertDescription className="text-[10px] leading-relaxed">
                Naming Convention: <code className="bg-accent/20 px-1 rounded">Service - AccountNumber.json</code>. <br/>
                Example: <code className="bg-accent/20 px-1 rounded">B2B Standard - 80272019.json</code>. Files stay on your machine and are only accessible by your browser.
              </AlertDescription>
            </Alert>
          </CardContent>
        )}
      </Card>

      <Card>
          <CardHeader>
              <CardTitle className="text-lg">Security & Privacy</CardTitle>
              <CardDescription>Managed by your organization administrator.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 border rounded-md bg-muted/10">
                  <div className="flex items-center gap-3">
                      <Shield className="h-5 w-5 text-blue-500" />
                      <div>
                          <p className="text-sm font-medium">Role Permissions</p>
                          <p className="text-xs text-muted-foreground">Your account has <strong>{role}</strong> level access.</p>
                      </div>
                  </div>
              </div>
          </CardContent>
      </Card>
    </div>
  );
}

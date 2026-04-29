"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/firebase';
import { useSettings } from '@/context/SettingsContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { ALL_SERVICES, ALL_USER_ROLES, type ServiceName, type UserRole } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Users, Save, Loader2, Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { verifyAdminPassword } from '@/ai/flows/admin-auth-flow';

export default function RoleSettingsPageContent() {
  const { role: currentUserRole } = useAuth();
  const { servicePermissions, setServicePermissionsForRole, saveSettingsToServer } = useSettings();
  const { toast } = useToast();
  
  const [localPermissions, setLocalPermissions] = useState(servicePermissions);
  const [isSaving, setIsSaving] = useState(false);
  const [savePassword, setSavePassword] = useState('');
  const [isPasswordValid, setIsPasswordValid] = useState(false);

  useEffect(() => {
    const v = async () => {
      if (!savePassword) {
        setIsPasswordValid(false);
        return;
      }
      const isValid = await verifyAdminPassword(savePassword);
      setIsPasswordValid(isValid);
    };
    const t = setTimeout(v, 300);
    return () => clearTimeout(t);
  }, [savePassword]);

  useEffect(() => {
    setLocalPermissions(servicePermissions);
  }, [servicePermissions]);

  if (currentUserRole !== 'superadmin') {
    return <div className="p-8 text-center">Unauthorized.</div>;
  }
  
  const handlePermissionChange = (role: Exclude<UserRole, null | 'superadmin'>, service: ServiceName, checked: boolean) => {
    setLocalPermissions(currentPermissions => {
        const currentForRole = currentPermissions[role] || [];
        let newForRole: ServiceName[];
        if (checked) {
            newForRole = Array.from(new Set([...currentForRole, service]));
        } else {
            newForRole = currentForRole.filter(s => s !== service);
        }
        return { ...currentPermissions, [role]: newForRole };
    });
  };
  
  const handleSaveChanges = async () => {
    if (!isPasswordValid) return;
    setIsSaving(true);
    Object.entries(localPermissions).forEach(([role, services]) => {
      setServicePermissionsForRole(role as UserRole, services);
    });
    const success = await saveSettingsToServer(savePassword);
    if (success) {
       toast({ title: "Permissions Saved" });
    }
    setIsSaving(false);
  };

  const rolesToDisplay = ALL_USER_ROLES.filter(r => r !== 'superadmin' && r !== null) as Exclude<UserRole, null | 'superadmin'>[];

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <Users className="mr-2 h-7 w-7 text-primary" /> Role Service Permissions
          </CardTitle>
          <CardDescription>Configure service accessibility per user role.</CardDescription>
        </CardHeader>
      </Card>
      
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Service</TableHead>
                    {rolesToDisplay.map(role => (
                        <TableHead key={role} className="text-center capitalize">{role}</TableHead>
                    ))}
                </TableRow>
            </TableHeader>
            <TableBody>
                {ALL_SERVICES.map(service => (
                    <TableRow key={service}>
                        <TableCell className="font-medium text-xs">{service}</TableCell>
                        {rolesToDisplay.map(role => (
                            <TableCell key={`${service}-${role}`} className="text-center">
                                <Checkbox
                                    checked={(localPermissions[role] || []).includes(service)}
                                    onCheckedChange={(checked) => handlePermissionChange(role, service, !!checked)}
                                />
                            </TableCell>
                        ))}
                    </TableRow>
                ))}
            </TableBody>
          </Table>
          
          <div className="mt-6 flex flex-col sm:flex-row justify-end items-center gap-4 border-t pt-6">
            <div className="space-y-1 w-full sm:w-auto">
                <Label className="flex items-center gap-1 text-[10px] uppercase font-black tracking-widest"><Lock className="h-3 w-3"/> Admin Auth</Label>
                <Input type="password" value={savePassword} onChange={e => setSavePassword(e.target.value)} placeholder="Password..." className="h-9"/>
            </div>
            <Button onClick={handleSaveChanges} disabled={isSaving || !isPasswordValid} className="px-8">
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />} Save Changes
            </Button>
          </div>
          {!isPasswordValid && savePassword && <p className="text-[10px] text-destructive text-right mt-1">Incorrect password.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

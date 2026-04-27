
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
import { Users, ShieldCheck, Save, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function RoleSettingsPageContent() {
  const { role: currentUserRole } = useAuth();
  const { servicePermissions, setServicePermissionsForRole, saveSettingsToServer } = useSettings();
  const { toast } = useToast();
  
  const [localPermissions, setLocalPermissions] = useState(servicePermissions);
  const [isSaving, setIsSaving] = useState(false);
  const [savePassword, setSavePassword] = useState('');

  // Sync local state if context changes (e.g., after loading from server)
  useEffect(() => {
    setLocalPermissions(servicePermissions);
  }, [servicePermissions]);

  if (currentUserRole !== 'superadmin') {
    return (
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle>Access Denied</CardTitle>
        </CardHeader>
        <CardContent>
          <p>You do not have permission to view this page. Please contact a super administrator.</p>
        </CardContent>
      </Card>
    );
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
        const roleKey = role === null ? 'null' : role;
        return { ...currentPermissions, [roleKey]: newForRole };
    });
  };
  
  const handleSaveChanges = async () => {
    setIsSaving(true);
    // First, update the local context state immediately for UI responsiveness
    Object.entries(localPermissions).forEach(([role, services]) => {
      setServicePermissionsForRole(role as UserRole, services);
    });
    
    // Then, save the entire updated permissions object to the server
    const success = await saveSettingsToServer(savePassword);
    
    if (success) {
       toast({
        title: "Permissions Saved",
        description: "Role permissions have been saved to the server and will apply to all users."
      });
    }
    // Error toast is handled within saveSettingsToServer
    
    setIsSaving(false);
  };

  const rolesToDisplay = ALL_USER_ROLES.filter(r => r !== 'superadmin');

  return (
    <div className="space-y-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <Users className="mr-2 h-7 w-7 text-primary" /> Role Service Permissions
          </CardTitle>
          <CardDescription>
            Configure which freight services are accessible to each user role. Changes must be saved to the server to take effect for all users. Superadmin permissions cannot be changed.
          </CardDescription>
        </CardHeader>
      </Card>
      
      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="font-semibold text-foreground">Service</TableHead>
                        {rolesToDisplay.map(role => (
                            <TableHead key={role} className="text-center font-semibold text-foreground capitalize">{role}</TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {ALL_SERVICES.map(service => (
                        <TableRow key={service}>
                            <TableCell className="font-medium">{service}</TableCell>
                            {rolesToDisplay.map(role => (
                                <TableCell key={`${service}-${role}`} className="text-center">
                                    <Checkbox
                                        checked={(localPermissions[role as Exclude<UserRole, 'superadmin' | null>] || []).includes(service)}
                                        onCheckedChange={(checked) => handlePermissionChange(role as any, service, !!checked)}
                                    />
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
          </div>
          <div className="mt-6 flex flex-col sm:flex-row justify-end items-center gap-4 border-t pt-6">
            <div className="space-y-1 w-full sm:w-auto">
                <Label htmlFor="save-password">Server Write Password</Label>
                <Input id="save-password" type="password" value={savePassword} onChange={e => setSavePassword(e.target.value)} placeholder="Enter password to enable"/>
            </div>
            <Button onClick={handleSaveChanges} disabled={isSaving || savePassword !== 'LCPTGE'}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                Save Changes to Server
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

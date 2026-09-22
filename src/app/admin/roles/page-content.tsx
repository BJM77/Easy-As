
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useAuth, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Loader2, Users, PlusCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { UserProfile, UserRole } from '@/lib/types';
import { ALL_USER_ROLES } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Label } from '@/components/ui/label';

interface AuthUser {
  uid: string;
  email?: string;
}
interface CombinedUser extends AuthUser, Partial<UserProfile> {}

const newUserSchema = z.object({
    name: z.string().min(1, 'Name is required.'),
    email: z.string().email('A valid email is required.'),
    password: z.string().min(6, 'Password must be at least 6 characters.'),
    role: z.enum(ALL_USER_ROLES as [string, ...string[]]),
});
type NewUserFormValues = z.infer<typeof newUserSchema>;


export default function RolesPageContent() {
  const { user, role } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [users, setUsers] = useState<CombinedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const isSuperadmin = role === 'superadmin';

  const newUserForm = useForm<NewUserFormValues>({
    resolver: zodResolver(newUserSchema),
    defaultValues: { name: '', email: '', password: '', role: 'user' },
  });

  const usersQuery = useMemoFirebase(() => {
    if (firestore && isSuperadmin) {
      return query(collection(firestore, 'users'));
    }
    return null;
  }, [firestore, isSuperadmin]);

  const { data: userProfiles, isLoading: isLoadingProfiles } = useCollection<UserProfile>(usersQuery);

  async function loadUsers() {
    if (!isSuperadmin) return toast({ title: "Unauthorized", description: 'Only superadmins can load users', variant: "destructive" });
    setLoading(true);
    try {
        const token = await user?.getIdToken();
        const response = await fetch('/api/users', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch auth users.');
        const authUsers: AuthUser[] = await response.json();
        
        let combined: CombinedUser[] = [];
        if (userProfiles) {
            combined = authUsers.map(authUser => {
                const profile = userProfiles.find(p => p.id === authUser.uid);
                return { ...authUser, ...profile };
            });
        }
        
        setUsers(combined);
    } catch (e) {
        toast({ title: "Error", description: e instanceof Error ? e.message : "Could not load users.", variant: "destructive"});
    }
    setLoading(false);
  }

  async function changeRole(uid: string, newRole: UserRole) {
    const token = await user?.getIdToken();
    try {
        const response = await fetch('/api/roles/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ uid, newRole })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to update role.');
        toast({ title: 'Success', description: `Role for user ${uid} updated.`});
        await loadUsers(); // Refresh list
    } catch (e) {
        toast({ title: 'Error', description: e instanceof Error ? e.message : 'Could not update role.', variant: 'destructive'});
    }
  }

  function handleCsv(e: React.ChangeEvent<HTMLInputElement>) { 
    if (e.target.files) {
        setCsvFile(e.target.files[0]); 
    }
  }

  async function importCsv() {
    if (!csvFile) return toast({ title: 'No File', description: 'Please select a CSV file.', variant: 'destructive' });
    const text = await csvFile.text();
    const token = await user?.getIdToken();
    try {
        const response = await fetch('/api/roles/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ csv: text })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Batch assignment failed.');
        toast({ title: 'Success', description: result.message });
        await loadUsers(); // Refresh list
    } catch (e) {
        toast({ title: 'Error', description: e instanceof Error ? e.message : 'Could not process CSV.', variant: 'destructive'});
    }
  }

  const handleAddNewUser = async (data: NewUserFormValues) => {
    setIsSubmitting(true);
    try {
      const token = await user?.getIdToken();
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.details || result.error);
      toast({ title: "User Created", description: `Account for ${result.email} created successfully.` });
      setIsAddModalOpen(false);
      newUserForm.reset();
      await loadUsers(); // Refresh the user list
    } catch (error) {
      toast({ title: "Creation Failed", description: error instanceof Error ? error.message : "An unknown error occurred", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (!isSuperadmin) {
      return (
          <Card>
              <CardHeader>
                  <CardTitle>Access Denied</CardTitle>
                  <CardDescription>You do not have permission to manage roles.</CardDescription>
              </CardHeader>
          </Card>
      )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <Card>
        <CardHeader>
            <CardTitle className="text-2xl font-bold flex items-center">
                <Users className="mr-2 h-6 w-6 text-primary"/>
                Admin Roles Panel
            </CardTitle>
            <CardDescription>Manage user roles across the application. Only available to Super Admins.</CardDescription>
        </CardHeader>
      </Card>
      <Card>
        <CardContent className="pt-6 flex flex-col sm:flex-row gap-2">
            <Button onClick={loadUsers} disabled={loading || isLoadingProfiles}>
                {loading || isLoadingProfiles ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                Load Users
            </Button>
            <Button onClick={() => setIsAddModalOpen(true)} variant="outline">
                <PlusCircle className="mr-2 h-4 w-4" /> Add New User
            </Button>
            <div className="flex items-center gap-2 border-t pt-4 sm:border-t-0 sm:pt-0 sm:border-l sm:pl-4">
              <Input type="file" accept=".csv" onChange={handleCsv} className="max-w-xs" />
              <Button onClick={importCsv}>Import CSV</Button>
            </div>
        </CardContent>
      </Card>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>UID</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading || isLoadingProfiles ? (
              <TableRow key="loading-row"><TableCell colSpan={6} className="text-center"><Loader2 className="animate-spin my-4 mx-auto"/></TableCell></TableRow>
          ) : users.length === 0 ? (
              <TableRow key="no-users-row"><TableCell colSpan={6} className="text-center">No users loaded.</TableCell></TableRow>
          ) : (
            users.map(u => (
              <TableRow key={u.uid}>
                <TableCell className="text-xs font-mono">{u.uid}</TableCell>
                <TableCell>{u.name || 'N/A'}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>{u.companyId || 'N/A'}</TableCell>
                <TableCell className="capitalize">{u.role || 'user'}</TableCell>
                <TableCell>
                  <Select
                    defaultValue={u.role || 'user'}
                    onValueChange={(newRole) => changeRole(u.uid as string, newRole as UserRole)}
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue placeholder="Change role" />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_USER_ROLES.map(r => (
                        <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

       {/* Add User Dialog */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>Create a new user account and assign them a role.</DialogDescription>
          </DialogHeader>
          <form onSubmit={newUserForm.handleSubmit(handleAddNewUser)} className="space-y-4 py-2">
             <div className="space-y-1">
                <Label htmlFor="add-name">Full Name</Label>
                <Input id="add-name" {...newUserForm.register('name')} />
                {newUserForm.formState.errors.name && <p className="text-sm text-destructive">{newUserForm.formState.errors.name.message}</p>}
            </div>
            <div className="space-y-1">
                <Label htmlFor="add-email">Email</Label>
                <Input id="add-email" type="email" {...newUserForm.register('email')} />
                {newUserForm.formState.errors.email && <p className="text-sm text-destructive">{newUserForm.formState.errors.email.message}</p>}
            </div>
             <div className="space-y-1">
                <Label htmlFor="add-password">Password</Label>
                <Input id="add-password" type="password" {...newUserForm.register('password')} />
                {newUserForm.formState.errors.password && <p className="text-sm text-destructive">{newUserForm.formState.errors.password.message}</p>}
            </div>
            <div className="space-y-1">
                <Label htmlFor="add-role">Role</Label>
                <Controller name="role" control={newUserForm.control} render={({ field }) => (
                     <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{ALL_USER_ROLES.map(r => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}</SelectContent></Select>
                )}/>
                {newUserForm.formState.errors.role && <p className="text-sm text-destructive">{newUserForm.formState.errors.role.message}</p>}
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                Create User
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

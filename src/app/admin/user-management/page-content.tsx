"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Loader2, Users2, Edit, Search, PlusCircle, Trash2, AlertCircle, FileJson, Terminal, ExternalLink, X, Building2, Key, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { collection, doc, query, where } from 'firebase/firestore';
import type { UserProfile, UserRole, Company } from '@/lib/types';
import { ALL_USER_ROLES } from '@/lib/types';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';

interface AuthUser {
  uid: string;
  email?: string;
  lastSignInTime?: string;
  creationTime?: string;
}

interface CombinedUser extends AuthUser, Partial<UserProfile> {}

const newUserSchema = z.object({
    name: z.string().min(1, 'Name is required.'),
    email: z.string().email('A valid email is required.'),
    password: z.string().min(6, 'Password must be at least 6 characters.'),
    role: z.enum(ALL_USER_ROLES as [string, ...string[]]),
    companyId: z.string().min(1, 'Company assignment is required.'),
});
type NewUserFormValues = z.infer<typeof newUserSchema>;

export default function UserManagementPageContent() {
  const { user, profile, role, actualRole, loading: authLoading } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [authUsers, setAuthUsers] = useState<AuthUser[]>([]);
  const [isLoadingAuthUsers, setIsLoadingAuthUsers] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  
  const isSuperadmin = actualRole === 'superadmin';

  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !profile?.companyId) return null;
    const baseQuery = collection(firestore, 'users');
    
    // Superadmins fetch everything
    if (isSuperadmin) return baseQuery;
    
    // Admins only fetch their own company's users
    return query(baseQuery, where('companyId', '==', profile.companyId));
  }, [firestore, profile?.companyId, isSuperadmin]);

  const companiesQuery = useMemoFirebase(() => {
    if (firestore && isSuperadmin) {
      return collection(firestore, 'companies');
    }
    return null;
  }, [firestore, isSuperadmin]);

  const { data: userProfilesData, isLoading: isLoadingProfiles } = useCollection<UserProfile>(usersQuery);
  const userProfiles = userProfilesData ?? [];

  const { data: companiesData } = useCollection<Company>(companiesQuery);
  const companies = companiesData ?? [];

  const [selectedUser, setSelectedUser] = useState<CombinedUser | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [companyFilter, setCompanyFilter] = useState('all');

  // Form states for the edit dialog
  const [newRole, setNewRole] = useState<UserRole | ''>('');
  const [newCompanyId, setNewCompanyId] = useState<string>('');
  const [tokensToAdd, setTokensToAdd] = useState<number | ''>('');
  const [assignedCompanies, setAssignedCompanies] = useState<string[]>([]);
  
  const newUserForm = useForm<NewUserFormValues>({
    resolver: zodResolver(newUserSchema),
    defaultValues: { name: '', email: '', password: '', role: 'user', companyId: profile?.companyId || 'easy-as' },
  });
  
  const fetchUsers = useCallback(async () => {
    if (!user) return;
    setIsLoadingAuthUsers(true);
    setApiError(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Failed to fetch users');
      }
      const data = await response.json();
      setAuthUsers(data);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      setApiError(msg);
      toast({ title: 'Server Error', description: `Admin SDK failed: ${msg}`, variant: 'destructive' });
    } finally {
      setIsLoadingAuthUsers(false);
    }
  }, [toast, user]);

  useEffect(() => {
    if (actualRole === 'superadmin') {
      fetchUsers();
    } else {
        setIsLoadingAuthUsers(false);
    }
  }, [actualRole, fetchUsers]);
  
  const combinedUsers = useMemo(() => {
    // If superadmin, merge Auth list with Profiles
    if (isSuperadmin && authUsers.length > 0) {
        return authUsers.map(authUser => {
            const profile = userProfiles.find(p => p.id === authUser.uid);
            return { ...authUser, ...profile };
        });
    }
    // If standard Admin, just use the Profiles (which are already filtered by rules/query)
    return userProfiles.map(p => ({ uid: p.id, ...p }));
  }, [authUsers, userProfiles, isSuperadmin]);

  const filteredUsers = useMemo(() => {
    return combinedUsers.filter(u => {
      const searchMatch = !searchQuery || u.email?.toLowerCase().includes(searchQuery.toLowerCase());
      const roleMatch = roleFilter === 'all' || (u.role && u.role === roleFilter);
      const companyMatch = companyFilter === 'all' || (u.companyId && u.companyId === companyFilter) || (u.assignedCompanyIds?.includes(companyFilter));
      return searchMatch && roleMatch && companyMatch;
    });
  }, [combinedUsers, searchQuery, roleFilter, companyFilter]);

  const handleOpenEdit = (userToEdit: CombinedUser) => {
    setSelectedUser(userToEdit);
    setNewRole(userToEdit.role || '');
    setNewCompanyId(userToEdit.companyId || '');
    setTokensToAdd('');
    setAssignedCompanies(userToEdit.assignedCompanyIds || (userToEdit.companyId ? [userToEdit.companyId] : []));
    setIsEditModalOpen(true);
  };
  
  const handleAddAssignedCompany = (cid: string) => {
    if (!assignedCompanies.includes(cid)) {
        setAssignedCompanies([...assignedCompanies, cid]);
    }
  };

  const handleRemoveAssignedCompany = (cid: string) => {
    setAssignedCompanies(assignedCompanies.filter(id => id !== cid));
  };

  const handleSaveChanges = async () => {
    if (!selectedUser || !user) return;

    setIsSubmitting(true);
    try {
        const payload: any = {
            role: newRole || selectedUser.role,
            companyId: newCompanyId || selectedUser.companyId,
            assignedCompanyIds: Array.from(new Set([...assignedCompanies, newCompanyId || ''])),
        };

        const tokensToAddNum = Number(tokensToAdd);
        if (!isNaN(tokensToAddNum) && tokensToAddNum !== 0) {
            payload.tokens = (selectedUser.tokens || 0) + tokensToAddNum;
        }

        const token = await user.getIdToken();
        const response = await fetch('/api/roles/update', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                uid: selectedUser.uid,
                ...payload
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.details || error.error || 'Update failed');
        }
        
        toast({ title: 'User Updated', description: 'Changes synced successfully.' });
        setIsEditModalOpen(false);
        if (isSuperadmin) fetchUsers();

    } catch (error: any) {
        toast({ title: 'Update Failed', description: error.message, variant: 'destructive' });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleAddNewUser = async (data: NewUserFormValues) => {
    setIsSubmitting(true);
    try {
      const token = await user?.getIdToken();
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
            ...data,
            assignedCompanyIds: [data.companyId]
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.details || result.error);
      toast({ title: "User Created", description: `Account created successfully.` });
      setIsAddModalOpen(false);
      newUserForm.reset();
      if (isSuperadmin) fetchUsers();
    } catch (error) {
      toast({ title: "Creation Failed", description: error instanceof Error ? error.message : "An unknown error occurred", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleDeleteUser = async () => {
    if (!selectedUser || !user) return;
    setIsDeleting(true);
    try {
        const token = await user?.getIdToken();
        const response = await fetch('/api/users', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ uid: selectedUser.uid }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.details || result.error);
        toast({ title: "User Deleted", description: `Permanently deleted.` });
        if (isSuperadmin) fetchUsers();
    } catch (error) {
        toast({ title: "Deletion Failed", description: error instanceof Error ? error.message : "An unknown error occurred", variant: "destructive" });
    } finally {
        setIsDeleting(false);
        setIsDeleteConfirmOpen(false);
        setIsEditModalOpen(false);
        setSelectedUser(null);
    }
  };

  const isLoading = authLoading || (isSuperadmin && isLoadingAuthUsers) || isLoadingProfiles;

  return (
    <>
      <div className="space-y-8">
        <Card className="shadow-xl">
          <CardHeader>
              <div className="flex flex-col md:flex-row gap-4 justify-between items-start">
                  <div>
                      <CardTitle className="text-2xl font-headline flex items-center">
                          <Users2 className="mr-2 h-7 w-7 text-primary" /> User Management
                      </CardTitle>
                      <CardDescription>
                        {isSuperadmin ? 'Manage global user roles and company assignments.' : `Manage users for ${profile?.companyId || 'your organization'}.`}
                      </CardDescription>
                  </div>
                  <Button onClick={() => setIsAddModalOpen(true)}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Add New User
                  </Button>
              </div>
          </CardHeader>
        </Card>

        {apiError && isSuperadmin && (
          <div className="space-y-4">
            <Alert variant="destructive" className="border-2">
                <AlertCircle className="h-5 w-5" />
                <AlertTitle className="text-lg font-bold">Server Configuration Error</AlertTitle>
                <AlertDescription className="space-y-4 pt-2">
                <p>The <strong>Firebase Admin SDK</strong> failed to initialize.</p>
                <div className="bg-background/50 p-4 rounded-md border border-destructive/20 font-mono text-xs">
                    <p>{apiError}</p>
                </div>
                </AlertDescription>
            </Alert>
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-grow">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="user-search"
                  name="user-search"
                  placeholder="Search by email..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center gap-2">
                  {isSuperadmin && (
                    <Select value={companyFilter} onValueChange={setCompanyFilter}>
                        <SelectTrigger className="w-[180px] h-9 text-xs"><SelectValue placeholder="Filter by Company" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Companies</SelectItem>
                            {(companies || []).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                  )}
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                      <SelectTrigger className="w-[140px] h-9 text-xs"><SelectValue placeholder="Filter by Role" /></SelectTrigger>
                      <SelectContent>
                          <SelectItem value="all">All Roles</SelectItem>
                          {ALL_USER_ROLES.map(r => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
                      </SelectContent>
                  </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Active Company</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Tokens</TableHead>
                    <TableHead>Last Sign-in</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-10"><Loader2 className="mx-auto h-8 w-8 animate-spin" /></TableCell></TableRow>
                  ) : filteredUsers.length > 0 ? (
                    filteredUsers.map(u => (
                      <TableRow key={u.uid}>
                        <TableCell className="font-medium">{u.email}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant="default" className="font-mono text-[10px] w-fit">
                                {isSuperadmin ? ((companies || []).find(c => c.id === u.companyId)?.name || u.companyId || 'Unassigned') : u.companyId}
                            </Badge>
                            {u.assignedCompanyIds && u.assignedCompanyIds.length > 1 && (
                                <p className="text-[9px] text-muted-foreground">+{u.assignedCompanyIds.length - 1} other permissions</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="capitalize">{u.role || 'Not Set'}</TableCell>
                        <TableCell>{u.tokens?.toLocaleString() ?? '0'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{u.lastSignInTime ? format(new Date(u.lastSignInTime), 'dd MMM, p') : 'Never'}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(u)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={6} className="text-center py-10">No users found.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Edit User Dialog */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit User: {selectedUser?.email}</DialogTitle>
            <DialogDescription>Modify workspace portfolio, system role, or token balance.</DialogDescription>
          </DialogHeader>
          <div className="flex-grow overflow-y-auto py-4 space-y-6 pr-2">
             <div className="space-y-3">
              <Label className="text-primary font-bold">Workspace Portfolio</Label>
              <p className="text-xs text-muted-foreground">The "Primary" workspace is the default context.</p>
              
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Primary Workspace</Label>
                {isSuperadmin ? (
                    <Select value={newCompanyId} onValueChange={setNewCompanyId}>
                        <SelectTrigger id="edit-primary-company"><SelectValue placeholder="Select primary..." /></SelectTrigger>
                        <SelectContent>{(companies || []).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                ) : (
                    <Input value={newCompanyId} disabled className="bg-muted" />
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Assigned Workspaces</Label>
                <div className="flex flex-wrap gap-2 p-3 border rounded-md min-h-[60px] bg-muted/20">
                    {assignedCompanies.length > 0 ? assignedCompanies.map(cid => (
                        <Badge key={cid} variant="secondary" className="flex items-center gap-1.5 py-1 px-2">
                            {isSuperadmin ? ((companies || []).find(c => c.id === cid)?.name || cid) : cid}
                            {isSuperadmin && (
                                <button onClick={() => handleRemoveAssignedCompany(cid)} className="hover:text-destructive">
                                    <X className="h-3 w-3" />
                                </button>
                            )}
                        </Badge>
                    )) : <p className="text-xs text-muted-foreground italic">No workspaces assigned.</p>}
                </div>
                
                {isSuperadmin && (
                    <div className="flex gap-2">
                        <Select onValueChange={handleAddAssignedCompany}>
                            <SelectTrigger id="assign-workspace-select" className="text-xs h-8"><SelectValue placeholder="Assign another company..." /></SelectTrigger>
                            <SelectContent>
                                {(companies || []).filter(c => !assignedCompanies.includes(c.id)).map(c => (
                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
              </div>
            </div>

            <Separator />

             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <Label htmlFor="edit-role-select">System Role</Label>
                    <Select value={newRole || ''} onValueChange={(v) => setNewRole(v as UserRole)}>
                        <SelectTrigger id="edit-role-select" className="capitalize"><SelectValue placeholder="Select role" /></SelectTrigger>
                        <SelectContent>{ALL_USER_ROLES.filter(r => isSuperadmin || r !== 'superadmin').map(r => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <div className="space-y-1">
                    <Label htmlFor="edit-tokens">Adjust Tokens (Total: {selectedUser?.tokens?.toLocaleString() || 0})</Label>
                    <Input id="edit-tokens" name="edit-tokens" type="number" value={tokensToAdd} onChange={e => setTokensToAdd(e.target.value === '' ? '' : parseInt(e.target.value, 10))} placeholder="+/- Amount" />
                </div>
             </div>
          </div>
          <DialogFooter className="sm:justify-between border-t pt-4">
            <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isDeleting} size="sm"><Trash2 className="mr-2 h-4 w-4" />Delete Account</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Delete User Account?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the auth account and profile. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteUser} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <div className="flex gap-2">
                <DialogClose asChild><Button type="button" variant="outline" size="sm">Cancel</Button></DialogClose>
                <Button onClick={handleSaveChanges} disabled={isSubmitting} size="sm">
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ShieldCheck className="mr-2 h-4 w-4" />}
                  Save Changes
                </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Add User Dialog */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>Create a new account and assign their first company.</DialogDescription>
          </DialogHeader>
          <form onSubmit={newUserForm.handleSubmit(handleAddNewUser)} className="space-y-4 py-2">
             <div className="space-y-1">
                <Label htmlFor="add-user-name">Full Name</Label>
                <Input id="add-user-name" {...newUserForm.register('name')} placeholder="e.g. Jane Smith" />
            </div>
            <div className="space-y-1">
                <Label htmlFor="add-user-email">Email</Label>
                <Input id="add-user-email" type="email" {...newUserForm.register('email')} placeholder="jane@example.com" />
            </div>
             <div className="space-y-1">
                <Label htmlFor="add-user-password">Password</Label>
                <Input id="add-user-password" type="password" {...newUserForm.register('password')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <Label htmlFor="add-user-role">Role</Label>
                    <Controller name="role" control={newUserForm.control} render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}><SelectTrigger id="add-user-role" className="capitalize"><SelectValue/></SelectTrigger><SelectContent>{ALL_USER_ROLES.filter(r => isSuperadmin || r !== 'superadmin').map(r => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}</SelectContent></Select>
                    )}/>
                </div>
                <div className="space-y-1">
                    <Label htmlFor="add-user-company">Initial Company</Label>
                    {isSuperadmin ? (
                        <Controller name="companyId" control={newUserForm.control} render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}><SelectTrigger id="add-user-company"><SelectValue/></SelectTrigger><SelectContent>{(companies || []).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
                        )}/>
                    ) : (
                        <Input value={profile?.companyId || ''} disabled className="bg-muted" />
                    )}
                </div>
            </div>
            <DialogFooter className="pt-4">
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                Create User
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
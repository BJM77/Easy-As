"use client";

import React, { useState, useMemo } from 'react';
import { useAuth, useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Loader2, Users, UserPlus, Mail, Link as LinkIcon, Trash2, Clock, CheckCircle2, Copy, Shield, ShieldCheck, Sparkles } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { collection, doc, query, where } from 'firebase/firestore';
import type { UserProfile, UserRole, Invitation } from '@/lib/types';
import { ALL_USER_ROLES } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

export default function TeamManagementPageContent() {
  const { user, profile, role } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState<UserRole>('user');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  // Queries for the company's team
  const teamQuery = useMemoFirebase(() => {
    if (!firestore || !profile?.companyId) return null;
    return query(collection(firestore, 'users'), where('companyId', '==', profile.companyId));
  }, [firestore, profile?.companyId]);

  const invitesQuery = useMemoFirebase(() => {
    if (!firestore || !profile?.companyId) return null;
    return query(collection(firestore, 'invitations'), where('companyId', '==', profile.companyId), where('status', '==', 'pending'));
  }, [firestore, profile?.companyId]);

  const { data: teamMembersData, isLoading: isLoadingTeam } = useCollection<UserProfile>(teamQuery);
  const { data: activeInvitesData, isLoading: isLoadingInvites } = useCollection<Invitation>(invitesQuery);

  const teamMembers = teamMembersData ?? [];
  const activeInvites = activeInvitesData ?? [];

  const handleGenerateInvite = async () => {
    if (!user || !profile?.companyId || !firestore) return;
    setIsGenerating(true);

    try {
      const inviteId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const inviteDocRef = doc(firestore, 'invitations', inviteId);
      
      const payload: Invitation = {
        id: inviteId,
        companyId: profile.companyId,
        companyName: profile.name || 'Your Organization',
        invitedBy: user.email || user.uid,
        role: inviteRole,
        status: 'pending',
        createdAt: new Date().toISOString(),
        expiresAt: addDays(new Date(), 7).toISOString()
      };

      setDocumentNonBlocking(inviteDocRef, payload, { merge: false });
      
      const baseUrl = window.location.origin;
      const inviteLink = `${baseUrl}/register/invite/${inviteId}`;
      setGeneratedInviteLink(inviteLink);
      toast({ title: 'Invite Link Generated', description: 'Valid for 7 days.' });
    } catch (error) {
      toast({ title: 'Error', description: 'Could not generate invitation.', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRoleChange = async (targetUserId: string, newRole: UserRole) => {
    if (!firestore || targetUserId === user?.uid) return;
    setUpdatingUserId(targetUserId);
    
    try {
      const userRef = doc(firestore, 'users', targetUserId);
      updateDocumentNonBlocking(userRef, { role: newRole });
      toast({ title: 'Role Updated', description: `User role has been changed to ${newRole}.` });
    } catch (error) {
      toast({ title: 'Update Failed', description: 'Could not update user role.', variant: 'destructive' });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
        await navigator.clipboard.writeText(text);
        toast({ title: 'Link Copied', description: 'Paste it to send to your team member.' });
    } catch (err) {
        toast({ 
            title: 'Copy Blocked', 
            description: 'Please manually select and copy the link from the input field.', 
            variant: 'destructive' 
        });
    }
  };

  const handleRevokeInvite = (id: string) => {
    if (!firestore) return;
    deleteDocumentNonBlocking(doc(firestore, 'invitations', id));
    toast({ title: 'Invitation Revoked' });
  };

  if (role !== 'admin' && role !== 'superadmin') {
    return <Card className="m-8"><CardContent className="pt-6">Unauthorized access.</CardContent></Card>;
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start gap-4">
            <div>
              <CardTitle className="text-2xl font-headline flex items-center">
                <Users className="mr-2 h-7 w-7 text-primary" /> Team Management
              </CardTitle>
              <CardDescription>View your active team and invite new members to join your organization.</CardDescription>
            </div>
            <Button onClick={() => { setGeneratedInviteLink(null); setIsInviteModalOpen(true); }}>
              <UserPlus className="mr-2 h-4 w-4" /> Invite Member
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Active Members ({teamMembers.length})
              </CardTitle>
              <CardDescription>Manage roles for your organization's staff.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="w-[150px]">Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingTeam ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-10"><Loader2 className="animate-spin mx-auto h-6 w-6"/></TableCell></TableRow>
                  ) : teamMembers.map(member => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        {member.name}
                        {member.id === user?.uid && <Badge variant="outline" className="ml-2 text-[8px] uppercase">You</Badge>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{member.email}</TableCell>
                      <TableCell>
                        {member.id === user?.uid ? (
                          <Badge variant="secondary" className="capitalize text-[10px]">{member.role}</Badge>
                        ) : (
                          <Select 
                            value={member.role || 'user'} 
                            onValueChange={(v) => handleRoleChange(member.id, v as UserRole)}
                            disabled={updatingUserId === member.id}
                          >
                            <SelectTrigger className="h-8 text-xs capitalize">
                              {updatingUserId === member.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <SelectValue />}
                            </SelectTrigger>
                            <SelectContent>
                              {ALL_USER_ROLES.filter(r => r !== 'superadmin').map(r => (
                                <SelectItem key={r} value={r || 'user'} className="capitalize">{r}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg flex items-center"><Clock className="mr-2 h-4 w-4 text-amber-500" /> Pending Invites</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingInvites ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin h-6 w-6"/></div>
              ) : activeInvites.length > 0 ? (
                activeInvites.map(invite => (
                  <div key={invite.id} className="p-3 border rounded-md bg-muted/30 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider">Role: {invite.role}</p>
                        <p className="text-[10px] text-muted-foreground">Expires: {format(new Date(invite.expiresAt), 'dd MMM')}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleRevokeInvite(invite.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Button variant="outline" size="sm" className="w-full h-7 text-[10px]" onClick={() => {
                      const link = `${window.location.origin}/register/invite/${invite.id}`;
                      copyToClipboard(link);
                    }}>
                      <Copy className="mr-1.5 h-3 w-3" /> Copy Link
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-center text-muted-foreground py-10">No pending invitations.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite a Team Member</DialogTitle>
            <DialogDescription>Generate a unique link to invite a new user to join <strong>{profile?.companyId}</strong>.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {!generatedInviteLink ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label>Assigned Role</Label>
                  <Select value={inviteRole || ''} onValueChange={(v) => setInviteRole(v as UserRole)}>
                    <SelectTrigger className="capitalize"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ALL_USER_ROLES.filter(r => r !== 'superadmin').map(r => (
                        <SelectItem key={r} value={r || 'user'} className="capitalize">{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleGenerateInvite} disabled={isGenerating} className="w-full">
                  {isGenerating ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  Generate Invite Link
                </Button>
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in zoom-in-95">
                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md text-center">
                  <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-green-800 dark:text-green-300">Invite Ready!</p>
                </div>
                <div className="space-y-1">
                  <Label>Copy & Send this link:</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={generatedInviteLink} className="font-mono text-xs h-9" />
                    <Button size="icon" variant="outline" onClick={() => copyToClipboard(generatedInviteLink)} className="h-9 w-9">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground italic">This link allows one person to register and automatically join your company.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Close</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

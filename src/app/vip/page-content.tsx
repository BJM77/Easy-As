"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, User, Phone, Mail, Search, Building, UserCheck, PlusCircle, FileText, UploadCloud, Download } from 'lucide-react';
import type { VipContact, StateAbbreviation } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { ALL_STATES } from '@/lib/types';
import { vipContactSchema } from '@/lib/zodSchemas';
import { Textarea } from '@/components/ui/textarea';
import { useAuth, useCollection, useFirestore, useMemoFirebase, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import * as XLSX from 'xlsx';


type VipContactFormValues = z.infer<typeof vipContactSchema>;

const csvHeaders = ["Name", "Role", "Business Unit", "State", "Phone", "Email", "Notes"];

const handlePhoneClick = (phoneNumber: string) => {
    if (!phoneNumber) return;
    
    // Clean number but keep '+' for country codes
    const cleanedNumber = phoneNumber.replace(/[\s()-]/g, '');

    // Attempt to open in Microsoft Teams
    window.location.href = `msteams:l/call/0/0?users=${cleanedNumber}`;

    let hasSwitched = false;
    const visibilityChangeHandler = () => {
        if (document.visibilityState === 'hidden') {
            hasSwitched = true;
        }
        document.removeEventListener('visibilitychange', visibilityChangeHandler);
    };
    document.addEventListener('visibilitychange', visibilityChangeHandler);

    // Fallback to standard telephone link after a short delay
    // if the visibility hasn't changed (i.e., Teams didn't open)
    setTimeout(() => {
        if (!hasSwitched) {
            window.location.href = `tel:${cleanedNumber}`;
        }
    }, 500);
};

export default function VipContactsPageContent() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedState, setSelectedState] = useState('All');
  const [selectedBU, setSelectedBU] = useState('All');
  const [selectedRole, setSelectedRole] = useState('All');
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const firestore = useFirestore();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<VipContact | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const form = useForm<VipContactFormValues>({
    resolver: zodResolver(vipContactSchema),
    defaultValues: { name: '', role: '', businessUnit: 'Other', state: 'National', phone: '', email: '', notes: '' }
  });
  
  const contactsQuery = useMemoFirebase(() => {
    if (!firestore || !profile?.companyId) return null;
    return query(collection(firestore, 'vipContacts'), where('companyId', '==', profile.companyId));
  }, [firestore, profile?.companyId]);

  const { data: contactsData, isLoading } = useCollection<VipContact>(contactsQuery);
  const contacts = contactsData || [];

  const uniqueStates = useMemo(() => ['All', ...Array.from(new Set(contacts.map(c => c.state))).sort()], [contacts]);
  const uniqueBUs = useMemo(() => ['All', ...Array.from(new Set(contacts.map(c => c.businessUnit))).sort()], [contacts]);
  const uniqueRoles = useMemo(() => ['All', ...Array.from(new Set(contacts.map(c => c.role))).sort()], [contacts]);

  const filteredContacts = useMemo(() => {
    return (contacts || []).filter(contact => {
      const lowercasedQuery = searchQuery.toLowerCase();
      const matchesSearch = searchQuery.length < 2 ||
        (contact.name?.toLowerCase() || '').includes(lowercasedQuery) ||
        (contact.role?.toLowerCase() || '').includes(lowercasedQuery) ||
        (contact.email?.toLowerCase() || '').includes(lowercasedQuery);
      
      const matchesState = selectedState === 'All' || contact.state === selectedState;
      const matchesBU = selectedBU === 'All' || contact.businessUnit === selectedBU;
      const matchesRole = selectedRole === 'All' || contact.role === selectedRole;

      return matchesSearch && matchesState && matchesBU && matchesRole;
    });
  }, [contacts, searchQuery, selectedState, selectedBU, selectedRole]);

  const handleOpenForm = (contact: VipContact | null = null) => {
    setSelectedContact(contact);
    if (contact) {
      form.reset(contact);
    } else {
      form.reset({ name: '', role: '', businessUnit: 'Other', state: 'National', phone: '', email: '', notes: '' });
    }
    setIsFormOpen(true);
  };
  
  const handleFormSubmit = async (data: VipContactFormValues) => {
    if (!user || !firestore || !profile?.companyId) {
        toast({ title: 'Not Authenticated', description: 'You must be logged in.', variant: 'destructive' });
        return;
    }
    setIsSubmitting(true);

    const isNew = !selectedContact?.id;
    const docId = isNew ? doc(collection(firestore, 'vipContacts')).id : selectedContact!.id;
    const docRef = doc(firestore, 'vipContacts', docId);

    const payload = { ...data, userId: user.uid, companyId: profile.companyId, id: docId };

    setDocumentNonBlocking(docRef, payload, { merge: !isNew });
    
    toast({ title: 'Success', description: `Contact ${isNew ? 'creation' : 'update'} in progress.` });
    setIsFormOpen(false);
    setIsSubmitting(false);
  };

  const handleDelete = async () => {
    if (!selectedContact || !firestore) return;
    setIsSubmitting(true);

    const docRef = doc(firestore, 'vipContacts', selectedContact.id);
    deleteDocumentNonBlocking(docRef);

    toast({ title: 'Success', description: 'Contact deletion in progress.' });
    setIsDeleteConfirmOpen(false);
    setIsFormOpen(false);
    setIsSubmitting(false);
  };

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([csvHeaders]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "VIP Contacts Template");
    XLSX.writeFile(wb, "vip_contacts_template.csv");
    toast({title: "Template Downloaded"});
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !firestore || !profile?.companyId) { toast({title: "Not Authenticated", variant: "destructive"}); return; }
    if (!event.target.files || event.target.files.length === 0) return;
    setIsUploading(true);
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = async (e) => {
        try {
            const dataArr = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(dataArr, { type: "array" });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 });
            
            const fileHeaders = json[0] as string[];
            if (JSON.stringify(fileHeaders) !== JSON.stringify(csvHeaders)) {
                throw new Error("CSV headers do not match the template.");
            }

            const contactsToUpload = json.slice(1).map((row: any[]): VipContactFormValues => ({
                name: row[0] || '',
                role: row[1] || '',
                businessUnit: (['PE', 'IPEC', 'Priority'].includes(row[2]) ? row[2] : 'Other') as any,
                state: ([...ALL_STATES, 'National'].includes(row[3]) ? row[3] : 'National') as any,
                phone: row[4] || '',
                email: row[5] || '',
                notes: row[6] || '',
            }));
            
            let successCount = 0;
            for (const contact of contactsToUpload) {
                const docRef = doc(collection(firestore, 'vipContacts'));
                setDocumentNonBlocking(docRef, { ...contact, userId: user.uid, companyId: profile.companyId, id: docRef.id }, { merge: false });
                successCount++;
            }

            toast({ title: 'Upload Complete', description: `${successCount} of ${contactsToUpload.length} contacts are being imported.` });
        } catch (error) {
            toast({ title: 'Upload Failed', description: error instanceof Error ? error.message : "Could not process the file.", variant: 'destructive' });
        } finally {
            setIsUploading(false);
            if(event.target) event.target.value = ''; // Reset file input
        }
    };
    reader.readAsArrayBuffer(file);
  };


  return (
    <>
      <div className="space-y-8">
        <Card className="shadow-xl">
          <CardHeader>
            <div className="flex flex-wrap justify-between items-center gap-4">
              <div>
                <CardTitle className="text-2xl font-headline flex items-center">
                  <UserCheck className="mr-2 h-7 w-7 text-primary" /> VIP Contacts
                </CardTitle>
                <CardDescription>
                  A filterable directory of important business contacts within the organisation.
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => document.getElementById('vip-upload-input')?.click()} disabled={isUploading}>
                  {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <UploadCloud className="mr-2 h-4 w-4" />}
                  Import Contacts
                </Button>
                <Input id="vip-upload-input" type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                 <Button onClick={handleDownloadTemplate} variant="outline"><Download className="mr-2 h-4 w-4"/>Template</Button>
                <Button onClick={() => handleOpenForm(null)}>
                  <PlusCircle className="mr-2 h-4 w-4" /> New Contact
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
              <CardTitle>Contact Directory</CardTitle>
          </CardHeader>
          <CardContent>
              <div className="flex flex-col md:flex-row gap-4 mb-4">
                  <div className="relative flex-grow">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                          type="text"
                          placeholder="Search by Name, Role, or Email..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                      />
                  </div>
                  <Select value={selectedBU} onValueChange={setSelectedBU}>
                      <SelectTrigger className="w-full md:w-[180px]"><SelectValue placeholder="Filter by BU" /></SelectTrigger>
                      <SelectContent>{uniqueBUs.map(bu => <SelectItem key={bu} value={bu}>{bu}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={selectedState} onValueChange={setSelectedState}>
                      <SelectTrigger className="w-full md:w-[180px]"><SelectValue placeholder="Filter by State" /></SelectTrigger>
                      <SelectContent>{uniqueStates.map(state => <SelectItem key={state} value={state}>{state}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                      <SelectTrigger className="w-full md:w-[180px]"><SelectValue placeholder="Filter by Role" /></SelectTrigger>
                      <SelectContent>{uniqueRoles.map(role => <SelectItem key={role} value={role}>{role}</SelectItem>)}</SelectContent>
                  </Select>
              </div>
            {isLoading ? (
              <div className="flex justify-center items-center py-10">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
            ) : (
              <div className="border rounded-md">
                  <Table>
                      <TableHeader>
                          <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Role</TableHead>
                              <TableHead>Business Unit</TableHead>
                              <TableHead>State</TableHead>
                              <TableHead>Contact</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {(filteredContacts?.length || 0) > 0 ? (
                              filteredContacts.map(contact => (
                                  <TableRow key={contact.id} onClick={() => handleOpenForm(contact)} className="cursor-pointer">
                                      <TableCell className="font-medium">{contact.name}</TableCell>
                                      <TableCell>{contact.role}</TableCell>
                                      <TableCell>{contact.businessUnit}</TableCell>
                                      <TableCell>{contact.state}</TableCell>
                                      <TableCell>
                                          <div className="flex flex-col gap-1 text-xs">
                                              {contact.email && <a href={`mailto:${contact.email}`} onClick={e => e.stopPropagation()} className="flex items-center hover:underline text-primary"><Mail className="mr-2 h-3 w-3"/>{contact.email}</a>}
                                              {contact.phone && <Button variant="link" className="p-0 h-auto text-xs justify-start flex items-center" onClick={(e) => { e.stopPropagation(); handlePhoneClick(contact.phone); }}><Phone className="mr-2 h-3 w-3"/>{contact.phone}</Button>}
                                          </div>
                                      </TableCell>
                                  </TableRow>
                              ))
                          ) : (
                              <TableRow>
                                  <TableCell colSpan={5} className="text-center h-24">No contacts found matching your criteria.</TableCell>
                              </TableRow>
                          )}
                      </TableBody>
                  </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{selectedContact ? 'Edit' : 'Create'} VIP Contact</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="name">Name</Label>
              <Input id="name" {...form.register('name')} />
              {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>}
            </div>
             <div className="space-y-1">
              <Label htmlFor="role">Role</Label>
              <Input id="role" {...form.register('role')} />
              {form.formState.errors.role && <p className="text-sm text-destructive">{form.formState.errors.role.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="businessUnit">Business Unit</Label>
                <Controller name="businessUnit" control={form.control} render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>
                    <SelectItem value="PE">PE</SelectItem><SelectItem value="IPEC">IPEC</SelectItem><SelectItem value="Priority">Priority</SelectItem><SelectItem value="Other">Other</SelectItem>
                  </SelectContent></Select>
                )}/>
              </div>
              <div className="space-y-1">
                <Label htmlFor="state">State</Label>
                <Controller name="state" control={form.control} render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>
                    {[...ALL_STATES, 'National'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent></Select>
                )}/>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...form.register('email')} />
              {form.formState.errors.email && <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" {...form.register('phone')} />
            </div>
            <div className="space-y-1">
                <Label htmlFor="notes">Notes (max 250 chars)</Label>
                <Textarea id="notes" {...form.register('notes')} rows={3} maxLength={250} />
                {form.formState.errors.notes && <p className="text-sm text-destructive">{form.formState.errors.notes.message}</p>}
            </div>
            <DialogFooter className="pt-4">
              {selectedContact && (
                <Button type="button" variant="destructive" onClick={() => setIsDeleteConfirmOpen(true)} disabled={isSubmitting}>Delete</Button>
              )}
              <div className="flex-grow"></div>
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{selectedContact ? 'Save Changes' : 'Create Contact'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent>
            <DialogHeader><DialogTitle>Are you sure?</DialogTitle><DialogDescription>This will permanently delete the contact for {selectedContact?.name}. This action cannot be undone.</DialogDescription></DialogHeader>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)}>Cancel</Button>
                <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Delete</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

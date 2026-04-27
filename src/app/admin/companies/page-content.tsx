"use client";

import React, { useState } from 'react';
import { useAuth, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Loader2, Building2, PlusCircle, Edit, Trash2, Globe, Palette, Percent } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { collection, doc, setDoc, deleteDoc } from 'firebase/firestore';
import type { Company } from '@/lib/types';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';

export default function CompaniesPageContent() {
  const { role } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const companiesQuery = useMemoFirebase(() => {
    if (firestore && role === 'superadmin') {
      return collection(firestore, 'companies');
    }
    return null;
  }, [firestore, role]);

  const { data: companiesData, isLoading } = useCollection<Company>(companiesQuery);
  const companies = companiesData ?? [];

  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#616161');
  const [accentColor, setAccentColor] = useState('#ffa857');
  const [logoText, setLogoText] = useState('');
  const [markup, setMarkup] = useState<number>(0);

  const handleOpenCreate = () => {
    setSelectedCompany(null);
    setName('');
    setDomain('');
    setPrimaryColor('#616161');
    setAccentColor('#ffa857');
    setLogoText('');
    setMarkup(0);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (company: Company) => {
    setSelectedCompany(company);
    setName(company.name);
    setDomain(company.domain || '');
    setPrimaryColor(company.settings?.primaryColor || '#616161');
    setAccentColor(company.settings?.accentColor || '#ffa857');
    setLogoText(company.settings?.logoText || '');
    setMarkup(company.settings?.markup || 0);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!firestore || !name.trim()) return;
    
    setIsSubmitting(true);
    try {
      const isNew = !selectedCompany;
      // Generate ID from name only for new companies
      const companyId = isNew 
        ? name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') 
        : selectedCompany.id;

      if (!companyId) throw new Error("Invalid Company ID");

      const docRef = doc(firestore, 'companies', companyId);

      // Construct payload carefully to avoid undefined values which Firestore rejects
      const payload: any = {
        id: companyId,
        name: name.trim(),
        domain: domain.trim() || "", // Use empty string instead of undefined
        subscriptionStatus: isNew ? 'active' : (selectedCompany?.subscriptionStatus || 'active'),
        settings: {
          primaryColor: primaryColor || '#616161',
          accentColor: accentColor || '#ffa857',
          logoText: logoText.trim() || name.trim(),
          markup: Number(markup) || 0,
        }
      };

      // Standard blocking update to ensure the modal stays open until success/failure
      await setDoc(docRef, payload, { merge: true });
      
      toast({ 
        title: 'Success', 
        description: `Organization "${name}" has been ${isNew ? 'created' : 'updated'}.` 
      });
      setIsModalOpen(false);
    } catch (error: any) {
      console.error("Failed to save company:", error);
      toast({ 
        title: 'Update Failed', 
        description: error.message || 'Check your permissions and try again.', 
        variant: 'destructive' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCompany || !firestore) return;
    setIsSubmitting(true);
    try {
      const docRef = doc(firestore, 'companies', selectedCompany.id);
      await deleteDoc(docRef);
      toast({ title: 'Success', description: 'Company record deleted.' });
      setIsModalOpen(false);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Could not delete company.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
      setIsDeleteConfirmOpen(false);
    }
  };

  if (role !== 'superadmin') {
    return (
      <Card className="m-8">
        <CardHeader><CardTitle>Access Denied</CardTitle></CardHeader>
        <CardContent><p>Superadmin access required.</p></CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start gap-4">
            <div>
              <CardTitle className="text-2xl font-headline flex items-center">
                <Building2 className="mr-2 h-7 w-7 text-primary" /> Company Management
              </CardTitle>
              <CardDescription>Manage your SaaS tenants, branding, and billing status.</CardDescription>
            </div>
            <Button onClick={handleOpenCreate}>
              <PlusCircle className="mr-2 h-4 w-4" /> Create New Company
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company Name</TableHead>
                <TableHead>ID / Domain</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Markup</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-10"><Loader2 className="animate-spin mx-auto h-8 w-8 text-primary" /></TableCell></TableRow>
              ) : companies.length > 0 ? (
                companies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell className="font-semibold">{company.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                        <code className="text-xs bg-muted p-1 rounded">{company.id}</code>
                        {company.domain && <span className="ml-2">({company.domain})</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={company.subscriptionStatus === 'active' ? 'default' : 'destructive'} className="capitalize">
                        {company.subscriptionStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>{company.settings?.markup || 0}%</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(company)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={5} className="text-center py-10">No companies found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={(open) => !isSubmitting && setIsModalOpen(open)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedCompany ? 'Edit' : 'Create'} Company</DialogTitle>
            <DialogDescription>Configure tenant branding and global defaults.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            <div className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="comp-name">Company Name</Label>
                <Input id="comp-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Easy As Logistics" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="comp-domain">Primary Domain (Optional)</Label>
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <Input id="comp-domain" value={domain} onChange={e => setDomain(e.target.value)} placeholder="easyas.com" />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="comp-markup">Default Global Markup (%)</Label>
                <div className="flex items-center gap-2">
                  <Percent className="h-4 w-4 text-muted-foreground" />
                  <Input id="comp-markup" type="number" value={markup} onChange={e => setMarkup(Number(e.target.value))} />
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="comp-logo-text">Logo Text Display</Label>
                <Input id="comp-logo-text" value={logoText} onChange={e => setLogoText(e.target.value)} placeholder="Visible in header" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="flex items-center gap-2"><Palette className="h-3 w-3" /> Primary</Label>
                  <Input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="h-10 p-1" />
                </div>
                <div className="space-y-1">
                  <Label className="flex items-center gap-2"><Palette className="h-3 w-3" /> Accent</Label>
                  <Input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)} className="h-10 p-1" />
                </div>
              </div>
              <div className="p-4 border rounded-md bg-muted/30">
                <p className="text-xs font-semibold mb-2">Preview Branding</p>
                <div className="h-12 w-full rounded flex items-center justify-center font-bold text-white shadow-inner text-center px-2" style={{ backgroundColor: primaryColor }}>
                  {logoText || name || 'LOGO PREVIEW'}
                </div>
                <div className="mt-2 h-2 w-1/3 rounded" style={{ backgroundColor: accentColor }}></div>
              </div>
            </div>
          </div>
          <DialogFooter className="sm:justify-between">
            {selectedCompany && (
              <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={isSubmitting}><Trash2 className="mr-2 h-4 w-4" />Delete Company</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will delete the company profile for <strong>{name}</strong>. Note: This will not delete users or data already tagged with this company ID, but will break their access.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <div className="flex gap-2 ml-auto">
              <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
              <Button onClick={handleSave} disabled={isSubmitting || !name.trim()}>
                {isSubmitting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                {selectedCompany ? 'Save Changes' : 'Create Company'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
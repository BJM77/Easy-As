"use client";

import React, { useState, useMemo } from 'react';
import { useAuth, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Loader2, 
  ClipboardCheck, 
  Search, 
  Copy, 
  Building2, 
  User, 
  MapPin, 
  Phone, 
  Mail, 
  FileText,
  ChevronRight,
  ChevronDown,
  Trash2,
  Package,
  Zap,
  Tag
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { collection, query, orderBy, deleteDoc, doc, where } from 'firebase/firestore';
import type { TgeAccountApplication } from '@/lib/types';
import { format } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const CopyButton = ({ value, label }: { value: any, label: string }) => {
  const { toast } = useToast();
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const stringValue = value !== undefined && value !== null ? String(value) : '';
    try {
        await navigator.clipboard.writeText(stringValue);
        toast({ title: "Copied", description: `${label} copied to clipboard.` });
    } catch (err) {
        toast({ 
            title: "Copy Blocked", 
            description: "Browser policy blocked clipboard access. Please manually select and copy.", 
            variant: "destructive" 
        });
    }
  };
  return (
    <Button variant="ghost" size="icon" className="h-6 w-6 ml-1 text-muted-foreground hover:text-primary" onClick={handleCopy}>
      <Copy className="h-3.5 w-3.5" />
    </Button>
  );
};

const FieldRow = ({ label, value }: { label: string, value: any }) => (
  <div className="flex items-center justify-between p-2 rounded hover:bg-muted/50 transition-colors">
    <div className="flex-1">
      <span className="text-[10px] text-muted-foreground uppercase font-bold block leading-none mb-1">{label}</span>
      <span className="text-sm font-medium">{value || <em className="text-muted-foreground/50">N/A</em>}</span>
    </div>
    {value !== undefined && value !== null && <CopyButton value={value} label={label} />}
  </div>
);

export default function ApplicationsPageContent() {
  const { role, profile, company } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const applicationsQuery = useMemoFirebase(() => {
    if (!firestore || !role) return null;
    const baseQuery = collection(firestore, 'tgeAccountApplications');
    
    if (role === 'superadmin') {
      return query(baseQuery, orderBy('createdAt', 'desc'));
    }
    
    const activeCompanyId = company?.id || profile?.companyId;
    if (!activeCompanyId) return null;
    
    return query(baseQuery, where('companyId', '==', activeCompanyId), orderBy('createdAt', 'desc'));
  }, [firestore, role, profile?.companyId, company?.id]);

  const { data, isLoading } = useCollection<TgeAccountApplication>(applicationsQuery);
  const applications = data || [];

  const filteredApps = useMemo(() => {
    if (!applications || !Array.isArray(applications)) return [];
    return applications.filter(app => {
      const companyName = app.companyName?.toLowerCase() || '';
      const email = app.email?.toLowerCase() || '';
      const abn = app.abn || '';
      const q = searchQuery.toLowerCase();
      return companyName.includes(q) || email.includes(q) || abn.includes(q);
    });
  }, [applications, searchQuery]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!firestore) return;
    if (!confirm("Are you sure you want to delete this application record?")) return;

    try {
      await deleteDoc(doc(firestore, 'tgeAccountApplications', id));
      toast({ title: 'Application Deleted' });
    } catch (error) {
      toast({ title: 'Error', description: 'Could not delete application.', variant: 'destructive' });
    }
  };

  if (role !== 'superadmin' && role !== 'admin') {
    return <Card className="m-8"><CardContent className="pt-6">Unauthorized access.</CardContent></Card>;
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start gap-4">
            <div>
              <CardTitle className="text-2xl font-headline flex items-center">
                <ClipboardCheck className="mr-2 h-7 w-7 text-primary" /> Setup Applications
              </CardTitle>
              <CardDescription>View and manage saved account setup requests. Expand any row to copy specific fields for data entry.</CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search company, email, ABN..." 
                className="pl-8" 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin h-12 w-12 text-primary" /></div>
      ) : filteredApps.length > 0 ? (
        <div className="space-y-4">
          {filteredApps.map((app) => (
            <Card key={app.id} className={cn("overflow-hidden transition-all", expandedId === app.id ? "ring-2 ring-primary" : "hover:border-primary/50")}>
              <div 
                className="p-4 flex items-center justify-between cursor-pointer bg-card"
                onClick={() => setExpandedId(expandedId === app.id ? null : app.id)}
              >
                <div className="flex items-center gap-4 flex-1">
                  {expandedId === app.id ? <ChevronDown className="h-5 w-5 text-primary" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                  <div>
                    <h3 className="font-bold text-lg">{app.companyName}</h3>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Building2 className="h-3 w-3"/> {app.abn}</span>
                      <Separator orientation="vertical" className="h-3" />
                      <span className="flex items-center gap-1"><User className="h-3 w-3"/> {app.firstName} {app.lastName}</span>
                      <Separator orientation="vertical" className="h-3" />
                      <span className="flex items-center gap-1">Created: {app.createdAt ? format(new Date(app.createdAt), 'dd MMM yyyy') : 'N/A'}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-primary/5">{app.status}</Badge>
                  <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={(e) => handleDelete(app.id, e)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {expandedId === app.id && (
                <CardContent className="bg-muted/30 pt-6 border-t">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <h4 className="text-xs font-black text-primary tracking-widest flex items-center gap-2"><Building2 className="h-3 w-3"/> COMPANY CORE</h4>
                      <div className="space-y-1">
                        <FieldRow label="Legal Name" value={app.companyName} />
                        <FieldRow label="ABN" value={app.abn} />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-xs font-black text-primary tracking-widest flex items-center gap-2"><User className="h-3 w-3"/> CONTACT & ADDRESS</h4>
                      <div className="space-y-1">
                        <FieldRow label="Full Name" value={`${app.firstName} ${app.lastName}`} />
                        <FieldRow label="Email" value={app.email} />
                        <FieldRow label="Phone" value={app.phone} />
                        <FieldRow label="Suburb" value={app.suburb} />
                        <FieldRow label="Postcode" value={app.postcode} />
                        <FieldRow label="State" value={app.state} />
                      </div>
                    </div>
                  </div>

                  <Separator className="my-6" />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <h4 className="text-xs font-black text-primary tracking-widest flex items-center gap-2"><Package className="h-3 w-3"/> ESTIMATED FREIGHT (WEEKLY)</h4>
                      <div className="grid grid-cols-3 gap-2">
                        <FieldRow label="Satchels" value={app.estSatchelsPerWeek || 0} />
                        <FieldRow label="Parcels" value={app.estParcelsPerWeek || 0} />
                        <FieldRow label="Pallets" value={app.estPalletsPerWeek || 0} />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h4 className="text-xs font-black text-primary tracking-widest flex items-center gap-2"><Zap className="h-3 w-3"/> SERVICE SPEED REQUIRED</h4>
                      <div className="flex gap-2 p-2">
                        {app.speedStandard && <Badge variant="secondary">Standard</Badge>}
                        {app.speedPriority && <Badge variant="secondary">Priority</Badge>}
                        {app.speedSameDay && <Badge variant="secondary">Same-Day</Badge>}
                        {(!app.speedStandard && !app.speedPriority && !app.speedSameDay) && <span className="text-xs italic text-muted-foreground">None specified</span>}
                      </div>
                    </div>
                  </div>

                  <Separator className="my-6" />

                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-primary tracking-widest flex items-center gap-2"><Tag className="h-3 w-3"/> ADDITIONAL INFO</h4>
                    <div className="mt-2 space-y-2">
                      <Label className="text-[10px] text-muted-foreground uppercase font-bold">Notes / Questions</Label>
                      <div className="p-3 border rounded bg-background text-sm leading-relaxed min-h-[60px]">
                        {app.notes || <span className="italic text-muted-foreground">No notes provided.</span>}
                      </div>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-muted-foreground border-2 border-dashed rounded-lg">
          <FileText className="h-16 w-16 mx-auto mb-4 opacity-20" />
          <p>No applications found.</p>
        </div>
      )}
    </div>
  );
}

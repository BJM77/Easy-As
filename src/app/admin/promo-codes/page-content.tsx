"use client";

import React, { useState } from 'react';
import { useAuth, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Ticket, PlusCircle, Trash2, CheckCircle2, Clock, Calendar as CalendarIcon, User, Building, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { collection, doc, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import type { PromoCode } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export default function PromoCodesPageContent() {
  const { role } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const codesQuery = useMemoFirebase(() => {
    if (firestore && role === 'superadmin') {
      return query(collection(firestore, 'promoCodes'), orderBy('createdAt', 'desc'));
    }
    return null;
  }, [firestore, role]);

  const { data: promoCodesData, isLoading } = useCollection<PromoCode>(codesQuery);
  const promoCodes = promoCodesData ?? [];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [code, setCode] = useState('');
  const [type, setType] = useState<'free_time' | 'unlimited'>('free_time');
  const [validDays, setValidDays] = useState('30');

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = 'EASY-';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCode(result);
  };

  const handleCreateCode = async () => {
    if (!firestore || !code.trim()) return;
    setIsSubmitting(true);

    try {
      const docRef = doc(firestore, 'promoCodes', code.trim().toUpperCase());
      const payload: PromoCode = {
        id: code.trim().toUpperCase(),
        code: code.trim().toUpperCase(),
        type,
        validDays: type === 'free_time' ? parseInt(validDays, 10) : undefined,
        status: 'active',
        createdAt: new Date().toISOString()
      };

      await setDoc(docRef, payload);
      toast({ title: 'Code Generated', description: `Promo code ${payload.code} is now active.` });
      setIsModalOpen(false);
      setCode('');
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to create code.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'promoCodes', id));
      toast({ title: 'Deleted', description: 'Promo code removed.' });
    } catch (error) {
      toast({ title: 'Error', description: 'Could not delete code.', variant: 'destructive' });
    }
  };

  if (role !== 'superadmin') {
    return <Card className="m-8"><CardContent className="pt-6">Unauthorized access. Superadmin only.</CardContent></Card>;
  }

  return (
    <div className="space-y-8">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start gap-4">
            <div>
              <CardTitle className="text-2xl font-headline flex items-center">
                <Ticket className="mr-2 h-7 w-7 text-primary" /> Promo Code Manager
              </CardTitle>
              <CardDescription>Generate and track one-time promotional codes for organizational access.</CardDescription>
            </div>
            <Button onClick={() => { generateRandomCode(); setIsModalOpen(true); }}>
              <PlusCircle className="mr-2 h-4 w-4" /> Generate New Code
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Benefit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Usage Audit</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10"><Loader2 className="animate-spin mx-auto h-8 w-8 text-primary" /></TableCell></TableRow>
              ) : Array.isArray(promoCodes) && promoCodes.length > 0 ? (
                promoCodes.map((pc) => (
                  <TableRow key={pc.id}>
                    <TableCell className="font-mono font-bold text-lg">{pc.code}</TableCell>
                    <TableCell className="capitalize">{pc.type?.replace('_', ' ')}</TableCell>
                    <TableCell>
                      {pc.type === 'unlimited' ? (
                        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">Unlimited Access</Badge>
                      ) : (
                        <span>{pc.validDays} Days Free</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={pc.status === 'active' ? 'default' : pc.status === 'used' ? 'secondary' : 'destructive'} className="capitalize">
                        {pc.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {pc.usedByCompanyId ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center text-xs font-semibold">
                            <Building className="h-3 w-3 mr-1 text-muted-foreground" />
                            {pc.usedByCompanyId}
                          </div>
                          <div className="flex items-center text-[10px] text-muted-foreground">
                            <User className="h-2.5 w-2.5 mr-1" />
                            {pc.usedByEmail}
                          </div>
                          <div className="flex items-center text-[10px] text-muted-foreground">
                            <Clock className="h-2.5 w-2.5 mr-1" />
                            {pc.usedAt && format(new Date(pc.usedAt), 'dd MMM yyyy, p')}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Not yet redeemed</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(pc.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={6} className="text-center py-24 text-muted-foreground">No promotional codes generated yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Promo Code</DialogTitle>
            <DialogDescription>Create a unique code to grant free or unlimited access.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label>Access Type</Label>
              <Select value={type} onValueChange={(v: any) => setType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="free_time">Limited Free Time (Days)</SelectItem>
                  <SelectItem value="unlimited">Unlimited Access (Lifetime)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="pc-code">Code</Label>
              <div className="flex gap-2">
                <Input id="pc-code" value={code} onChange={e => setCode(e.target.value.toUpperCase())} maxLength={15} className="font-mono text-center" />
                <Button variant="outline" size="icon" onClick={generateRandomCode}><RefreshCw className="h-4 w-4" /></Button>
              </div>
            </div>

            {type === 'free_time' && (
              <div className="space-y-1">
                <Label htmlFor="pc-days">Free Duration (Days)</Label>
                <Input id="pc-days" type="number" value={validDays} onChange={e => setValidDays(e.target.value)} />
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleCreateCode} disabled={isSubmitting || !code.trim()}>
              {isSubmitting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
              Activate Code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
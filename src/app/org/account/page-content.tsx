
"use client";

import React, { useMemo, useState } from 'react';
import { useAuth, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { 
  Building2, 
  CreditCard, 
  Users2, 
  Calendar, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ExternalLink,
  ShieldCheck,
  Zap,
  Package,
  Edit,
  Ticket,
  Check
} from 'lucide-react';
import { format, addMonths, parseISO, addDays } from 'date-fns';
import Link from 'next/link';
import { collection, query, where, doc, getDoc, updateDoc } from 'firebase/firestore';
import type { UserProfile, PromoCode } from '@/lib/types';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';

export default function AccountPageContent() {
  const { user, profile, company, role, loading: authLoading } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);

  // Fetch users for this company
  const teamQuery = useMemoFirebase(() => {
    if (!firestore || !profile?.companyId) return null;
    return query(collection(firestore, 'users'), where('companyId', '==', profile.companyId));
  }, [firestore, profile?.companyId]);

  const { data: teamMembers = [], isLoading: isLoadingTeam } = useCollection<UserProfile>(teamQuery);

  const subscriptionInfo = useMemo(() => {
    if (!company) return null;
    
    // Check if unlimited
    if (company.isUnlimited) {
      return {
        status: 'Unlimited Access',
        nextPaymentDate: null,
        planName: 'Lifetime / Enterprise',
        price: 'N/A',
      };
    }

    // Check if promo active
    if (company.promoExpiryDate) {
      const expiry = parseISO(company.promoExpiryDate);
      if (expiry > new Date()) {
        return {
          status: 'Promo Active',
          nextPaymentDate: expiry,
          planName: 'Promotional Period',
          price: 'Free',
        };
      }
    }
    
    const startDate = company.createdAt ? parseISO(company.createdAt) : new Date();
    const nextPaymentDate = addMonths(startDate, 1);
    
    return {
      status: company.subscriptionStatus || 'inactive',
      nextPaymentDate,
      planName: 'Monthly SaaS Standard',
      price: '$9.95',
    };
  }, [company]);

  const stats = useMemo(() => {
    if (!teamMembers) return { totalUsers: 0, totalTokens: 0 };
    const totalTokens = teamMembers.reduce((sum, m) => sum + (m.tokens || 0), 0);
    return {
      totalUsers: teamMembers.length,
      totalTokens
    };
  }, [teamMembers]);

  const handleRedeemCode = async () => {
    if (!promoCodeInput.trim() || !firestore || !company || !user) return;
    setIsRedeeming(true);

    try {
      const codeId = promoCodeInput.trim().toUpperCase();
      const codeRef = doc(firestore, 'promoCodes', codeId);
      const codeSnap = await getDoc(codeRef);

      if (!codeSnap.exists()) {
        throw new Error("Invalid promotion code.");
      }

      const codeData = codeSnap.data() as PromoCode;
      if (codeData.status !== 'active') {
        throw new Error("This code has already been used or has expired.");
      }

      // Update Code Record First (to lock it globally via security rules)
      await updateDoc(codeRef, {
        status: 'used',
        usedByCompanyId: company.id,
        usedByEmail: user.email,
        usedAt: new Date().toISOString()
      });

      // Update Company Account
      const companyRef = doc(firestore, 'companies', company.id);
      const updates: any = { subscriptionStatus: 'active' };
      
      if (codeData.type === 'unlimited') {
        updates.isUnlimited = true;
      } else if (codeData.type === 'free_time' && codeData.validDays) {
        const currentExpiry = company.promoExpiryDate ? parseISO(company.promoExpiryDate) : new Date();
        const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
        updates.promoExpiryDate = addDays(baseDate, codeData.validDays).toISOString();
      }

      await updateDoc(companyRef, updates);

      toast({ title: 'Code Redeemed!', description: 'Your organization status has been updated.' });
      setPromoCodeInput('');
    } catch (error: any) {
      console.error("Redemption error:", error);
      toast({ title: 'Redemption Failed', description: error.message || 'The code could not be redeemed. It may have already been used by someone else.', variant: 'destructive' });
    } finally {
      setIsRedeeming(false);
    }
  };

  if (authLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin h-12 w-12 text-primary" /></div>;

  if (!company) {
    return (
      <Card className="max-w-md mx-auto mt-10">
        <CardHeader>
          <CardTitle>Organization Not Found</CardTitle>
          <CardDescription>We couldn't retrieve your organization details.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-headline flex items-center gap-2">
            <Building2 className="h-8 w-8 text-primary" />
            Organization Account
          </h1>
          <p className="text-muted-foreground">Manage your business profile, billing, and team access.</p>
        </div>
        <Badge variant={company.subscriptionStatus === 'active' ? 'default' : 'destructive'} className="text-sm px-4 py-1 uppercase tracking-wider">
          {company.isUnlimited ? 'Unlimited' : (subscriptionInfo?.status || company.subscriptionStatus)}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Subscription Card */}
        <Card className="lg:col-span-2 shadow-lg border-t-4 border-primary">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Subscription & Billing
            </CardTitle>
            <CardDescription>Your current plan and payment schedule.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 rounded-lg bg-muted/30 border space-y-2">
                <p className="text-sm text-muted-foreground font-medium uppercase">Current Plan</p>
                <div className="flex justify-between items-baseline">
                  <h3 className="text-2xl font-bold">{subscriptionInfo?.planName}</h3>
                  <span className="text-primary font-bold">{subscriptionInfo?.price}{subscriptionInfo?.price !== 'Free' && subscriptionInfo?.price !== 'N/A' && <span className="text-xs font-normal text-muted-foreground">/mo</span>}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-green-600 font-medium pt-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Includes { (100000).toLocaleString() } Monthly AI Tokens
                </div>
              </div>

              <div className="p-4 rounded-lg bg-muted/30 border space-y-2">
                <p className="text-sm text-muted-foreground font-medium uppercase">Next Payment Due</p>
                <h3 className="text-2xl font-bold flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  {subscriptionInfo?.nextPaymentDate ? format(subscriptionInfo.nextPaymentDate, 'dd MMM yyyy') : 'Never'}
                </h3>
                <p className="text-xs text-muted-foreground">{company.isUnlimited ? 'Your account is permanently active.' : 'Auto-renewal will charge your saved card.'}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="flex items-center gap-2"><Zap className="h-4 w-4 text-amber-500" /> Organizational AI Token Pool</span>
                <span className="font-bold">{stats.totalTokens.toLocaleString()} Credits</span>
              </div>
              <Progress value={Math.min(100, (stats.totalTokens / 500000) * 100)} className="h-2" />
              <p className="text-[10px] text-muted-foreground italic text-right">Pool shared across {stats.totalUsers} active users.</p>
            </div>
          </CardContent>
          <CardFooter className="bg-muted/30 border-t py-4 gap-3 flex-wrap">
            <Button asChild>
              <Link href="/register">
                <ExternalLink className="mr-2 h-4 w-4" />
                Manage Payment Methods
              </Link>
            </Button>
            <Button variant="outline">Download Latest Invoice</Button>
          </CardFooter>
        </Card>

        {/* Redeem Code Card */}
        <Card className="shadow-md flex flex-col">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Ticket className="h-5 w-5 text-accent" />
              Redeem Access Code
            </CardTitle>
            <CardDescription>Enter a one-time promotional code to extend your access.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 flex-grow">
            <div className="space-y-2">
              <Label htmlFor="promo-code">Promo Code</Label>
              <div className="flex gap-2">
                <Input 
                  id="promo-code" 
                  placeholder="EASY-XXXX-XXXX" 
                  value={promoCodeInput}
                  onChange={e => setPromoCodeInput(e.target.value.toUpperCase())}
                  className="font-mono"
                />
                <Button 
                  onClick={handleRedeemCode} 
                  disabled={isRedeeming || !promoCodeInput.trim()}
                  size="icon"
                >
                  {isRedeeming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground italic">Codes are single-use across the entire site.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Business Details Card */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Business Identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase">Organization Name</Label>
                <p className="font-bold text-lg">{company.name}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase">Tenant ID</Label>
                <code className="block p-2 bg-muted rounded text-xs font-mono">{company.id}</code>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground uppercase">Registered Domain</Label>
              <p className="text-sm">{company.domain || 'Not configured'}</p>
            </div>
            <Separator />
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground uppercase">SaaS Status</Label>
              <div className="flex items-center gap-2 text-sm text-blue-600 font-medium">
                <ShieldCheck className="h-4 w-4" />
                Multi-tenant Isolation Active
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="ghost" size="sm" asChild className="w-full justify-start text-xs">
              <Link href="/settings/branding">
                <Edit className="mr-2 h-3 w-3" /> Customize Brand Identity
              </Link>
            </Button>
          </CardFooter>
        </Card>

        {/* Team Summary */}
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <Users2 className="h-5 w-5 text-primary" />
                Active Team Members
              </CardTitle>
              <CardDescription>Staff with access to your organization.</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/team">
                Manage <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingTeam ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-10"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow>
                ) : teamMembers.map(m => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{m.name}</span>
                        <span className="text-xs text-muted-foreground">{m.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize text-[10px]">{m.role}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {m.tokens?.toLocaleString() || 0}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

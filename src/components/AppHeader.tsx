"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Link from 'next/link';
import {
  Package,
  Calculator,
  FileText,
  Cog,
  BarChartHorizontalBig,
  Menu as MenuIcon,
  GitCompareArrows,
  Warehouse,
  Route,
  Scale,
  ShieldAlert,
  Sparkles,
  Settings,
  Info,
  Briefcase,
  ExternalLink,
  Globe,
  ArrowRightLeft,
  FileUp,
  FileJson,
  Users,
  BookOpen,
  Layers,
  Orbit,
  Compass,
  FileSignature,
  UserCheck,
  Search,
  Computer,
  Key,
  UploadCloud,
  X as XIcon,
  Loader2,
  LogOut,
  User,
  Home,
  Receipt,
  ListOrdered,
  Lock,
  Cloud,
  Mail,
  Link2,
  Truck,
  Building,
  AlarmClock,
  AtSign,
  Trash2,
  BarChart,
  Users2,
  Palette,
  PlusCircle,
  Fuel,
  Link as LinkIcon,
  Building2,
  ToggleRight,
  UserPlus,
  UserCircle,
  CreditCard,
  Ticket,
  ClipboardCheck,
  Mic,
  BrainCircuit,
  Settings2,
  LayoutDashboard,
  FlaskConical,
  Activity,
  MessagesSquare,
  ShieldCheck,
  ListTree,
  Database,
  History,
  MapPin,
  Zap,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useSession } from '@/context/SessionContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ApiKeysDialog from './ApiKeysDialog';
import { useAuth, useCollection, useMemoFirebase, initializeFirebase } from '@/firebase';
import { sendEmailVerification } from 'firebase/auth';
import type { Alarm } from '@/firebase/auth/use-user';
import NewProblemDialog from './NewProblemDialog';
import NewLeadDialog from './NewLeadDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogDescription,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { PageKey, UserRole, Company, QuoteAgentOutput } from '@/lib/types';
import { useSettings } from "@/context/SettingsContext";
import HeaderConfigDialog, { availableIcons } from './HeaderConfigDialog';
import { useToast } from "@/hooks/use-toast";
import { collection } from "firebase/firestore";
import { GlobalSearch } from './GlobalSearch';
import { Checkbox } from '@/components/ui/checkbox';
function TopBar() {
  const { company } = useAuth();
  const { timezones, visibleTimezones, externalLinks } = useSettings();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const activeTimezones = useMemo(() => {
    return Object.entries(timezones).filter(([zoneId]) => visibleTimezones[zoneId]);
  }, [timezones, visibleTimezones]);

  return (
    <div className="w-full py-1.5 px-4 border-b transition-colors" style={{ backgroundColor: company?.settings?.topMenuColor || 'hsl(var(--background))' }}>
      <div className="container mx-auto flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            {externalLinks.map(link => {
              const Icon = availableIcons[link.icon as keyof typeof availableIcons] || Link2;
              return (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  <Icon className="h-3 w-3" />
                  <span>{link.label}</span>
                </a>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {activeTimezones.map(([zoneId, { label, time }]) => (
            <span key={zoneId}>{label}: {time}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

const ActiveAlarmCountdown = () => {
  const { nextAlarm } = useAuth();
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);

  useEffect(() => {
    let timerId: NodeJS.Timeout;

    const updateRemainingTime = () => {
      if (nextAlarm) {
        const now = new Date();
        const diff = new Date(nextAlarm.time).getTime() - now.getTime();

        if (diff <= 0) {
          setTimeRemaining(null);
        } else {
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diff % (1000 * 60)) / 1000);
          setTimeRemaining(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
        }
      } else {
        setTimeRemaining(null);
      }
    };

    updateRemainingTime(); 
    timerId = setInterval(updateRemainingTime, 1000);

    return () => clearInterval(timerId);
  }, [nextAlarm]);

  if (!timeRemaining) return null;

  return (
    <div className="flex items-center gap-1.5 text-[10px] font-black font-mono text-red-500 animate-pulse">
      <Clock className="h-3 w-3" />
      <span>{timeRemaining}</span>
    </div>
  );
};

function EmailVerificationBanner() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSending, setIsSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleResend = async () => {
    if (!user) return;
    setIsSending(true);
    try {
      await sendEmailVerification(user);
      toast({
        title: "Verification Email Sent",
        description: "Please check your inbox.",
      });
      setEmailSent(true);
    } catch (error) {
      toast({
        title: "Error",
        description: "Could not send verification email.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  if (!user || user.emailVerified || user.email === '1@1.com') {
    return null;
  }

  return (
    <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-2 text-xs flex justify-between items-center px-4 print-hide" role="alert">
      <p>Please <strong>Verify Your Email</strong> to fully activate your account.</p>
      <Button
        onClick={handleResend}
        disabled={isSending || emailSent}
        size="sm"
        variant="outline"
        className="h-6 text-[10px] bg-yellow-50 border-yellow-400 text-yellow-800"
      >
        {emailSent ? 'Sent' : 'Resend Email'}
      </Button>
    </div>
  );
}

export default function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isApiKeysDialogOpen, setIsApiKeysDialogOpen] = useState(false);
  const [isHeaderConfigOpen, setIsHeaderConfigOpen] = useState(false);
  const [isProblemDialogOpen, setIsProblemDialogOpen] = useState(false);
  const [isLeadDialogOpen, setIsLeadDialogOpen] = useState(false);

  const { 
    user, 
    profile, 
    company, 
    role,
    actualRole, 
    loading, 
    removeAlarm, 
    alarms, 
    snoozeAlarm, 
    rebookAlarm, 
    isSuperadmin, 
    nextAlarm,
    viewAsCompanyId,
    setViewAsCompanyId,
    viewAsRole,
    setViewAsRole,
    switchActiveCompany
  } = useAuth();
  
  const { pagePermissions } = useSettings();

  const hasPageAccess = useCallback((pageKey: PageKey) => {
    if (actualRole === 'superadmin') return true;
    if (!role || !pagePermissions) return false;
    
    const roleKey = role === null ? 'null' : role;
    const allowedPages = pagePermissions[roleKey] || [];
    if (!allowedPages.includes(pageKey)) return false;

    if (company?.enabledFeatures?.[pageKey] === false) return false;

    return true;
  }, [role, actualRole, pagePermissions, company]);

  const isAuthPage = pathname === '/login' || pathname === '/register' || pathname === '/forgot-password' || pathname?.startsWith('/register/invite/');

  const [isAlarmDialogOpen, setIsAlarmDialogOpen] = useState(false);
  const [alarmMessage, setAlarmMessage] = useState('');
  const [alarmTime, setAlarmTime] = useState('');
  const [recurrence, setRecurrence] = useState<'none' | 'daily' | 'weekly'>('none');
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);

  const [firingAlarm, setFiringAlarm] = useState<Alarm | null>(null);

  const mountedRef = useRef(true);

  const companiesRef = useMemoFirebase(() => (isSuperadmin ? collection(initializeFirebase().firestore, 'companies') : null), [isSuperadmin]);
  const { data: companiesData } = useCollection<Company>(companiesRef);
  const companies = companiesData || [];

  const handleSwitchCompany = async (companyId: string) => {
    try {
      await switchActiveCompany(companyId);
      toast({ title: "Workspace Switched", description: `You are now in ${companies.find(c => c.id === companyId)?.name || companyId}.` });
    } catch (e: any) {
      toast({ title: "Switch Failed", description: e.message, variant: "destructive" });
    }
  };

  useEffect(() => {
    setIsMounted(true);
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const checkAlarms = () => {
      if (!mountedRef.current) return;

      const now = new Date();
      const expiredAlarms: Alarm[] = [];

      for (const alarm of alarms) {
        if (new Date(alarm.time).getTime() <= now.getTime()) {
          expiredAlarms.push(alarm);
        }
      }

      if (expiredAlarms.length > 0) {
        setFiringAlarm(expiredAlarms[0]);
      }
    };

    const intervalId = setInterval(checkAlarms, 1000);
    return () => clearInterval(intervalId);
  }, [alarms]);


  const handleSetAlarm = () => {
    if (!alarmTime) return;
    const [hours, minutes] = alarmTime.split(':').map(Number);
    const time = new Date();
    time.setHours(hours, minutes, 0, 0);
    if (time < new Date()) time.setDate(time.getDate() + 1);

    const newAlarm: Alarm = {
      id: `alarm-${Date.now()}`,
      message: alarmMessage || 'Reminder',
      time,
      recurrence,
      recurrenceDays: recurrence === 'weekly' ? recurrenceDays : undefined
    };

    toast({ title: "Alarm Set", description: `Reminding you at ${time.toLocaleTimeString()}.` });
    setIsAlarmDialogOpen(false);
  };

  const handleOpenAlarmDialog = () => {
    const nextMinute = new Date(new Date().getTime() + 60000);
    const hours = String(nextMinute.getHours()).padStart(2, '0');
    const minutes = String(nextMinute.getMinutes()).padStart(2, '0');
    setAlarmTime(`${hours}:${minutes}`);
    setAlarmMessage('');
    setRecurrence('none');
    setRecurrenceDays([]);
    setIsAlarmDialogOpen(true);
  };

  const handleRecurrenceDayChange = (dayIndex: number) => {
    setRecurrenceDays(prev => {
      if (prev.includes(dayIndex)) {
        return prev.filter(d => d !== dayIndex);
      } else {
        return [...prev, dayIndex];
      }
    });
  };

  const handleLogout = async () => {
    try {
      const { getAuth } = await import('firebase/auth');
      await getAuth(initializeFirebase().firebaseApp).signOut();
      router.push('/login');
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const navLinkClasses = (href: string, isMobileSheetLink: boolean = false) =>
    cn(
      'hover:text-accent flex items-center transition-colors text-sm font-medium',
      isMobileSheetLink
        ? 'px-4 py-3 rounded-md w-full justify-start text-base border-b last:border-0'
        : 'px-3 py-2 rounded-md',
      pathname === href
        ? isMobileSheetLink
          ? 'bg-primary/20 text-accent font-semibold'
          : 'bg-primary/10 text-accent font-semibold'
        : isMobileSheetLink
          ? 'hover:bg-primary-foreground/10'
          : 'hover:bg-primary/20 hover:text-accent'
    );

  const NavItem = ({ href, icon: Icon, label, isMobile }: { href: string, icon: any, label: string, isMobile: boolean }) => (
    <Link
      href={href}
      className={navLinkClasses(href, isMobile)}
      onClick={() => isMobile && setIsMobileMenuOpen(false)}
    >
      <Icon className="mr-3 h-5 w-5" /> {label}
    </Link>
  );

  const desktopNav = (
    <nav className="flex items-center space-x-0.5 flex-wrap justify-center">
      <Link href="/" className={navLinkClasses('/')}><Home className="mr-1.5 h-4 w-4" /> Home</Link>
      {hasPageAccess('calculator') && <Link href="/calculator" className={navLinkClasses('/calculator')}><Calculator className="mr-1.5 h-4 w-4" /> Calculate</Link>}
      {hasPageAccess('ai-guru') && (
        <>
          <Link href="/ai-guru" className={navLinkClasses('/ai-guru')}><Sparkles className="mr-1.5 h-4 w-4" /> Plan</Link>
          {hasPageAccess('proposal') && <Link href="/proposal" className={navLinkClasses('/proposal')}><FileSignature className="mr-1.5 h-4 w-4" /> Proposal</Link>}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className={cn(navLinkClasses('/comparison').replace(/bg-primary\/10/g, ''), 'data-[state=open]:bg-primary/10 data-[state=open]:text-accent')}>
                <Layers className="mr-1.5 h-4 w-4" /> Compare
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {hasPageAccess('rate-card') && <DropdownMenuItem asChild><Link href="/rate-card"><FileText className="mr-2 h-4 w-4" />Rate Card</Link></DropdownMenuItem>}
              {hasPageAccess('sb-comparison') && <DropdownMenuItem asChild><Link href="/sb-comparison"><BarChartHorizontalBig className="mr-2 h-4 w-4" />SB Comparison</Link></DropdownMenuItem>}
              {hasPageAccess('rate-comparison') && <DropdownMenuItem asChild><Link href="/rate-comparison"><GitCompareArrows className="mr-2 h-4 w-4" />New/Old Rates</Link></DropdownMenuItem>}
              {hasPageAccess('competitor-comparison') && <DropdownMenuItem asChild><Link href="/competitor-comparison"><Scale className="mr-2 h-4 w-4" />Best SB</Link></DropdownMenuItem>}
              {hasPageAccess('multi') && <DropdownMenuItem asChild><Link href="/multi"><Route className="mr-2 h-4 w-4" />Multi-Leg</Link></DropdownMenuItem>}
              {hasPageAccess('leg-discount') && <DropdownMenuItem asChild><Link href="/leg-discount"><ArrowRightLeft className="mr-2 h-4 w-4" />Leg Discount</Link></DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
      {(hasPageAccess('live') || hasPageAccess('routing') || hasPageAccess('find-it')) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className={cn(navLinkClasses('/live'), 'data-[state=open]:bg-primary/10 data-[state=open]:text-accent')}>
              <Orbit className="mr-1.5 h-4 w-4" /> Live
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {hasPageAccess('live') && !['agent', 'bdm'].includes(role || '') && <DropdownMenuItem asChild><Link href="/live"><Orbit className="mr-2 h-4 w-4" /> Live Track</Link></DropdownMenuItem>}
            {hasPageAccess('routing') && <DropdownMenuItem asChild><Link href="/routing"><Route className="mr-2 h-4 w-4" /> Routing</Link></DropdownMenuItem>}
            {hasPageAccess('find-it') && <DropdownMenuItem asChild><Link href="/find-it"><Compass className="mr-2 h-4 w-4" /> Find It</Link></DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {hasPageAccess('location-lookup') && <Link href="/location-lookup" className={navLinkClasses('/location-lookup')}><Warehouse className="mr-1.5 h-4 w-4" /> Lookup</Link>}
      {hasPageAccess('notebook') && <Link href="/notebook" className={navLinkClasses('/notebook')}><BookOpen className="mr-1.5 h-4 w-4" /> Notebook</Link>}
      {user && profile?.companyId && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className={cn(navLinkClasses('/org'), 'data-[state=open]:bg-primary/10 data-[state=open]:text-accent')}>
              <Building2 className="mr-1.5 h-4 w-4" /> Org
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {hasPageAccess('org-account') && <DropdownMenuItem asChild><Link href="/org/account"><CreditCard className="mr-2 h-4 w-4" /> Account & Billing</Link></DropdownMenuItem>}
            {hasPageAccess('register-tge') && <DropdownMenuItem asChild><Link href="/org/register-tge"><ClipboardCheck className="mr-2 h-4 w-4" /> Register TGE Account</Link></DropdownMenuItem>}
            {hasPageAccess('json-management') && <DropdownMenuItem asChild><Link href="/org/json"><FileJson className="mr-2 h-4 w-4" /> JSON Database</Link></DropdownMenuItem>}
            {hasPageAccess('team') && <DropdownMenuItem asChild><Link href="/admin/team"><Users2 className="mr-2 h-4 w-4" /> My Team</Link></DropdownMenuItem>}
            {hasPageAccess('branding') && <DropdownMenuItem asChild><Link href="/settings/branding"><Palette className="mr-2 h-4 w-4" /> Branding</Link></DropdownMenuItem>}
            <DropdownMenuSeparator />
            {hasPageAccess('about-tge') && <DropdownMenuItem asChild><Link href="/about-tge"><Info className="mr-2 h-4 w-4" /> About TGE</Link></DropdownMenuItem>}
            {hasPageAccess('remittance') && <DropdownMenuItem asChild><Link href="/admin/remittance"><Receipt className="mr-2 h-4 w-4" /> Remittance</Link></DropdownMenuItem>}
            {hasPageAccess('json-creator') && <DropdownMenuItem asChild><Link href="/admin/json-creator"><FileJson className="mr-2 h-4 w-4" /> JSON Creator</Link></DropdownMenuItem>}
            {hasPageAccess('top-links') && <DropdownMenuItem asChild><Link href="/admin/top-links"><LinkIcon className="mr-2 h-4 w-4" /> Top Links</Link></DropdownMenuItem>}
            <DropdownMenuItem asChild>
              <Link href="/how-to" className="flex items-center text-primary font-bold">
                <BookOpen className="mr-2 h-4 w-4" /> User Guide
              </Link>
            </DropdownMenuItem>
            {hasPageAccess('info') && <DropdownMenuItem asChild><Link href="/info"><Info className="mr-2 h-4 w-4" /> Info Hub</Link></DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {actualRole === 'superadmin' && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className={cn(navLinkClasses('/admin'), 'data-[state=open]:bg-primary/10 data-[state=open]:text-accent')}>
              <Settings className="mr-1.5 h-4 w-4" /> Admin
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuLabel className="flex items-center gap-2"><Users2 className="h-4 w-4" /> Identity & Access</DropdownMenuLabel>
            <DropdownMenuGroup>
                <DropdownMenuItem asChild><Link href="/admin/user-management"><Users2 className="mr-2 h-4 w-4" /> Users</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="/admin/roles"><ShieldCheck className="mr-2 h-4 w-4" /> Role Matrix</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="/admin/companies"><Building2 className="mr-2 h-4 w-4" /> SaaS Tenants</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="/admin/manual-onboard"><UserPlus className="mr-2 h-4 w-4" /> Onboard</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="/admin/feature-management"><ToggleRight className="mr-2 h-4 w-4" /> Features</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="/admin/audit-log"><ShieldCheck className="mr-2 h-4 w-4" /> Audit Trail</Link></DropdownMenuItem>
            </DropdownMenuGroup>
            
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="flex items-center gap-2"><Database className="h-4 w-4" /> Configuration</DropdownMenuLabel>
            <DropdownMenuGroup>
                <DropdownMenuItem asChild><Link href="/settings"><Settings2 className="mr-2 h-4 w-4" /> Global Settings</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="/admin/surcharges"><Fuel className="mr-2 h-4 w-4" /> Fees & Surcharges</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="/admin/promo-codes"><Ticket className="mr-2 h-4 w-4" /> Promo Codes</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="/admin/update-ras"><MapPin className="mr-2 h-4 w-4" /> Update RAS</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="/price-test"><ListTree className="mr-2 h-4 w-4" /> Logic Tester</Link></DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />
            <DropdownMenuLabel className="flex items-center gap-2"><BarChart className="h-4 w-4" /> Intelligence & Logs</DropdownMenuLabel>
            <DropdownMenuGroup>
                <DropdownMenuItem asChild><Link href="/admin/activity"><Activity className="mr-2 h-4 w-4" /> Global Activity Feed</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="/admin/quote-logs"><History className="mr-2 h-4 w-4" /> Quote History Log</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="/admin/ai-analytics"><Activity className="mr-2 h-4 w-4" /> AI Pulse</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="/admin/ai-mode"><BrainCircuit className="mr-2 h-4 w-4" /> AI Diagnostics</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="/admin/run-reports"><ListOrdered className="mr-2 h-4 w-4" /> Run History</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="/admin/calculations"><Calculator className="mr-2 h-4 w-4" /> Math Audit</Link></DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />
            <DropdownMenuItem asChild><Link href="/status"><Computer className="mr-2 h-4 w-4" /> System Health</Link></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </nav>
  );

  const mobileNav = (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="core" className="border-none">
        <AccordionTrigger className="px-4 py-3 hover:no-underline font-bold text-lg text-primary-foreground">
          <div className="flex items-center gap-3"><LayoutDashboard className="h-5 w-5" /> Main Tools</div>
        </AccordionTrigger>
        <AccordionContent className="bg-primary-foreground/5 space-y-1">
          <NavItem href="/" icon={Home} label="Home Dashboard" isMobile />
          {hasPageAccess('calculator') && <NavItem href="/calculator" icon={Calculator} label="Freight Calculator" isMobile />}
          <NavItem href="/ai-quote" icon={Sparkles} label="Conversational AI" isMobile />
          {hasPageAccess('ai-guru') && <NavItem href="/ai-guru" icon={Sparkles} label="Perfect Plan Wizard" isMobile />}
          {hasPageAccess('proposal') && <NavItem href="/proposal" icon={FileSignature} label="AI Proposal Builder" isMobile />}
        </AccordionContent>
      </AccordionItem>

      {hasPageAccess('ai-guru') && (
        <AccordionItem value="compare" className="border-none">
          <AccordionTrigger className="px-4 py-3 hover:no-underline font-bold text-lg text-primary-foreground">
            <div className="flex items-center gap-3"><Layers className="h-5 w-5" /> Comparison Suite</div>
          </AccordionTrigger>
          <AccordionContent className="bg-primary-foreground/5 space-y-1">
            {hasPageAccess('rate-card') && <NavItem href="/rate-card" icon={FileText} label="Rate Card Generator" isMobile />}
            {hasPageAccess('sb-comparison') && <NavItem href="/sb-comparison" icon={BarChartHorizontalBig} label="Spend Band Comp" isMobile />}
            {hasPageAccess('rate-comparison') && <NavItem href="/rate-comparison" icon={GitCompareArrows} label="Rate Comparison" isMobile />}
            {hasPageAccess('competitor-comparison') && <NavItem href="/competitor-comparison" icon={Scale} label="Best Spend Band" isMobile />}
            {hasPageAccess('multi') && <NavItem href="/multi" icon={Route} label="Multi-Leg Tool" isMobile />}
            {hasPageAccess('leg-discount') && <NavItem href="/leg-discount" icon={ArrowRightLeft} label="Leg Discount" isMobile />}
          </AccordionContent>
        </AccordionItem>
      )}

      {(hasPageAccess('live') || hasPageAccess('routing') || hasPageAccess('find-it')) && (
        <AccordionItem value="operations" className="border-none">
          <AccordionTrigger className="px-4 py-3 hover:no-underline font-bold text-lg text-primary-foreground">
            <div className="flex items-center gap-3"><Orbit className="h-5 w-5" /> Operations</div>
          </AccordionTrigger>
          <AccordionContent className="bg-primary-foreground/5 space-y-1">
            {hasPageAccess('live') && !['agent', 'bdm'].includes(role || '') && <NavItem href="/live" icon={Orbit} label="Live Tracker" isMobile />}
            {hasPageAccess('routing') && <NavItem href="/routing" icon={Route} label="AI Routing" isMobile />}
            {hasPageAccess('find-it') && <NavItem href="/find-it" icon={Compass} label="Find It (QR)" isMobile />}
          </AccordionContent>
        </AccordionItem>
      )}

      <AccordionItem value="knowledge" className="border-none">
        <AccordionTrigger className="px-4 py-3 hover:no-underline font-bold text-lg text-primary-foreground">
          <div className="flex items-center gap-3"><BookOpen className="h-5 w-5" /> Knowledge Base</div>
        </AccordionTrigger>
        <AccordionContent className="bg-primary-foreground/5 space-y-1">
          {hasPageAccess('location-lookup') && <NavItem href="/location-lookup" icon={Warehouse} label="Universal Lookup" isMobile />}
          <NavItem href="/how-to" icon={BookOpen} label="How-To Master Guide" isMobile />
          {hasPageAccess('info') && <NavItem href="/info" icon={Info} label="System Info Hub" isMobile />}
          {hasPageAccess('notebook') && <NavItem href="/notebook" icon={BookOpen} label="My Notebook" isMobile />}
          {hasPageAccess('vip') && <NavItem href="/vip" icon={UserCheck} label="VIP Contacts" isMobile />}
          {hasPageAccess('about-tge') && <NavItem href="/about-tge" icon={Building} label="About TGE" isMobile />}
        </AccordionContent>
      </AccordionItem>

      {user && profile?.companyId && (
        <AccordionItem value="org" className="border-none">
          <AccordionTrigger className="px-4 py-3 hover:no-underline font-bold text-lg text-primary-foreground">
            <div className="flex items-center gap-3"><Building2 className="h-5 w-5" /> Organization</div>
          </AccordionTrigger>
          <AccordionContent className="bg-primary-foreground/5 space-y-1">
            {hasPageAccess('org-account') && <NavItem href="/org/account" icon={CreditCard} label="Billing & Plan" isMobile />}
            {hasPageAccess('register-tge') && <NavItem href="/org/register-tge" icon={ClipboardCheck} label="TGE Registration" isMobile />}
            {hasPageAccess('json-management') && <NavItem href="/org/json" icon={FileJson} label="JSON Database" isMobile />}
            {hasPageAccess('team') && <NavItem href="/admin/team" icon={Users2} label="Team Access" isMobile />}
            {hasPageAccess('branding') && <NavItem href="/settings/branding" icon={Palette} label="Theme & Brand" isMobile />}
            {hasPageAccess('remittance') && <NavItem href="/admin/remittance" icon={Receipt} label="Submit Remittance" isMobile />}
          </AccordionContent>
        </AccordionItem>
      )}

      {actualRole === 'superadmin' && (
        <AccordionItem value="admin" className="border-none">
          <AccordionTrigger className="px-4 py-3 hover:no-underline font-bold text-lg text-primary-foreground">
            <div className="flex items-center gap-3"><Lock className="h-5 w-5" /> Admin Console</div>
          </AccordionTrigger>
          <AccordionContent className="bg-primary-foreground/5 space-y-1">
            {hasPageAccess('settings') && <NavItem href="/settings" icon={Cog} label="System Defaults" isMobile />}
            <NavItem href="/admin/activity" icon={Activity} label="Global Activity" isMobile />
            <NavItem href="/admin/quote-logs" icon={History} label="Quote Log" isMobile />
            <NavItem href="/admin/ai-mode" icon={BrainCircuit} label="AI Trace" isMobile />
            <NavItem href="/admin/ai-analytics" icon={Activity} label="AI Analytics" isMobile />
            <NavItem href="/admin/audit-log" icon={ShieldCheck} label="Audit Trail" isMobile />
            <NavItem href="/admin/surcharges" icon={Fuel} label="Manage Fees" isMobile />
            <NavItem href="/admin/feature-management" icon={ToggleRight} label="Feature Gates" isMobile />
            <NavItem href="/admin/user-management" icon={Users2} label="User Access" isMobile />
            <NavItem href="/admin/roles" icon={Users} label="Permissions" isMobile />
            <NavItem href="/admin/promo-codes" icon={Ticket} label="Discount Codes" isMobile />
            <NavItem href="/admin/update-ras" icon={MapPin} label="Update RAS" isMobile />
            <NavItem href="/price-test" icon={Cog} label="Logic Tester" isMobile />
            <NavItem href="/status" icon={Computer} label="System Health" isMobile />
          </AccordionContent>
        </AccordionItem>
      )}
    </Accordion>
  );

  const assignedCompanies = useMemo(() => {
    if (!profile || !companies) return [];
    const list = companies.filter(c => profile.assignedCompanyIds?.includes(c.id));
    if (profile.companyId && !list.some(c => c.id === profile.companyId)) {
        const current = companies.find(c => c.id === profile.companyId);
        if (current) list.push(current);
    }
    return list;
  }, [profile, companies]);

  if (!isMounted || (loading && !isAuthPage)) {
    return (
      <header className="shadow-md z-50 print-hide">
        <div className="container mx-auto px-4 py-4 flex flex-col items-center gap-4">
          <Skeleton className="h-12 w-48 bg-primary/20" />
          <Skeleton className="h-10 w-full max-w-lg bg-primary/20" />
        </div>
      </header>
    );
  }

  if (!user && !isAuthPage) return null;
  if (isAuthPage) return null;

  return (
    <>
      <header className="shadow-md z-50 print-hide flex flex-col">
        <TopBar />
        <EmailVerificationBanner />
        <div className="bg-primary text-primary-foreground transition-colors" style={{ backgroundColor: company?.settings?.primaryColor || 'hsl(var(--primary))' }}>
          <div className="container mx-auto px-4 py-4 flex flex-col items-center gap-4">
            <div className="flex w-full justify-between items-center">
              <Link href="/">
                <div className="flex items-center gap-3">
                  <Package className="h-8 w-8 text-accent" style={{ color: company?.settings?.accentColor }} />
                  <div className="flex flex-col items-start">
                    <h1 className="text-xl sm:text-2xl font-bold font-headline leading-tight">
                      {company?.name || company?.settings?.logoText || "Just Easy"}
                    </h1>
                    <span className="hidden sm:block text-xs text-primary-foreground/80 font-light">
                      Making it easier to secure new business
                    </span>
                    
                    <div className="flex flex-col sm:flex-row gap-2 mt-1">
                        {isSuperadmin ? (
                            <>
                                <Select value={viewAsRole || 'superadmin'} onValueChange={(value) => setViewAsRole(value as UserRole)}>
                                    <SelectTrigger className="h-6 text-[10px] bg-primary/20 border-primary-foreground/30 text-primary-foreground w-[110px] px-1">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="superadmin">👑 Superadmin</SelectItem>
                                        <SelectItem value="admin">🔧 Admin</SelectItem>
                                        <SelectItem value="bdm">💼 BDM</SelectItem>
                                        <SelectItem value="agent">🎯 Agent</SelectItem>
                                        <SelectItem value="driver">🚚 Driver</SelectItem>
                                        <SelectItem value="user">👤 User</SelectItem>
                                    </SelectContent>
                                </Select>
                                
                                <Select value={viewAsCompanyId || profile?.companyId || ''} onValueChange={setViewAsCompanyId}>
                                    <SelectTrigger className="h-6 text-[10px] bg-primary/20 border-primary-foreground/30 text-primary-foreground w-[130px] px-1">
                                        <SelectValue placeholder="Switch Company" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <DropdownMenuLabel className="text-[10px]">Active Tenants</DropdownMenuLabel>
                                        {(companies ?? []).map(c => (
                                            <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                                        ))}
                                        <DropdownMenuSeparator />
                                        <SelectItem value={null} className="text-xs italic">Reset to Profile</SelectItem>
                                    </SelectContent>
                                </Select>
                            </>
                        ) : (
                            (assignedCompanies.length > 1 || role === 'admin') && (
                                <Select value={profile?.companyId} onValueChange={handleSwitchCompany}>
                                    <SelectTrigger className="h-6 text-[10px] bg-primary/20 border-primary-foreground/30 text-primary-foreground w-[150px] px-1">
                                        <SelectValue placeholder="Switch Workspace" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <DropdownMenuLabel className="text-[10px]">Your Permitted Workspaces</DropdownMenuLabel>
                                        {assignedCompanies.map(c => (
                                            <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )
                        )}
                    </div>
                  </div>
                </div>
              </Link>

              <div className="flex items-center gap-1">
                <div className="hidden md:flex items-center gap-4 mr-2">
                    <ActiveAlarmCountdown />
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-primary-foreground/10 rounded-full border border-primary-foreground/20">
                        <Zap className="h-3 w-3 text-accent fill-accent" />
                        <span className="text-xs font-bold font-mono">{(profile?.tokens ?? 0).toLocaleString()}</span>
                    </div>
                </div>
                
                <div className="hidden md:flex items-center gap-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" className={cn("text-primary-foreground hover:bg-[rgba(var(--hover-color),0.2)] px-2 py-1 h-auto", !!nextAlarm && 'text-blue-400')} onClick={handleOpenAlarmDialog}>
                          <AlarmClock className="h-5 w-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {nextAlarm ? `Next alarm: ${nextAlarm?.message}` : 'Set an alarm'}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" className="text-primary-foreground hover:bg-[rgba(var(--hover-color),0.2)] px-2 py-1 h-auto" onClick={() => setIsLeadDialogOpen(true)}>
                          <UserPlus className="h-5 w-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>New Lead</p></TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" className="text-primary-foreground hover:bg-[rgba(var(--hover-color),0.2)] px-2 py-1 h-auto" onClick={() => setIsProblemDialogOpen(true)}>
                          <ShieldAlert className="h-5 w-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Log a Problem</p></TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <Button variant="ghost" className="text-primary-foreground hover:bg-[rgba(var(--hover-color),0.2)] px-2 py-1 h-auto" onClick={() => setIsApiKeysDialogOpen(true)}>
                    <Key className="h-5 w-5" />
                  </Button>
                  <Button asChild variant="ghost" className="text-primary-foreground hover:bg-[rgba(var(--hover-color),0.2)] px-2 py-1 h-auto">
                    <Link href="/vip"><UserCheck className="h-5 w-5" /></Link>
                  </Button>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="text-primary-foreground hover:bg-[rgba(var(--hover-color),0.2)] px-2 py-1 h-auto">
                      <User className="h-5 w-5 mr-0 md:mr-2" />
                      <span className="hidden sm:inline">{user?.displayName || user?.email}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/profile" className="flex items-center">
                        <UserCircle className="mr-2 h-4 w-4" />
                        <span>My Profile</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setIsHeaderConfigOpen(true)}>
                      <Palette className="mr-2 h-4 w-4" />
                      <span>Customize Header</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setIsApiKeysDialogOpen(true)}>
                      <Key className="mr-2 h-4 w-4" />
                      <span>Manage Overrides</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleLogout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Log out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="flex md:hidden">
                  <Sheet
                    open={isMobileMenuOpen}
                    onOpenChange={setIsMobileMenuOpen}
                  >
                    <SheetTrigger asChild>
                      <Button
                        variant="ghost"
                        className="text-primary-foreground hover:bg-[rgba(var(--hover-color),0.2)] px-2 py-1 h-auto"
                      >
                        <MenuIcon className="h-6 w-6" />
                        <span className="sr-only">Open menu</span>
                      </Button>
                    </SheetTrigger>
                    <SheetContent
                      side="right"
                      className="w-[300px] p-0 bg-primary text-primary-foreground flex flex-col border-l-primary-foreground/20"
                    >
                      <SheetHeader className="p-6 text-left border-b border-primary-foreground/20 bg-primary/10">
                        <div className="flex items-center gap-3">
                          <Package className="h-6 w-6 text-accent" />
                          <SheetTitle className="text-xl font-headline text-primary-foreground">
                            Navigation
                          </SheetTitle>
                        </div>
                      </SheetHeader>
                      <ScrollArea className="flex-grow">
                        <div className="p-2">
                          {mobileNav}
                        </div>
                      </ScrollArea>
                      <div className="p-4 border-t border-primary-foreground/20 bg-primary/10 flex items-center justify-between">
                        <div className="flex flex-col">
                          <p className="text-[10px] text-primary-foreground/60 uppercase font-bold tracking-widest">Signed in as</p>
                          <p className="text-xs font-medium truncate max-w-[180px]">{user?.email}</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={handleLogout} className="text-primary-foreground/80 hover:bg-destructive/20 hover:text-white">
                          <LogOut className="h-5 w-5" />
                        </Button>
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>
              </div>
            </div>

            <div className="w-full mt-2 md:mt-0 flex justify-center">
              <GlobalSearch role={role} company={company} isSuperadmin={isSuperadmin} />
            </div>

            <div className="w-full flex md:hidden items-center justify-center gap-4 mt-2">
              <ActiveAlarmCountdown />
              <div className="flex items-center gap-1 text-[10px] font-black font-mono">
                  <Zap className="h-3 w-3 text-accent fill-accent" />
                  <span>{(profile?.tokens ?? 0).toLocaleString()}</span>
              </div>
              <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-primary-foreground h-8 w-8 hover:bg-[rgba(var(--hover-color),0.2)]" onClick={() => setIsLeadDialogOpen(true)}>
                        <UserPlus className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>New Lead</p></TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-primary-foreground h-8 w-8 hover:bg-[rgba(var(--hover-color),0.2)]" onClick={handleOpenAlarmDialog}>
                        <AlarmClock className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Set Alarm</p></TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-primary-foreground h-8 w-8 hover:bg-[rgba(var(--hover-color),0.2)]" onClick={() => setIsProblemDialogOpen(true)}>
                        <ShieldAlert className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Log Problem</p></TooltipContent>
                  </Tooltip>
              </TooltipProvider>
            </div>

            <div className="w-full hidden md:flex items-center justify-center">
              {desktopNav}
            </div>
          </div>
        </div>
      </header>
      <ApiKeysDialog isOpen={isApiKeysDialogOpen} onOpenChange={setIsApiKeysDialogOpen} />
      <HeaderConfigDialog isOpen={isHeaderConfigOpen} onOpenChange={setIsHeaderConfigOpen} />
      <NewProblemDialog isOpen={isProblemDialogOpen} onOpenChange={setIsProblemDialogOpen} />
      <NewLeadDialog isOpen={isLeadDialogOpen} onOpenChange={setIsLeadDialogOpen} />

      <Dialog open={isAlarmDialogOpen} onOpenChange={setIsAlarmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set & Manage Alarms</DialogTitle>
            <DialogDescription>Set a time and message for your reminders.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {alarms.length > 0 && (
              <div className="space-y-2">
                <Label>Active Alarms</Label>
                <div className="max-h-32 overflow-y-auto space-y-1 border rounded-md p-2">
                  {alarms.map((alarm) => (
                    <div key={alarm.id} className="flex items-center justify-between text-sm p-1 bg-muted/50 rounded-md">
                      <span>{alarm.message} - {new Date(alarm.time).toLocaleTimeString()} ({alarm.recurrence !== 'none' ? alarm.recurrence : 'once'})</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeAlarm(alarm.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="alarm-message">New Alarm Message</Label>
              <Input id="alarm-message" value={alarmMessage} onChange={(e) => setAlarmMessage(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="alarm-time">Time</Label>
              <Input id="alarm-time" type="time" value={alarmTime} onChange={(e) => setAlarmTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Recurrence</Label>
              <Select value={recurrence} onValueChange={(value) => setRecurrence(value as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (One-time)</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {recurrence === 'weekly' && (
              <div className="space-y-2">
                <Label>Days of the Week</Label>
                <div className="flex wrap gap-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                    <div key={day} className="flex items-center gap-1">
                      <Checkbox id={`day-${day}`} checked={recurrenceDays.includes(index)} onCheckedChange={() => handleRecurrenceDayChange(index)} />
                      <Label htmlFor={`day-${day}`} className="text-xs font-normal">{day}</Label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter><Button onClick={handleSetAlarm}>Set New Alarm</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!firingAlarm} onOpenChange={(open) => !open && setFiringAlarm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
              <AlarmClock className="h-6 w-6 mr-2 text-red-500 animate-pulse" /> Reminder!
            </AlertDialogTitle>
            <AlertDialogDescription className="text-lg text-foreground pt-4">{firingAlarm?.message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <div className="flex flex-col gap-2 w-full">
              <div className="flex wrap gap-2 justify-center">
                {[3, 5, 10, 15, 30, 60].map(m => (
                  <Button key={m} size="sm" variant="secondary" onClick={() => { snoozeAlarm(firingAlarm!.id, m); setFiringAlarm(null); }}>Snooze {m < 60 ? `${m}m` : '1hr'}</Button>
                ))}
              </div>
              <Separator />
              <div className="flex justify-between w-full">
                {firingAlarm?.recurrence === 'none' && (
                  <Button variant="outline" onClick={() => { rebookAlarm(firingAlarm!.id); setFiringAlarm(null); }}>Rebook Next Working Day</Button>
                )}
                <div className="flex-grow" />
                <AlertDialogAction onClick={() => setFiringAlarm(null)}>Dismiss</AlertDialogAction>
              </div>
            </div>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

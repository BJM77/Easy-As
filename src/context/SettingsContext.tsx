"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { ServiceName, SurchargeDefinition, ActiveSurchargeSetting, SurchargeConfigGroupKey, StateAbbreviation, QuickActionKey, UserRole, ServicePermissions, PageKey, PagePermissions, ExternalLink, ServiceSettings } from '@/lib/types';
import { ALL_SERVICES, ALL_STATES, NON_PALLET_SERVICES, PALLET_SERVICES, LCP_SERVICES, STANDARD_ROAD_MAPPED_SERVICES, PRIORITY_MAPPED_SERVICES, STANDARD_PALLET_MAPPED_SERVICES, PALLET_LIKE_SERVICES, ALL_USER_ROLES, SECURITY_APPLICABLE_SERVICES, ALL_PAGES, ALL_TIMEZONES, DEFAULT_SERVICE_PERMISSIONS } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth, useFirestore } from '@/firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

const SURCHARGE_CONFIG_GROUPS: Record<SurchargeConfigGroupKey, { name: string, services: ServiceName[] }> = {
  STANDARD_ROAD: { name: 'Standard Road Services', services: STANDARD_ROAD_MAPPED_SERVICES },
  PRIORITY_MIXED: { name: 'Priority & B2C Services', services: PRIORITY_MAPPED_SERVICES },
  PALLET_SERVICES: { name: 'Pallet Services', services: STANDARD_PALLET_MAPPED_SERVICES },
};

const PREDEFINED_SURCHARGES_INITIAL: SurchargeDefinition[] = [
  { id: 'security', name: 'Security Surcharge', type: 'percentage', defaultValue: 8.49, isConfigurablePerService: false, isPredefined: true, applicableServices: SECURITY_APPLICABLE_SERVICES },
  { id: 'oversize_item_fee', name: 'Oversize Fee (Length > 180cm per item)', type: 'fixed_per_shipment', defaultValue: 63.00, isConfigurablePerService: true, isPredefined: true, applicableServices: NON_PALLET_SERVICES },
  { id: 'manual_handling_gt30kg', name: 'Manual Handling Fee (>30kg & <35kg per item)', type: 'fixed_per_shipment', defaultValue: 16.50, isConfigurablePerService: true, isPredefined: true, applicableServices: NON_PALLET_SERVICES },
  { id: 'manual_handling_gt35kg', name: 'Oversize Fee (>=35kg per item)', type: 'fixed_per_shipment', defaultValue: 63.50, isConfigurablePerService: true, isPredefined: true, applicableServices: NON_PALLET_SERVICES },
  { id: 'book_in_delivery_fee', name: 'Book-In Delivery', type: 'fixed_per_shipment', defaultValue: 25.00, isConfigurablePerService: true, isPredefined: true, applicableServices: ALL_SERVICES },
  { id: 'dg_consignment_fee', name: 'Dangerous Goods', type: 'fixed_per_shipment', defaultValue: 45.00, isConfigurablePerService: true, isPredefined: true, applicableServices: ALL_SERVICES },
  { id: 'hand_unload_fee', name: 'Hand Unload', type: 'fixed_per_shipment', defaultValue: 50.00, isConfigurablePerService: true, isPredefined: true, applicableServices: ALL_SERVICES },
  { id: 'tail_lift_road_prio', name: 'Tail Lift (Road/Prio)', type: 'fixed_per_shipment', defaultValue: 85.00, isConfigurablePerService: true, isPredefined: true, applicableServices: NON_PALLET_SERVICES },
  { id: 'tail_lift_pallet', name: 'Tail Lift (Pallet)', type: 'fixed_per_shipment', defaultValue: 120.00, isConfigurablePerService: true, isPredefined: true, applicableServices: PALLET_LIKE_SERVICES },
  { id: 'after_hours_collection_fee', name: 'After Hours Collection', type: 'fixed_per_shipment', defaultValue: 150.00, isConfigurablePerService: true, isPredefined: true, applicableServices: ALL_SERVICES },
  { id: 'after_hours_delivery_fee', name: 'After Hours Delivery', type: 'fixed_per_shipment', defaultValue: 150.00, isConfigurablePerService: true, isPredefined: true, applicableServices: ALL_SERVICES },
  { id: 'public_holiday_service_fee', name: 'Public Holiday Service', type: 'fixed_per_shipment', defaultValue: 250.00, isConfigurablePerService: true, isPredefined: true, applicableServices: ALL_SERVICES },
  { id: 'account_transfer_fee', name: 'Account Transfer', type: 'fixed_per_shipment', defaultValue: 15.00, isConfigurablePerService: true, isPredefined: true, applicableServices: ALL_SERVICES },
  { id: 'ex_wa_pickup_consignment_fee', name: 'Ex WA Pickup Consignment', type: 'fixed_per_shipment', defaultValue: 25.00, isConfigurablePerService: true, isPredefined: true, applicableServices: PALLET_SERVICES },
  { id: 'ex_wa_pickup_kg_rate_tier1', name: 'Ex WA Pickup Kg (0-1000)', type: 'fixed_per_kg', defaultValue: 0.15, isConfigurablePerService: true, isPredefined: true, applicableServices: PALLET_SERVICES },
  { id: 'ex_wa_pickup_kg_rate_tier2', name: 'Ex WA Pickup Kg (1001-3000)', type: 'fixed_per_kg', defaultValue: 0.12, isConfigurablePerService: true, isPredefined: true, applicableServices: PALLET_SERVICES },
  { id: 'ex_wa_pickup_kg_rate_tier3', name: 'Ex WA Pickup Kg (3001-8000)', type: 'fixed_per_kg', defaultValue: 0.10, isConfigurablePerService: true, isPredefined: true, applicableServices: PALLET_SERVICES },
  { id: 'ex_wa_pickup_kg_rate_tier4', name: 'Ex WA Pickup Kg (8001+)', type: 'fixed_per_kg', defaultValue: 0.08, isConfigurablePerService: true, isPredefined: true, applicableServices: PALLET_SERVICES },
];

const DEFAULT_EMAIL_QUOTE_TEMPLATE = `Dear {{contactName}},\n\nThank you for your freight quote request.\n\nHere are the details for the {{serviceName}} service:\nOrigin: {{origin}}\nDestination: {{destination}}\nEstimated Total: {{estimatedTotal}}\n\nItems:\n{{itemsSummary}}\n\nThis quote is valid as of {{date}}.`;

export const DEFAULT_PAGE_PERMISSIONS: PagePermissions = {
    superadmin: ALL_PAGES,
    admin: ALL_PAGES.filter(p => !['admin-menu', 'user-management'].includes(p)),
    bdm: ['calculator', 'ai-guru', 'proposal', 'location-lookup', 'info', 'problem-log', 'leads', 'vip', 'profile'],
    driver: ['live', 'find-it', 'location-lookup', 'profile'],
    agent: ['calculator', 'location-lookup', 'info', 'problem-log', 'leads', 'profile'],
    user: ['calculator', 'location-lookup', 'info', 'profile'],
    null: [],
};

const DEFAULT_EXTERNAL_LINKS: ExternalLink[] = [
  { id: 'link-1', label: 'LCP SharePoint', url: 'https://teamglobalexp.sharepoint.com/sites/LCPProgramme', icon: 'Briefcase' },
  { id: 'link-2', label: 'Salesforce', url: 'https://teamglobalexp.lightning.force.com', icon: 'Cloud' },
];

interface SettingsContextType {
  serviceSettings: ServiceSettings[];
  surchargeDefinitions: SurchargeDefinition[];
  standardFuelSurcharge: number;
  priorityFuelSurcharge: number;
  palletFuelSurcharge: number;
  standardFuelLastUpdated: string | null;
  globalSecuritySurchargePercent: number;
  setGlobalSecuritySurchargePercent: (percentage: number) => void;
  addSurchargeDefinition: (newDefinition: SurchargeDefinition) => boolean;
  updateGroupFuelSurcharge: (groupType: 'standard' | 'priority' | 'pallet', percentage: number, lastUpdated: string) => void;
  updateServiceSurcharge: (serviceName: ServiceName, surchargeId: string, value: number, enabled: boolean) => void;
  updateGroupOtherSurcharge: (groupKey: SurchargeConfigGroupKey, surchargeId: string, value: number, enabled: boolean) => void;
  getServiceConfig: (serviceName: ServiceName) => ServiceSettings | undefined;
  globalSpendBands: string[];
  surchargeConfigGroups: typeof SURCHARGE_CONFIG_GROUPS;
  emailQuoteTemplate: string;
  setEmailQuoteTemplate: (template: string) => void;
  perfectPlanPalletRate: number;
  setPerfectPlanPalletRate: (rate: number) => void;
  perfectPlanParcelRate: number;
  setPerfectPlanParcelRate: (rate: number) => void;
  perfectPlanSatchelRate: number;
  setPerfectPlanSatchelRate: (rate: number) => void;
  stateEmailContacts: Record<StateAbbreviation, (string | undefined)[]>;
  setStateEmailContact: (state: StateAbbreviation, index: number, email: string) => void;
  quickActions: QuickActionKey[];
  setQuickActions: (actions: QuickActionKey[]) => void;
  servicePermissions: ServicePermissions;
  setServicePermissionsForRole: (role: UserRole, services: ServiceName[]) => void;
  pagePermissions: PagePermissions;
  setPagePermissionsForRole: (role: UserRole, pages: PageKey[]) => void;
  isLoadingSettings: boolean;
  saveSettingsToServer: (password: string) => Promise<boolean>;
  showLcpRates: boolean; 
  setShowLcpRates: (show: boolean) => void;
  isAccountManagerMode: boolean;
  setIsAccountManagerMode: (enabled: boolean) => void;
  externalLinks: ExternalLink[];
  setExternalLinks: (links: ExternalLink[]) => void;
  timezones: Record<string, { label: string; tz: string; time: string }>;
  visibleTimezones: Record<string, boolean>;
  setVisibleTimezones: (visible: Record<string, boolean>) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const { toast } = useToast();
  const { user, actualRole } = useAuth();
  const firestore = useFirestore();
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  // --- Core States ---
  const [standardFuelSurcharge, setStandardFuelSurcharge] = useState(39.74);
  const [priorityFuelSurcharge, setPriorityFuelSurcharge] = useState(28.58);
  const [palletFuelSurcharge, setPalletFuelSurcharge] = useState(56.97);
  const [standardFuelLastUpdated, setStandardFuelLastUpdated] = useState<string | null>(null);
  const [globalSecuritySurchargePercent, setGlobalSecuritySurchargePercent] = useState(8.49);
  const [emailQuoteTemplate, setEmailQuoteTemplate] = useState(DEFAULT_EMAIL_QUOTE_TEMPLATE);
  const [perfectPlanPalletRate, setPerfectPlanPalletRate] = useState(200);
  const [perfectPlanParcelRate, setPerfectPlanParcelRate] = useState(20);
  const [perfectPlanSatchelRate, setPerfectPlanSatchelRate] = useState(12);
  const [stateEmailContacts, setStateEmailContacts] = useState<any>({});
  const [quickActions, setQuickActions] = useState<QuickActionKey[]>(['calculator', 'ai-guru', 'problem-log', 'location-lookup']);
  const [servicePermissions, setServicePermissions] = useState<ServicePermissions>(DEFAULT_SERVICE_PERMISSIONS);
  const [pagePermissions, setPagePermissions] = useState<PagePermissions>(DEFAULT_PAGE_PERMISSIONS);
  const [externalLinks, setExternalLinks] = useState<ExternalLink[]>(DEFAULT_EXTERNAL_LINKS);
  const [visibleTimezones, setVisibleTimezones] = useState<Record<string, boolean>>({ perth: true, melbourne: true, brisbane: true });
  const [showLcpRates, setShowLcpRates] = useState(true);
  const [isAccountManagerMode, setIsAccountManagerMode] = useState(false);
  const [surchargeDefinitions, setSurchargeDefinitions] = useState<SurchargeDefinition[]>(PREDEFINED_SURCHARGES_INITIAL);

  // Derived Service Settings
  const serviceSettings = useMemo(() => {
    return ALL_SERVICES.map(service => {
      let fuel = standardFuelSurcharge;
      if (service.includes('Priority') || service.includes('GO')) fuel = priorityFuelSurcharge;
      else if (service.includes('Pallets')) fuel = palletFuelSurcharge;

      return {
        id: service,
        name: service,
        fuelSurchargePercent: fuel,
        surcharges: surchargeDefinitions.filter(s => s.applicableServices.includes(service)).map(s => ({
          surchargeId: s.id,
          value: s.defaultValue,
          enabled: true
        }))
      };
    });
  }, [standardFuelSurcharge, priorityFuelSurcharge, palletFuelSurcharge, surchargeDefinitions]);

  // --- Persistence ---
  useEffect(() => {
    // Load local overrides first for instant response
    const localTZ = localStorage.getItem('header_visible_timezones');
    const localLinks = localStorage.getItem('header_external_links');
    if (localTZ) {
      try { setVisibleTimezones(JSON.parse(localTZ)); } catch(e) {}
    }
    if (localLinks) {
      try { setExternalLinks(JSON.parse(localLinks)); } catch(e) {}
    }

    if (!firestore) return;
    const settingsRef = doc(firestore, 'settings', 'global');
    const unsubscribe = onSnapshot(settingsRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.standardFuelSurcharge) setStandardFuelSurcharge(data.standardFuelSurcharge);
        if (data.priorityFuelSurcharge) setPriorityFuelSurcharge(data.priorityFuelSurcharge);
        if (data.palletFuelSurcharge) setPalletFuelSurcharge(data.palletFuelSurcharge);
        if (data.standardFuelLastUpdated) setStandardFuelLastUpdated(data.standardFuelLastUpdated);
        if (data.globalSecuritySurchargePercent) setGlobalSecuritySurchargePercent(data.globalSecuritySurchargePercent);
        if (data.servicePermissions) setServicePermissions(data.servicePermissions);
        if (data.pagePermissions) setPagePermissions(data.pagePermissions);
        if (data.externalLinks) setExternalLinks(data.externalLinks);
        if (data.visibleTimezones) setVisibleTimezones(data.visibleTimezones);
      }
      setIsLoadingSettings(false);
    });
    return () => unsubscribe();
  }, [firestore]);

  const saveSettingsToServer = async (password: string) => {
    if (password !== 'LCPTGE') {
      toast({ title: "Invalid Password", variant: "destructive" });
      return false;
    }
    if (!firestore) return false;
    try {
      await setDoc(doc(firestore, 'settings', 'global'), {
        standardFuelSurcharge,
        priorityFuelSurcharge,
        palletFuelSurcharge,
        standardFuelLastUpdated,
        globalSecuritySurchargePercent,
        servicePermissions,
        pagePermissions,
        externalLinks,
        visibleTimezones,
        emailQuoteTemplate,
        perfectPlanPalletRate,
        perfectPlanParcelRate,
        perfectPlanSatchelRate,
        stateEmailContacts,
        quickActions,
        showLcpRates,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.email || 'unknown'
      }, { merge: true });
      toast({ title: "Settings Persistent", description: "Global configuration updated on server." });
      return true;
    } catch (e: any) {
      toast({ title: "Save Failed", description: e.message, variant: "destructive" });
      return false;
    }
  };

  // --- Handlers ---
  const updateGroupFuelSurcharge = (type: 'standard' | 'priority' | 'pallet', val: number, date: string) => {
    if (type === 'standard') setStandardFuelSurcharge(val);
    if (type === 'priority') setPriorityFuelSurcharge(val);
    if (type === 'pallet') setPalletFuelSurcharge(val);
    setStandardFuelLastUpdated(date);
  };

  const setServicePermissionsForRole = (role: UserRole, services: ServiceName[]) => {
    setServicePermissions(prev => ({ ...prev, [role || 'null']: services }));
  };

  const setPagePermissionsForRole = (role: UserRole, pages: PageKey[]) => {
    setPagePermissions(prev => ({ ...prev, [role || 'null']: pages }));
  };

  const setVisibleTimezonesWithLocal = (visible: Record<string, boolean>) => {
    setVisibleTimezones(visible);
    localStorage.setItem('header_visible_timezones', JSON.stringify(visible));
  };

  const setExternalLinksWithLocal = (links: ExternalLink[]) => {
    setExternalLinks(links);
    localStorage.setItem('header_external_links', JSON.stringify(links));
  };

  const timezones = useMemo(() => {
    const zones: any = {};
    Object.entries(ALL_TIMEZONES).forEach(([id, info]) => {
      zones[id] = { ...info, time: new Intl.DateTimeFormat('en-AU', { timeZone: info.tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()) };
    });
    return zones;
  }, []);

  const value = {
    serviceSettings, surchargeDefinitions, standardFuelSurcharge, priorityFuelSurcharge, palletFuelSurcharge, standardFuelLastUpdated,
    globalSecuritySurchargePercent, setGlobalSecuritySurchargePercent, addSurchargeDefinition: (d: any) => { setSurchargeDefinitions(p => [...p, d]); return true; },
    updateGroupFuelSurcharge, updateServiceSurcharge: () => {}, updateGroupOtherSurcharge: () => {},
    getServiceConfig: (n: ServiceName) => serviceSettings.find(s => s.id === n),
    globalSpendBands: ["1", "2", "3", "4", "5", "6"], surchargeConfigGroups: SURCHARGE_CONFIG_GROUPS,
    emailQuoteTemplate, setEmailQuoteTemplate, perfectPlanPalletRate, setPerfectPlanPalletRate, perfectPlanParcelRate, setPerfectPlanParcelRate, perfectPlanSatchelRate, setPerfectPlanSatchelRate,
    stateEmailContacts, setStateEmailContact: (s: any, i: any, e: any) => setStateEmailContacts((p: any) => ({ ...p, [s]: Object.assign([], p[s], { [i]: e }) })),
    quickActions, setQuickActions, servicePermissions, setServicePermissionsForRole, pagePermissions, setPagePermissionsForRole,
    isLoadingSettings, saveSettingsToServer, showLcpRates, setShowLcpRates, isAccountManagerMode, setIsAccountManagerMode,
    externalLinks, setExternalLinks: setExternalLinksWithLocal, timezones, visibleTimezones, setVisibleTimezones: setVisibleTimezonesWithLocal
  };

  return <SettingsContext.Provider value={value as any}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) throw new Error('useSettings must be used within SettingsProvider');
  return context;
};
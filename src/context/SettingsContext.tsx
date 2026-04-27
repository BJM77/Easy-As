"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ServiceName, SurchargeDefinition, ActiveSurchargeSetting, SurchargeConfigGroupKey, StateAbbreviation, QuickActionKey, UserRole, ServicePermissions, PageKey, PagePermissions, ExternalLink, ServiceSettings } from '@/lib/types';
import { ALL_SERVICES, ALL_STATES, NON_PALLET_SERVICES, PALLET_SERVICES, LCP_SERVICES, STANDARD_ROAD_MAPPED_SERVICES, PRIORITY_MAPPED_SERVICES, STANDARD_PALLET_MAPPED_SERVICES, PALLET_LIKE_SERVICES, ALL_USER_ROLES, SECURITY_APPLICABLE_SERVICES, ALL_PAGES, ALL_TIMEZONES, DEFAULT_SERVICE_PERMISSIONS } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/firebase';

const SURCHARGE_CONFIG_GROUPS: Record<SurchargeConfigGroupKey, { name: string, services: ServiceName[] }> = {
  STANDARD_ROAD: { name: 'Standard Road Services', services: STANDARD_ROAD_MAPPED_SERVICES },
  PRIORITY_MIXED: { name: 'Priority & B2C Services', services: PRIORITY_MAPPED_SERVICES },
  PALLET_SERVICES: { name: 'Pallet Services', services: STANDARD_PALLET_MAPPED_SERVICES },
};

const PREDEFINED_SURCHARGES_INITIAL: SurchargeDefinition[] = [
  { id: 'security', name: 'Security Surcharge', type: 'percentage', defaultValue: 8.2, isConfigurablePerService: false, isPredefined: true, applicableServices: SECURITY_APPLICABLE_SERVICES },
  { id: 'oversize_item_fee', name: 'Oversize Fee (Length > 180cm per item)', type: 'fixed_per_shipment', defaultValue: 63.00, isConfigurablePerService: true, isPredefined: true, applicableServices: NON_PALLET_SERVICES },
  { id: 'manual_handling_gt30kg', name: 'Manual Handling Fee (>30kg & <35kg per item)', type: 'fixed_per_shipment', defaultValue: 16.50, isConfigurablePerService: true, isPredefined: true, applicableServices: NON_PALLET_SERVICES },
  { id: 'manual_handling_gt35kg', name: 'Oversize Fee (>=35kg per item)', type: 'fixed_per_shipment', defaultValue: 63.50, isConfigurablePerService: true, isPredefined: true, applicableServices: NON_PALLET_SERVICES },
  
  // Additional Requirements Mapping
  { id: 'book_in_delivery_fee', name: 'Book-In Delivery', type: 'fixed_per_shipment', defaultValue: 25.00, isConfigurablePerService: true, isPredefined: true, applicableServices: ALL_SERVICES },
  { id: 'dg_consignment_fee', name: 'Dangerous Goods', type: 'fixed_per_shipment', defaultValue: 45.00, isConfigurablePerService: true, isPredefined: true, applicableServices: ALL_SERVICES },
  { id: 'hand_unload_fee', name: 'Hand Unload', type: 'fixed_per_shipment', defaultValue: 50.00, isConfigurablePerService: true, isPredefined: true, applicableServices: ALL_SERVICES },
  { id: 'tail_lift_road_prio', name: 'Tail Lift (Road/Prio)', type: 'fixed_per_shipment', defaultValue: 85.00, isConfigurablePerService: true, isPredefined: true, applicableServices: NON_PALLET_SERVICES },
  { id: 'tail_lift_pallet', name: 'Tail Lift (Pallet)', type: 'fixed_per_shipment', defaultValue: 120.00, isConfigurablePerService: true, isPredefined: true, applicableServices: PALLET_LIKE_SERVICES },
  { id: 'after_hours_collection_fee', name: 'After Hours Collection', type: 'fixed_per_shipment', defaultValue: 150.00, isConfigurablePerService: true, isPredefined: true, applicableServices: ALL_SERVICES },
  { id: 'after_hours_delivery_fee', name: 'After Hours Delivery', type: 'fixed_per_shipment', defaultValue: 150.00, isConfigurablePerService: true, isPredefined: true, applicableServices: ALL_SERVICES },
  { id: 'public_holiday_service_fee', name: 'Public Holiday Service', type: 'fixed_per_shipment', defaultValue: 250.00, isConfigurablePerService: true, isPredefined: true, applicableServices: ALL_SERVICES },
  { id: 'account_transfer_fee', name: 'Account Transfer', type: 'fixed_per_shipment', defaultValue: 15.00, isConfigurablePerService: true, isPredefined: true, applicableServices: ALL_SERVICES },
  
  // WA Pallet specific
  { id: 'ex_wa_pickup_consignment_fee', name: 'Ex WA Pickup Consignment', type: 'fixed_per_shipment', defaultValue: 25.00, isConfigurablePerService: true, isPredefined: true, applicableServices: PALLET_SERVICES },
  { id: 'ex_wa_pickup_kg_rate_tier1', name: 'Ex WA Pickup Kg (0-1000)', type: 'fixed_per_kg', defaultValue: 0.15, isConfigurablePerService: true, isPredefined: true, applicableServices: PALLET_SERVICES },
  { id: 'ex_wa_pickup_kg_rate_tier2', name: 'Ex WA Pickup Kg (1001-3000)', type: 'fixed_per_kg', defaultValue: 0.12, isConfigurablePerService: true, isPredefined: true, applicableServices: PALLET_SERVICES },
  { id: 'ex_wa_pickup_kg_rate_tier3', name: 'Ex WA Pickup Kg (3001-8000)', type: 'fixed_per_kg', defaultValue: 0.10, isConfigurablePerService: true, isPredefined: true, applicableServices: PALLET_SERVICES },
  { id: 'ex_wa_pickup_kg_rate_tier4', name: 'Ex WA Pickup Kg (8001+)', type: 'fixed_per_kg', defaultValue: 0.08, isConfigurablePerService: true, isPredefined: true, applicableServices: PALLET_SERVICES },
];

const DEFAULT_EMAIL_QUOTE_TEMPLATE = `Dear {{contactName}},

Thank you for your freight quote request.

Here are the details for the {{serviceName}} service:
Origin: {{origin}}
Destination: {{destination}}
Estimated Total: {{estimatedTotal}}

Items:
{{itemsSummary}}

This quote is valid as of {{date}}.`;

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

interface TimezoneInfo { label: string; tz: string; time: string; }

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
  saveSettingsToServer: (password: string, overrides?: any) => Promise<boolean>;
  showLcpRates: boolean; 
  setShowLcpRates: (show: boolean) => void;
  isAccountManagerMode: boolean;
  setIsAccountManagerMode: (enabled: boolean) => void;
  externalLinks: ExternalLink[];
  setExternalLinks: (links: ExternalLink[]) => void;
  timezones: Record<string, TimezoneInfo>;
  visibleTimezones: Record<string, boolean>;
  setVisibleTimezones: (visible: Record<string, boolean>) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const { toast } = useToast();
  const { user, loading: isAuthLoading } = useAuth();
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [serviceSettings, setServiceSettings] = useState<ServiceSettings[]>(ALL_SERVICES.map(service => ({
    id: service,
    name: service,
    fuelSurchargePercent: service.includes('Priority') || service.includes('GO') ? 28.01 : (service.includes('Pallets') ? 56.97 : 39.74),
    surcharges: PREDEFINED_SURCHARGES_INITIAL.filter(s => s.applicableServices.includes(service)).map(s => ({
      surchargeId: s.id,
      value: s.defaultValue,
      enabled: true
    }))
  })));
  const [surchargeDefinitions, setSurchargeDefinitions] = useState<SurchargeDefinition[]>(PREDEFINED_SURCHARGES_INITIAL);
  const [standardFuelSurcharge, setStandardFuelSurcharge] = useState(39.74);
  const [priorityFuelSurcharge, setPriorityFuelSurcharge] = useState(28.01);
  const [palletFuelSurcharge, setPalletFuelSurcharge] = useState(56.97);
  const [standardFuelLastUpdated, setStandardFuelLastUpdated] = useState<string | null>(null);
  const [globalSecuritySurchargePercent, setGlobalSecuritySurchargePercent] = useState(8.20);
  const [emailQuoteTemplate, setEmailQuoteTemplate] = useState(DEFAULT_EMAIL_QUOTE_TEMPLATE);
  const [perfectPlanPalletRate, setPerfectPlanPalletRate] = useState(200);
  const [perfectPlanParcelRate, setPerfectPlanParcelRate] = useState(20);
  const [perfectPlanSatchelRate, setPerfectPlanSatchelRate] = useState(12);
  const [stateEmailContacts, setStateEmailContacts] = useState<any>({});
  const [quickActions, setQuickActions] = useState<QuickActionKey[]>(['calculator', 'ai-guru', 'problem-log', 'location-lookup']);
  const [servicePermissions, setServicePermissions] = useState<ServicePermissions>(DEFAULT_SERVICE_PERMISSIONS);
  const [pagePermissions, setPagePermissions] = useState<PagePermissions>(DEFAULT_PAGE_PERMISSIONS);
  const [externalLinks, setExternalLinks] = useState<ExternalLink[]>(DEFAULT_EXTERNAL_LINKS);
  const [visibleTimezones, setVisibleTimezones] = useState<Record<string, boolean>>({});
  const [timezones, setTimezones] = useState<Record<string, TimezoneInfo>>({});
  const [showLcpRates, setShowLcpRates] = useState(true);
  const [isAccountManagerMode, setIsAccountManagerMode] = useState(false);

  const globalSpendBands = ["1", "2", "3", "4", "5", "6"];

  useEffect(() => {
    setIsLoadingSettings(false);
  }, []);

  const saveSettingsToServer = useCallback(async (password: string) => {
    if (password !== 'LCPTGE') {
        toast({ title: 'Invalid Password', variant: 'destructive' });
        return false;
    }
    toast({ title: 'Settings saved locally for session.' });
    return true;
  }, [toast]);

  const addSurchargeDefinition = (def: SurchargeDefinition) => {
    setSurchargeDefinitions(prev => [...prev, def]);
    return true;
  };

  const updateServiceSurcharge = (serviceName: ServiceName, surchargeId: string, value: number, enabled: boolean) => {
    setServiceSettings(prev => prev.map(service => {
      if (service.id !== serviceName) return service;
      const existing = service.surcharges.find(s => s.surchargeId === surchargeId);
      if (existing) {
        return {
          ...service,
          surcharges: service.surcharges.map(s => s.surchargeId === surchargeId ? { ...s, value, enabled } : s)
        };
      }
      return {
        ...service,
        surcharges: [...service.surcharges, { surchargeId, value, enabled }]
      };
    }));
  };

  const updateGroupOtherSurcharge = (groupKey: SurchargeConfigGroupKey, surchargeId: string, value: number, enabled: boolean) => {
    const group = SURCHARGE_CONFIG_GROUPS[groupKey];
    if (!group) return;
    group.services.forEach(serviceName => {
      updateServiceSurcharge(serviceName, surchargeId, value, enabled);
    });
  };

  const updateGroupFuelSurcharge = (type: any, val: number, date: string) => {
    if (type === 'standard') setStandardFuelSurcharge(val);
    if (type === 'priority') setPriorityFuelSurcharge(val);
    if (type === 'pallet') setPalletFuelSurcharge(val);
    setStandardFuelLastUpdated(date);
  };

  const value = {
    serviceSettings, surchargeDefinitions, standardFuelSurcharge, priorityFuelSurcharge, palletFuelSurcharge, standardFuelLastUpdated, priorityFuelLastUpdated: null, palletFuelLastUpdated: null,
    globalSecuritySurchargePercent, setGlobalSecuritySurchargePercent, addSurchargeDefinition, updateGroupFuelSurcharge,
    updateServiceSurcharge, updateGroupOtherSurcharge, getServiceConfig: (n: ServiceName) => serviceSettings.find(s => s.id === n),
    globalSpendBands, surchargeConfigGroups: SURCHARGE_CONFIG_GROUPS, emailQuoteTemplate, setEmailQuoteTemplate,
    perfectPlanPalletRate, setPerfectPlanPalletRate, perfectPlanParcelRate, setPerfectPlanParcelRate, perfectPlanSatchelRate, setPerfectPlanSatchelRate,
    stateEmailContacts, setStateEmailContact: () => {}, quickActions, setQuickActions,
    servicePermissions, setServicePermissionsForRole: () => {}, pagePermissions, setPagePermissionsForRole: () => {},
    isLoadingSettings, saveSettingsToServer, showLcpRates, setShowLcpRates, isAccountManagerMode, setIsAccountManagerMode,
    externalLinks, setExternalLinks, timezones, visibleTimezones, setVisibleTimezones
  };

  return <SettingsContext.Provider value={value as any}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) throw new Error('useSettings must be used within SettingsProvider');
  return context;
};
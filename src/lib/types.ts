import { z } from 'zod';

export interface PostcodeData {
  suburb: string;
  state: string;
  postcode: number;
  prio: string; 
  ipec: string;  
  pallet: string; 
  lat?: number; 
  lng?: number; 
}

export interface PEZonesEntry {
  "Suburb"?: string;
  "Rate Area": number; 
  "Rate Area Zone Description": string; 
  "Combined": string; 
  "PE Suburb": string; 
  "PE Zone": string; 
}

export interface LocationLookupData {
  "AREA SERVICED": string;
  "BUSINESS UNIT": string;
  "MANAGING DEPOT": string;
  "BUSINESS NAME": string;
  "ESCALATION POINT": string;
  "SITE MANAGER": string;
  "BUSINESS ADDRESS": string;
  "MANAGER MOBILE NUMBER": string;
  "OFFICE NUMBER": string;
  "EMAIL ADDRESS": string;
  "FORKLIFT ONSITE": string;
  "REFRIGERATION ON-SITE": string;
  "MAX VEHICLE SIZE": string;
  "HOURS OF OPERATIONS": string;
  "SATURDAY DELIVERIES": string;
  "COLLECTION / DROP OFF TIMES": string;
  "DG COLLECTIONS / DELIVERIES": string;
  "LAT": number;
  "LONG": number;
  "State": string;
}

export type ServiceName =
  | 'LCP Std'
  | 'LCP Priority'
  | 'LCP GO Std'
  | 'LCP GO Priority'
  | 'LCP GO Std 167'
  | 'LCP GO Priority 167'
  | 'B2B Std' 
  | 'B2B Priority' 
  | 'B2B Pallets Express' 
  | 'B2B Pallets General Tiered' 
  | 'B2C Std'
  | 'B2C Priority'
  | 'WA PE Special'
  | 'Manual Rate';

export const ALL_SERVICES: ServiceName[] = [
  'LCP Std', 'LCP Priority',
  'LCP GO Std', 'LCP GO Priority',
  'LCP GO Std 167', 'LCP GO Priority 167',
  'B2B Std', 'B2B Priority',
  'B2B Pallets Express', 'B2B Pallets General Tiered',
  'B2C Std', 'B2C Priority',
  'WA PE Special',
];

export const STANDARD_ROAD_MAPPED_SERVICES: ServiceName[] = ['B2B Std', 'LCP Std'];
export const PRIORITY_MAPPED_SERVICES: ServiceName[] = ['B2B Priority', 'LCP Priority', 'B2C Std', 'B2C Priority', 'LCP GO Std', 'LCP GO Priority', 'LCP GO Std 167', 'LCP GO Priority 167'];
export const STANDARD_PALLET_MAPPED_SERVICES: ServiceName[] = ['B2B Pallets Express', 'B2B Pallets General Tiered'];
export const PALLET_LIKE_SERVICES: ServiceName[] = ['B2B Pallets Express', 'B2B Pallets General Tiered', 'WA PE Special'];
export const PALLET_SERVICES: ServiceName[] = ['B2B Pallets Express', 'B2B Pallets General Tiered', 'WA PE Special'];
export const NON_PALLET_SERVICES: ServiceName[] = ['B2B Std', 'B2B Priority', 'LCP Std', 'LCP Priority', 'B2C Std', 'B2C Priority', 'LCP GO Std', 'LCP GO Priority', 'LCP GO Std 167', 'LCP GO Priority 167'];
export const LCP_SERVICES: ServiceName[] = ['LCP Std', 'LCP Priority', 'LCP GO Std', 'LCP GO Priority', 'LCP GO Std 167', 'LCP GO Priority 167'];
export const SECURITY_APPLICABLE_SERVICES: ServiceName[] = ['B2B Priority', 'LCP Priority', 'B2C Std', 'B2C Priority', 'LCP GO Std', 'LCP GO Priority', 'LCP GO Std 167', 'LCP GO Priority 167'];
export const RAS_APPLICABLE_SERVICES: ServiceName[] = ['B2B Std', 'B2B Priority', 'LCP Std', 'LCP Priority', 'B2C Std', 'B2C Priority', 'LCP GO Std', 'LCP GO Priority', 'LCP GO Std 167', 'LCP GO Priority 167'];
export const BASIC_KILO_MIN_SERVICES: ServiceName[] = ['B2B Std', 'B2B Priority', 'LCP Std', 'LCP Priority'];

export type UserRole = 'superadmin' | 'admin' | 'bdm' | 'driver' | 'agent' | 'user' | null;
export const ALL_USER_ROLES: Exclude<UserRole, null>[] = ['superadmin', 'admin', 'bdm', 'driver', 'agent', 'user'];

export type PageKey =
  | 'calculator' | 'ai-guru' | 'proposal' | 'live' | 'location-lookup' | 'info' | 'tge-way' | 'problem-log' | 'leads'
  | 'rate-card' | 'sb-comparison' | 'rate-comparison' | 'competitor-comparison' | 'zone-sb' | 'multi' | 'leg-discount' | 'all-167' | 'bulk'
  | 'settings' | 'user-management' | 'role-settings' | 'csv-converter' | 'rate-uploader' | 'remittance' | 'commercials' | 'price-test' | 'ai-log' | 'ai-mode' | 'run-reports' | 'qr-scan' | 'promo-codes'
  | 'notebook' | 'vip' | 'status' | 'priority-quiz' | 'find-it' | 'grab-it' | 'json-creator' | 'routing' | 'top-links' | 'calculations' | 'companies' | 'feature-management' | 'team' | 'branding' | 'profile' | 'org-account' | 'manual-onboard'
  | 'manage-surcharges' | 'pdf-extractor' | 'core-rate-uploader' | 'salesforce-search-bar' | 'salesforce-widgets' | 'account-reports' | 'live-rates' | 'standard-spend-bands' | 'about-tge' | 'register-tge' | 'applications' | 'json-management' | 'ai-mode' | 'admin-menu' | 'ai-analytics' | 'audit-log' | 'quote-logs' | 'update-ras';

export const ALL_PAGES: PageKey[] = [
  'calculator', 'ai-guru', 'proposal', 'live', 'location-lookup', 'info', 'tge-way', 'problem-log', 'leads',
  'rate-card', 'sb-comparison', 'rate-comparison', 'competitor-comparison', 'zone-sb', 'multi', 'leg-discount', 'all-167', 'bulk',
  'settings', 'user-management', 'role-settings', 'csv-converter', 'rate-uploader', 'remittance', 'commercials', 'price-test', 'ai-log', 'ai-mode', 'run-reports', 'qr-scan', 'promo-codes',
  'notebook', 'vip', 'status', 'priority-quiz', 'find-it', 'grab-it', 'json-creator', 'routing', 'top-links', 'calculations', 'companies', 'feature-management', 'team', 'branding', 'profile', 'org-account', 'manual-onboard',
  'manage-surcharges', 'pdf-extractor', 'core-rate-uploader', 'salesforce-search-bar', 'salesforce-widgets', 'account-reports', 'live-rates', 'standard-spend-bands', 'about-tge', 'register-tge', 'applications', 'json-management', 'ai-mode', 'admin-menu', 'ai-analytics', 'audit-log', 'quote-logs', 'update-ras'
];

export type ServicePermissions = Partial<Record<Exclude<UserRole, null> | 'null', ServiceName[]>>;
export type PagePermissions = Partial<Record<Exclude<UserRole, null> | 'null', PageKey[]>>;

export const DEFAULT_PAGE_PERMISSIONS: PagePermissions = {
    superadmin: ALL_PAGES,
    admin: [
      'calculator', 'location-lookup', 'info', 'problem-log', 'leads', 'vip', 
      'profile', 'org-account', 'register-tge', 'json-management', 'team', 'branding', 
      'remittance', 'top-links', 'pdf-extractor', 'ai-guru', 'proposal', 'rate-card', 
      'sb-comparison', 'rate-comparison', 'competitor-comparison', 'zone-sb', 'multi', 'leg-discount',
      'update-ras'
    ],
    bdm: ['calculator', 'ai-guru', 'proposal', 'rate-card', 'sb-comparison', 'rate-comparison', 'competitor-comparison', 'zone-sb', 'multi', 'leg-discount', 'location-lookup', 'info', 'problem-log', 'leads', 'vip', 'profile', 'org-account', 'about-tge', 'register-tge'],
    driver: ['live', 'find-it', 'location-lookup', 'profile', 'about-tge', 'routing'],
    agent: ['calculator', 'location-lookup', 'info', 'problem-log', 'leads', 'profile', 'org-account', 'about-tge', 'remittance'],
    user: ['calculator', 'location-lookup', 'info', 'profile', 'about-tge', 'top-links'],
    null: [],
};

export const DEFAULT_SERVICE_PERMISSIONS: ServicePermissions = {
  superadmin: ALL_SERVICES,
  admin: ALL_SERVICES,
  bdm: ALL_SERVICES.filter(service => !service.startsWith('LCP')),
  driver: [],
  agent: ALL_SERVICES,
  user: ['B2B Std', 'B2B Priority', 'B2C Std', 'B2C Priority', 'B2B Pallets Express', 'B2B Pallets General Tiered', 'WA PE Special'],
  null: [],
};

export function getAllowedServices(role: UserRole, permissions: ServicePermissions): ServiceName[] {
  if (!role) return [];
  const normalizedRole = role.toLowerCase();
  
  if (normalizedRole === 'superadmin') return ALL_SERVICES;
  
  const custom = permissions?.[normalizedRole as any];
  if (custom && Array.isArray(custom) && custom.length > 0) return custom;
  
  const systemDefault = DEFAULT_SERVICE_PERMISSIONS[normalizedRole as any];
  if (systemDefault && systemDefault.length > 0) return systemDefault;

  if (normalizedRole === 'admin') return ALL_SERVICES;
  
  return [];
}

export function getServiceFeatureId(serviceName: string): string {
  const slug = serviceName.toLowerCase().replace('standard', 'std').replace(/\s+/g, '-');
  return `service-${slug}`;
}

export function isServiceEnabledForCompany(serviceName: string, company: Company | null, role: UserRole | null = null): boolean {
  if (role?.toLowerCase() === 'superadmin') return true;
  if (!company || !company.enabledFeatures) return true;
  
  const featureId = getServiceFeatureId(serviceName);
  return company.enabledFeatures[featureId] !== false;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  companyId: string; 
  assignedCompanyIds?: string[];
  subscriptionStatus: 'active' | 'inactive' | 'past_due';
  tokens: number;
  lastSignInTime?: string | null;
}

export interface Company {
  id: string;
  name: string;
  domain?: string;
  subscriptionStatus: 'active' | 'inactive' | 'past_due';
  settings: {
    logoText?: string;
    primaryColor?: string;
    accentColor?: string;
    topMenuColor?: string;
    hoverColor?: string;
    markup?: number;
  };
  enabledFeatures?: Record<string, boolean>;
  createdAt?: string;
  isUnlimited?: boolean;
  promoExpiryDate?: string;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  action: string;
  userId: string;
  userEmail: string;
  companyId: string;
  targetId?: string;
  metadata?: any;
}

export interface QuoteLog {
  id: string;
  timestamp: any;
  userEmail: string;
  userId: string;
  companyId: string;
  origin: string;
  destination: string;
  chargeWeight: number;
  markup: string;
  service: string;
  totalExGst: number;
  inputState: any;
}

export interface CompanyRate {
  id: string;
  companyId: string;
  rateType: string; 
  accountNumber?: string;
  data: any[];
  updatedAt: string;
  updatedBy: string;
}

export interface ProblemEntry {
  id: string;
  consignmentNumber?: string;
  problemType?: ProblemType;
  problemSubType?: string;
  carrier?: string;
  status: 'open' | 'in_progress' | 'resolved';
  description?: string;
  reportedBy?: string;
  date?: string;
  companyId?: string;
  userId?: string;
  customerImpacted?: string;
  accountNumber?: string;
  solution?: string;
  outcome?: string;
  dateCompleted?: string | null;
}

export type ProblemType = 'freight_issue' | 'delivery_issue' | 'billing_issue' | 'freight_damage' | 'customer_complaint' | 'other';

export interface Lead {
  id: string;
  companyName: string;
  firstName?: string;
  lastName: string;
  contactEmail?: string;
  contactPhone?: string;
  street?: string;
  suburb?: string;
  state?: StateAbbreviation;
  postcode?: string;
  status: 'new' | 'contacted' | 'qualified' | 'proposal_sent' | 'closed_won' | 'closed_lost';
  date: string;
  userId: string;
  companyId: string;
  reportedBy: string;
  leadOwner?: string;
  businessUnit?: BusinessUnit;
  industry?: string;
  estimatedValue?: number;
  notes?: string;
  salesforceSync?: 'not_synced' | 'synced' | 'error';
  salesforceError?: string;
  salutation?: LeadSalutation;
  leadTopic?: string;
  country?: string;
  leadSource?: LeadSource;
  frequencyOfActivity?: LeadFrequency;
  serviceOfInterest?: string;
  depot?: string;
  estimatedSpend?: '0-50K' | '50-100K' | '100-250K' | '250K+';
}

export type BusinessUnit = 'PE' | 'IPEC' | 'Priority' | 'Other';
export type LeadSalutation = 'Mr' | 'Ms' | 'Mrs' | 'Miss' | 'Dr' | 'Prof';
export type LeadSource = 'Cold Call' | 'Inbound Inquiry' | 'Referral' | 'Social Media' | 'Event' | 'Other';
export type LeadFrequency = 'Reoccurring' | 'Tender';
export type SimplifiedCarrier = string;

export interface PromoCode {
  id: string;
  code: string;
  type: 'free_time' | 'unlimited';
  validDays?: number;
  status: 'active' | 'used' | 'expired';
  usedByCompanyId?: string;
  usedByEmail?: string;
  usedAt?: string;
  createdAt: string;
}

export interface Invitation {
  id: string;
  companyId: string;
  companyName: string;
  invitedBy: string;
  role: UserRole;
  status: 'pending' | 'accepted' | 'expired';
  createdAt: string;
  expiresAt: string;
}

export interface Note {
  id: string;
  userId: string;
  companyId: string;
  title: string;
  content: string;
  updatedAt: string;
}

export type StateAbbreviation = 'WA' | 'SA' | 'VIC' | 'NSW' | 'QLD' | 'TAS' | 'ACT' | 'NT' | 'National';
export const ALL_STATES: StateAbbreviation[] = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'ACT', 'NT'];

export interface DeliveryRun {
  id: string;
  userId: string;
  userEmail?: string;
  companyId?: string;
  date: string;
  status: 'pending' | 'in_progress' | 'completed';
  consignments: Consignment[];
  timeSensitiveJobs?: TimeSensitiveJob[];
  routePlan?: RoutePlannerOutput | null;
  startLocation?: string;
}

export interface Consignment {
  id: string;
  consignmentNumber: string;
  carrier: string;
  address: string;
  fullData: string;
  isLargeParcel?: boolean;
  status: StopStatus;
}

export interface TimeSensitiveJob {
  id: string;
  address: string;
  time: string;
  status: string;
}

export type StopStatus = string;

export interface RoutePlannerOutput {
  optimizedRoute: Array<{
    id?: string;
    address?: string;
    description?: string;
    type?: 'Standard' | 'Time Sensitive' | 'Large Parcel';
    status?: StopStatus;
  }>;
  orderedAddresses: string[];
  estimatedTime: string;
  potentialRisks: string[];
  googleMapsUrl: string;
  routeSegments?: string[];
}

export interface VipContact {
  id: string;
  userId: string;
  companyId: string;
  name: string;
  role: string;
  businessUnit: 'PE' | 'IPEC' | 'Priority' | 'Other';
  state: StateAbbreviation | 'National';
  phone?: string;
  email: string;
  notes?: string;
}

export type RateData = any[];

export type RateFileType =
  | 'postcodes' | 'locations' | 'pezone'
  | 'b2c' | 'regionallookup'
  | 'lcpgo' | 'lcprdex' | 'lcpprio'
  | 'b2b_priority' | 'b2brdex' | 'b2b_std'
  | 'pe1' | 'pe2' | 'pe3' | 'pe4' | 'pe5' | 'pe6' | 'pallet6'
  | 'west_east' | 'ras'
  | 'customer_b2brdex'
  | 'customer_b2bsatchel'
  | 'customer_b2b_priority'
  | 'customer_b2c'
  | 'customer_pe'
  | 'customer_west_east'
  | 'customer_lcprdex'
  | 'customer_lcpprio'
  | 'customer_lcpgo'
  | 'our_rates_b2brdex'
  | 'our_rates_b2b_priority'
  | 'our_rates_pe'
  | 'our_rates_b2c'
  | 'our_rates_b2bsatchel'
  | 'our_rates_west_east'
  | 'our_rates_lcpgo'
  | 'our_rates_lcpprio'
  | 'our_rates_lcprdex';


export interface ExternalLink {
  id: string;
  label: string;
  url: string;
  icon: string;
}

export interface AiUsageEntry {
  id: string;
  timestamp: string;
  serviceName: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  userId?: string | null;
  userEmail?: string | null;
  companyId?: string | null;
  metadata?: any;
}

export interface SBComparisonResult {
  serviceName: string;
  spendBandPrices: SpendBandPriceEntry[];
  isOverallApplicable: boolean;
  overallRemarks: string[];
}

export interface SpendBandPriceEntry {
  spendBand: string;
  priceItem: CalculatedPriceItem;
}

export interface RateComparisonItem {
  rateEntry: UploadedRateEntry;
  newBasic: number | null;
  newKilo: number | null;
  newMin: number | null;
  oldCostAtSampleWeight: number | null;
  newCostAtSampleWeight: number | null;
  newB2cCostAtSampleWeight?: number | null;
  costDifference: number | null;
  error?: string;
  oldRateFormula?: string;
  newRateFormula?: string;
}

export type TieredPalletRateEntry = Record<string, any>;
export type GenericJsonRateEntry = Record<string, any>;
export type CompetitorLeg = Record<string, any>;
export type TgeAccountApplication = Record<string, any>;
export interface RateCardGeneratorFormValues {
  sendingLocations?: PostcodeData[];
  [key: string]: any;
}
export type ProblemSubType<T = string> = T;
export const CSV_EXPECTED_HEADERS: Partial<Record<RateFileType, string[]>> = {};

export interface EmailQuoteDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  serviceResult: CalculatedPriceItem | null;
  freightFormValues: FreightFormValues | null;
}

export interface UploadedRateEntry {
  id: string;
  originZone: string;
  destinationZone: string;
  oldBasic: number | null;
  oldKilo: number | null;
  oldMin: number | null;
  tier1Rate?: number;
  tier2Rate?: number;
  tier3Rate?: number;
  tier4Rate?: number;
  error?: string;
}

export interface UploadedConsignment {
  id: string;
  senderPostcode: string;
  receiverPostcode: string;
  chargeWeight: number;
  customerCostExSurcharges: number;
  error?: string;
  originPostcodeData?: PostcodeData;
  destPostcodeData?: PostcodeData;
}

export interface BulkComparisonResultItem {
  consignment: UploadedConsignment;
  spendBandCosts: SpendBandCalculatedCost[];
  overallError?: string;
}

export interface SpendBandCalculatedCost {
  spendBand: string;
  standardCostExSurcharges: number | null;
  isCustomerRateBetter?: boolean;
  difference: number | null;
  differencePercent?: number;
  isBestFit?: boolean;
}

export type QuickActionKey = 'calculator' | 'competitor-comparison' | 'problem-log' | 'ai-guru' | 'rate-card' | 'sb-comparison' | 'rate-comparison' | 'multi' | 'leg-discount' | 'location-lookup' | 'csv-converter' | 'myteamge';

export interface PendingProposalState {
  proposalDetails?: Partial<ProposalDetails>;
  rateCardEntries?: RateCardDisplayEntry[];
}

export interface B2CRateEntry {
  Logic: string;
  Service?: string;
  b2c1?: number;
  b2c3?: number;
  b2c5?: number;
  kg?: number;
  b2cp1?: number;
  b2cp3?: number;
  b2cp5?: number;
  pkg?: number;
  [key: string]: number | string | undefined;
}

export interface RegionalLookupEntry {
  LUP: string;
  Journey: string;
  Description?: string;
}

export interface LCPRdexRateEntry {
  Logic: string;
  LCPRDEXBasic: number;
  LCPRDEXKg: number;
  [key: string]: number | string | undefined;
}

export interface LCPPrioRateEntry {
  Logic: string;
  LCPPrioBasic: number;
  LCPPrioKg: number;
  [key: string]: number | string | undefined;
}

export interface LCPGoRateEntry {
  Logic: string;
  Go1?: number;
  Go3?: number;
  Go5?: number;
  Go10?: number;
  GoKilo?: number; 
  [key: string]: number | string | undefined;
}

export interface B2BStdRateEntry { 
  Logic: string;
  B1?: number; K1?: number; M1?: number;
  B2?: number; K2?: number; M2?: number;
  B3?: number; K3?: number; M3?: number;
  B4?: number; K4?: number; M4?: number;
  B5?: number; K5?: number; M5?: number;
  B6?: number; K6?: number; M6?: number;
  [key: string]: number | string | undefined;
}

export interface B2BRdexEntry {
  Logic: string;
  Service: string;
  Origin: string;
  Destination: string;
  B1?: number; K1?: number; M1?: number;
  B2?: number; K2?: number; M2?: number;
  B3?: number; K3?: number; M3?: number;
  B4?: number; K4?: number; M4?: number;
  B5?: number; K5?: number; M5?: number;
  B6?: number; K6?: number; M6?: number;
}

export interface B2BPriorityRateEntry { 
  Logic: string;
  B1: number; B2: number; B3: number; B4: number; B5: number; B6: number;
  K1: number; K2: number; K3: number; K4: number; K5: number; K6: number;
  [key: string]: number | string | undefined;
}

export interface WestEastRateEntry {
  To: string;
  Basic: number;
  Minimum: number;
  "0-99999KGS": number;
  [key: string]: any;
}

export interface RASRateEntry {
  postcode: number;
  suburb: string;
  ipec: number;
  prio: number;
}

export interface EPRateEntry {
  Logic: string;
  [key: string]: any;
}

export interface ServiceSettings {
  id: ServiceName;
  name: string;
  fuelSurchargePercent: number;
  surcharges: ActiveSurchargeSetting[];
}

export type ProposalSectionId = 'execSummary' | 'yourNeeds' | 'overviewSolution' | 'solutionDetail' | 'investment' | 'benefits' | 'nextSteps' | 'authorityToProceed';

export interface ProposalDetails {
  proposalDate?: Date;
  customerCompanyName?: string;
  customerContactName?: string;
  salesProfessionalName?: string;
  salesProfessionalEmail?: string;
  salesProfessionalPhone?: string;
  sections?: Partial<Record<ProposalSectionId, string>>;
  dynamicFields?: {
    yourNeeds?: string[];
    benefits?: string[];
  };
  [key: string]: any;
}

export interface RateCardDisplayEntry {
  serviceName: ServiceName;
  spendBand: string;
  sendingPostcodeFull: string;
  originZone: string;
  destinationZone: string;
  zoneTypeDisplay: string;
  basicRate: string; 
  kiloRate: string;  
  minRate: string;   
  additionalRate?: string; 
  cubicFactor?: number;
  tier_0_250?: string;
  tier_251_750?: string;
  tier_751_1500?: string;
  tier_1501_3000?: string;
  tier_3001_5000?: string;
  tier_5001_plus?: string;
}

export interface CalculatedPriceItem {
  uniqueId?: string;
  serviceName: ServiceName | "Manual Rate";
  accountNumber?: string; 
  baseRate: number | null;
  chargeableWeight: number;
  chargeZoneUsed: string;
  fuelSurchargeAmount: number;
  fuelSurchargePercentApplied?: number;
  securitySurchargePercentApplied?: number;
  otherSurcharges: Array<{ name: string; amount: number; id: string }>;
  totalSurcharges: number;
  totalExtrasAmount: number;
  subTotalBeforeMarkupAndGST: number | null;
  additionalMarkupPercentApplied: number | null;
  additionalMarkupAmount: number | null;
  subTotalBeforeGST: number | null;
  gstAmount: number | null;
  finalPrice: number | null;
  remarks: string[];
  isApplicable: boolean;
  calculationFormula?: string;
  rateEntryUsed?: any;
}

export interface IntelliSendResult {
  isApplicable: boolean;
  bestStdResult?: CalculatedPriceItem | null;
  bestPrioResult?: CalculatedPriceItem | null;
  bestPalletResult?: CalculatedPriceItem | null;
  b2cStdPrice?: number | null;
  b2cPriorityPrice?: number | null;
  lcpGoStdPrice?: number | null;
  lcpGoPriorityPrice?: number | null; 
  combinationText?: string;
  error?: string;
}

export interface ActiveSurchargeSetting {
  surchargeId: string;
  value: number;
  enabled: boolean;
}

export const ALL_TIMEZONES = {
  'sydney': { label: 'SYD', tz: 'Australia/Sydney' },
  'melbourne': { label: 'MEL', tz: 'Australia/Melbourne' },
  'brisbane': { label: 'BNE', tz: 'Australia/Brisbane' },
  'adelaide': { label: 'ADL', tz: 'Australia/Adelaide' },
  'perth': { label: 'PER', tz: 'Australia/Perth' },
};

export const ALL_BUSINESS_UNITS: string[] = ['PE', 'IPEC', 'Priority', 'Other'];
export const ALL_LEAD_SALUTATIONS: string[] = ['Mr', 'Ms', 'Mrs', 'Miss', 'Dr', 'Prof'];
export const ALL_LEAD_SOURCES: string[] = ['Cold Call', 'Inbound Inquiry', 'Referral', 'Social Media', 'Event', 'Other'];
export const ALL_LEAD_FREQUENCIES: string[] = ['Reoccurring', 'Tender'];
export const ALL_SIMPLIFIED_CARRIERS: SimplifiedCarrier[] = ['IPEC', 'Priority', 'B2C', 'LCP', 'Other'];

export type SurchargeConfigGroupKey = 'STANDARD_ROAD' | 'PRIORITY_MIXED' | 'PALLET_SERVICES';

export interface FreightItem {
  weight?: number;
  quantity?: number;
  length?: number;
  width?: number;
  height?: number;
}

export type AdditionalPercentageType = 'none' | '3' | '5' | '8' | '10' | '12' | '15' | '18' | '20' | '30' | 'other';

export interface FreightFormValues {
  spendBand?: string;
  originQuery?: string;
  originLocation?: PostcodeData | null;
  destinationQuery?: string;
  destinationLocation?: PostcodeData | null;
  items?: FreightItem[];
  globalNoCubic?: boolean;
  globalOnPallet?: boolean;
  selectedServices?: ServiceName[];
  enableOtherRate?: boolean;
  applyGST?: boolean;
  additionalPercentageType?: AdditionalPercentageType;
  additionalPercentageCustom?: number;
  globalExtras?: number;
  accountTransferRequired?: boolean;
  afterHoursCollection?: boolean;
  afterHoursDelivery?: boolean;
  publicHolidayService?: boolean;
  bookInDeliveryRequired?: boolean;
  dangerousGoodsConsignment?: boolean;
  handUnloadRequired?: boolean;
  routeViaMelbourne?: boolean;
  tailLiftRequired?: boolean;
  aiQuoteId?: string; 
  originalAiValues?: any; 
}

export type SurchargeDefinition = {
  id: string;
  name: string;
  type: 'fixed_per_shipment' | 'fixed_per_kg' | 'percentage';
  defaultValue?: number;
  applicableServices: ServiceName[];
  isPredefined?: boolean;
  isConfigurablePerService?: boolean;
};

export const StopSchema = z.object({
  type: z.enum(["Standard", "Time Sensitive", "Large Parcel"]),
  address: z.string().min(1, "Address is required"),
  description: z.string().min(1, "Description is required"),
});

export const RoutePlannerInputSchema = z.object({
  startLocation: z.string().min(1, "Start location is required"),
  stops: z.array(StopSchema).min(1, "At least one stop is required"),
});
export type RoutePlannerInput = z.infer<typeof RoutePlannerInputSchema>;

export const OptimizedStopSchema = StopSchema.extend({
  id: z.string().optional(),
  status: z.enum(['pending', 'completed', 'failed']).optional(),
});

export const RoutePlannerAIOutputSchema = z.object({
  optimizedRoute: z.array(OptimizedStopSchema),
  orderedAddresses: z.array(z.string()),
  estimatedTime: z.string(),
  potentialRisks: z.array(z.string()),
});
export type RoutePlannerAIOutput = z.infer<typeof RoutePlannerAIOutputSchema>;

export const QuoteAgentOutputSchema = z.object({
  summary: z.string().describe("A professional natural language summary of the quote findings."),
  isAmbiguous: z.boolean().optional(),
  choices: z.array(z.object({ id: z.string(), label: z.string(), type: z.string() })).optional(),
  suggestedAction: z.string().optional().describe("What the user should do next."),
  warnings: z.array(z.string()).optional().describe("Accuracy or partial failure warnings."),
  results: z.array(z.object({
    serviceName: z.string(),
    price: z.number().nullable(),
    isBestValue: z.boolean(),
    transitTime: z.string().optional().describe("Estimated delivery time in days."),
    remarks: z.string().optional(),
    breakdown: z.object({
      baseRate: z.number().nullable(),
      fuelSurcharge: z.number().nullable(),
      otherSurcharges: z.array(z.object({ name: z.string(), amount: z.number() })).optional(),
      gst: z.number().nullable(),
      formula: z.string().optional()
    }).optional().describe("Detailed mathematical breakdown of the price.")
  })).optional(),
  resolvedInput: z.custom<FreightFormValues>().optional().describe("The structured input derived from the query."),
  rawIntent: z.any().optional().describe("The raw JSON output from the AI Interpreter phase."),
  trace: z.array(z.object({
    step: z.number(),
    title: z.string(),
    detail: z.string(),
    status: z.enum(['success', 'warning', 'error']).default('success')
  })).optional().describe("Dynamic execution logs for debugging.")
});

export type QuoteAgentOutput = z.infer<typeof QuoteAgentOutputSchema>;

export interface AiQuote {
  id: string;
  userId: string;
  companyId: string;
  query: string;
  results: any[];
  structuredInput: FreightFormValues;
  status: 'draft' | 'sent' | 'archived';
  version: string;
  warnings?: string[];
  corrections?: Record<string, any>;
  createdAt: any;
  fullOutput?: QuoteAgentOutput;
}

import { z } from 'zod';

console.log('[DEBUG] lib/types.ts loaded');

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

export interface TieredPalletRateEntry {
  "From - To": string;
  "From": string;
  "To": string;
  "EBasic": number;
  "Eminimum": number;
  "E0 - 250": number;
  "E251 - 750": number;
  "E751 - 1500": number;
  "E1501 - 3000": number;
  "E3001 - 5000": number;
  "E5001 - 99999": number;
  "GBasic": number;
  "GMinimum": number;
  "G0 - 250": number;
  "G251 - 750": number;
  "G751 - 1500": number;
  "G1501 - 3000": number;
  "G3001 - 5000": number;
  "G5001 - 99999": number;
  [key: string]: any;
}

export interface GenericJsonRateEntry {
  [key: string]: any;
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

export interface LCPGORateEntry {
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
  | 'Manual Rate'
  | 'Customer B2B Standard'
  | 'Customer B2B Priority'
  | 'Customer B2C Standard'
  | 'Customer B2C Priority'
  | 'Customer Pallet Express'
  | 'Customer Pallet General'
  | 'Customer WA PE Special'
  | 'Customer LCP Standard'
  | 'Customer LCP Priority'
  | 'Customer LCP GO Standard'
  | 'Customer LCP GO Priority'
  | 'Customer LCP GO Standard 167'
  | 'Customer LCP GO Priority 167';

export const ALL_SERVICES: ServiceName[] = [
  'LCP Std', 'LCP Priority',
  'LCP GO Std', 'LCP GO Priority',
  'LCP GO Std 167', 'LCP GO Priority 167',
  'B2B Std', 'B2B Priority',
  'B2B Pallets Express', 'B2B Pallets General Tiered',
  'B2C Std', 'B2C Priority',
  'WA PE Special',
];

export const LCP_SERVICES: ServiceName[] = [
  'LCP Std', 'LCP Priority',
  'LCP GO Std', 'LCP GO Priority',
  'LCP GO Std 167', 'LCP GO Priority 167',
];

export const PALLET_SERVICES: ServiceName[] = [
  'B2B Pallets Express',
  'B2B Pallets General Tiered'
];

export const PALLET_LIKE_SERVICES: ServiceName[] = [...PALLET_SERVICES, 'WA PE Special'];
export const NON_PALLET_SERVICES = ALL_SERVICES.filter(s => !PALLET_LIKE_SERVICES.includes(s as ServiceName)) as ServiceName[];
export const BASIC_KILO_MIN_SERVICES: ServiceName[] = [
  'LCP Std', 'LCP Priority', ...PALLET_SERVICES,
  'B2B Std', 'B2B Priority', 'WA PE Special'
];

export const STANDARD_ROAD_MAPPED_SERVICES: ServiceName[] = ['B2B Std', 'LCP Std', 'LCP GO Std', 'LCP GO Std 167'];
export const PRIORITY_MAPPED_SERVICES: ServiceName[] = ['B2B Priority', 'LCP Priority', 'B2C Priority', 'LCP GO Priority', 'LCP GO Priority 167'];
export const STANDARD_PALLET_MAPPED_SERVICES: ServiceName[] = ['B2B Pallets Express', 'B2B Pallets General Tiered'];
export const RAS_APPLICABLE_SERVICES: ServiceName[] = [
  'LCP Std', 'LCP Priority', 'B2B Std', 'B2B Priority', 'B2C Std', 'B2C Priority', 'LCP GO Std', 'LCP GO Priority', 'LCP GO Std 167', 'LCP GO Priority 167'
];
export const SECURITY_APPLICABLE_SERVICES: ServiceName[] = [ 'B2B Priority', 'B2C Priority', 'LCP Priority' ];

export type UserRole = 'superadmin' | 'admin' | 'bdm' | 'driver' | 'agent' | 'user' | null;
export const ALL_USER_ROLES: Exclude<UserRole, null>[] = ['superadmin', 'admin', 'bdm', 'driver', 'agent', 'user'];

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  companyId: string; 
  subscriptionStatus: 'active' | 'inactive' | 'past_due';
  tokens: number;
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
    markup?: number;
  };
  enabledFeatures?: Record<string, boolean>;
  createdAt?: string;
  isUnlimited?: boolean;
  promoExpiryDate?: string;
}

export interface CompanyRate {
  id: string;
  companyId: string;
  rateType: RateFileType;
  data: any[];
  updatedAt: string;
  updatedBy: string;
}

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

export type ServicePermissions = Partial<Record<Exclude<UserRole, null> | 'null', ServiceName[]>>;

export const DEFAULT_SERVICE_PERMISSIONS: ServicePermissions = {
  superadmin: ALL_SERVICES,
  admin: ALL_SERVICES,
  bdm: ALL_SERVICES,
  driver: ALL_SERVICES,
  agent: ALL_SERVICES,
  user: ALL_SERVICES,
  null: [],
};

export type PageKey =
  | 'calculator' | 'ai-guru' | 'proposal' | 'live' | 'location-lookup' | 'info' | 'tge-way' | 'problem-log' | 'leads'
  | 'rate-card' | 'sb-comparison' | 'rate-comparison' | 'competitor-comparison' | 'multi' | 'leg-discount' | 'all-167' | 'bulk'
  | 'settings' | 'user-management' | 'role-settings' | 'csv-converter' | 'rate-uploader' | 'remittance' | 'commercials' | 'price-test' | 'ai-log' | 'ai-mode' | 'run-reports' | 'qr-scan' | 'promo-codes'
  | 'notebook' | 'vip' | 'status' | 'priority-quiz' | 'find-it' | 'grab-it' | 'json-creator' | 'routing' | 'top-links' | 'calculations' | 'companies' | 'feature-management' | 'team' | 'branding' | 'profile' | 'org-account' | 'manual-onboard'
  | 'manage-surcharges' | 'pdf-extractor' | 'core-rate-uploader' | 'salesforce-search-bar' | 'salesforce-widgets' | 'account-reports' | 'live-rates' | 'standard-spend-bands' | 'about-tge' | 'register-tge' | 'applications' | 'json-management' | 'ai-mode' | 'admin-menu' | 'ai-analytics' | 'audit-log' | 'quote-logs' | 'update-ras' | 'livetest' | 'live-test';

export const ALL_PAGES: PageKey[] = [
  'calculator', 'ai-guru', 'proposal', 'live', 'location-lookup', 'info', 'tge-way', 'problem-log', 'leads',
  'rate-card', 'sb-comparison', 'rate-comparison', 'competitor-comparison', 'multi', 'leg-discount', 'all-167', 'bulk',
  'settings', 'user-management', 'role-settings', 'csv-converter', 'rate-uploader', 'remittance', 'commercials', 'price-test', 'ai-log', 'ai-mode', 'run-reports', 'qr-scan', 'promo-codes',
  'notebook', 'vip', 'status', 'priority-quiz', 'find-it', 'grab-it', 'json-creator', 'routing', 'top-links', 'calculations', 'companies', 'feature-management', 'team', 'branding', 'profile', 'org-account', 'manual-onboard',
  'manage-surcharges', 'pdf-extractor', 'core-rate-uploader', 'salesforce-search-bar', 'salesforce-widgets', 'account-reports', 'live-rates', 'standard-spend-bands', 'about-tge', 'register-tge', 'applications', 'json-management', 'ai-mode', 'admin-menu', 'ai-analytics', 'audit-log', 'quote-logs', 'update-ras', 'livetest', 'live-test'
];

export type PagePermissions = Partial<Record<Exclude<UserRole, null> | 'null', PageKey[]>>;

export const DEFAULT_PAGE_PERMISSIONS: PagePermissions = {
    superadmin: ALL_PAGES,
    admin: ALL_PAGES.filter(p => !['live-test', 'user-management', 'manual-onboard', 'notebook'].includes(p)),
    bdm: ALL_PAGES.filter(p => !p.startsWith('admin/') && !['settings', 'user-management', 'role-settings', 'commercials', 'run-reports', 'live', 'notebook'].includes(p)).concat(['remittance', 'json-creator']),
    driver: ['live', 'find-it', 'grab-it', 'location-lookup', 'remittance', 'json-creator', 'about-tge'],
    agent: ['calculator', 'live', 'location-lookup', 'info', 'problem-log', 'remittance', 'json-creator', 'about-tge'],
    user: ['calculator', 'info', 'remittance', 'json-creator', 'about-tge', 'json-management'],
    null: [],
};

export const getAllowedServices = (role?: UserRole | null, permissions?: ServicePermissions): ServiceName[] => {
  if (role === 'superadmin') return [...ALL_SERVICES];
  if (!role || !permissions) return [];
  const roleKey = role === null ? 'null' : role;
  return permissions[roleKey] || [];
};

export type StateAbbreviation = 'WA' | 'SA' | 'VIC' | 'NSW' | 'QLD' | 'TAS' | 'ACT' | 'NT' | 'National';
export const ALL_STATES: StateAbbreviation[] = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'ACT', 'NT'];

export interface SurchargeDefinition {
  id: string;
  name: string;
  type: 'percentage' | 'fixed_per_shipment' | 'fixed_per_kg';
  defaultValue?: number;
  isConfigurablePerService?: boolean;
  isPredefined?: boolean;
  applicableServices: ServiceName[];
}

export interface ActiveSurchargeSetting {
  surchargeId: string;
  value: number;
  enabled: boolean;
}
export interface ServiceSettings {
  id: ServiceName;
  name: string;
  fuelSurchargePercent: number;
  surcharges: ActiveSurchargeSetting[];
}
export type SurchargeConfigGroupKey = 'STANDARD_ROAD' | 'PRIORITY_MIXED' | 'PALLET_SERVICES';

export interface FreightItem {
  weight: number;
  length?: number;
  width?: number;
  height?: number;
  quantity: number;
}

export type AdditionalPercentageType = 'none' | '3' | '5' | '8' | '10' | '12' | '15' | '18' | '20' | 'other';

export interface FreightFormValues {
  spendBand: string;
  originQuery: string;
  originLocation: PostcodeData | null;
  destinationQuery: string;
  destinationLocation: PostcodeData | null;
  items: FreightItem[];
  globalNoCubic: boolean; 
  globalOnPallet: boolean; 
  selectedServices: ServiceName[];
  enableOtherRate?: boolean;
  otherRateBasic?: number;
  otherRateKilo?: number;
  otherRateMin?: number;
  otherRateFuelPercent?: number;
  otherRateSecurityPercent?: number;
  globalExtras?: number;
  additionalPercentageType: AdditionalPercentageType;
  additionalPercentageCustom?: number;
  applyGST: boolean;
  accountTransferRequired?: boolean; 
  afterHoursCollection?: boolean; 
  afterHoursDelivery?: boolean; 
  publicHolidayService?: boolean; 
  bookInDeliveryRequired?: boolean; 
  dangerousGoodsConsignment?: boolean; 
  handUnloadRequired?: boolean; 
  routeViaMelbourne?: boolean; 
  tailLiftRequired?: boolean; 
}

export interface CalculatedPriceItem {
  uniqueId?: string;
  serviceName: ServiceName | string;
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
  originLocation?: PostcodeData;
  destinationLocation?: PostcodeData;
}

export interface EmailQuoteDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  serviceResult: CalculatedPriceItem | null;
  freightFormValues: FreightFormValues;
}

export interface IntelliSendResult {
  isApplicable: boolean;
  b2cStdPrice?: number | null;
  b2cPriorityPrice?: number | null;
  lcpGoStdPrice?: number | null;
  lcpGoPriorityPrice?: number | null;
  combinationText?: string;
  error?: string;
  bestStdResult?: CalculatedPriceItem | null;
  bestPrioResult?: CalculatedPriceItem | null;
  bestPalletResult?: CalculatedPriceItem | null;
}

export interface RateCardDisplayEntry {
  serviceName: ServiceName | string;
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

export type RateMatrixResult = any;
export type LCP_KEY_ROUTES_RESULT = any;

export interface AiUsageEntry {
  id: string;
  timestamp: string;
  serviceName: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
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

export const ALL_TIMEZONES: Record<string, { label: string; tz: string }> = {
  'perth': { label: 'Perth', tz: 'Australia/Perth' },
  'adelaide': { label: 'Adelaide', tz: 'Australia/Adelaide' },
  'darwin': { label: 'Darwin', tz: 'Australia/Darwin' },
  'brisbane': { label: 'Brisbane', tz: 'Australia/Brisbane' },
  'sydney': { label: 'Sydney', tz: 'Australia/Sydney' },
  'melbourne': { label: 'Melbourne', tz: 'Australia/Melbourne' },
  'hobart': { label: 'Hobart', tz: 'Australia/Hobart' },
  'auckland': { label: 'Pacific/Auckland', tz: 'Pacific/Auckland' },
};

export type ProblemType = 'freight_issue' | 'delivery_issue' | 'billing_issue' | 'freight_damage' | 'customer_complaint' | 'other';
export type ProblemStatus = 'open' | 'in_progress' | 'resolved';
export type ProblemSubType<T extends ProblemType> = string;

export interface ProblemEntry {
  id: string;
  userId: string;
  companyId: string;
  date: string;
  consignmentNumber: string;
  accountNumber?: string;
  customerImpacted?: string;
  description: string;
  problemType: ProblemType;
  problemSubType?: string;
  otherProblemTypeDescription?: string;
  carrier?: SimplifiedCarrier;
  depotAtFault?: string;
  status: ProblemStatus;
  reportedBy: string;
  solution?: string;
  outcome?: string;
  dateCompleted?: string | null;
}

export interface Lead {
  id?: string;
  userId: string;
  companyId: string;
  date: string;
  salutation?: LeadSalutation;
  companyName: string;
  firstName?: string;
  lastName: string;
  leadTopic?: string;
  street?: string;
  suburb?: string;
  postcode?: string;
  country: string;
  state?: StateAbbreviation;
  contactPhone?: string;
  contactEmail?: string;
  leadSource?: LeadSource;
  frequencyOfActivity?: LeadFrequency;
  businessUnit: BusinessUnit;
  estimatedValue?: number;
  serviceOfInterest?: string;
  notes?: string;
  industry?: string;
  depot?: string;
  estimatedSpend?: '0-50K' | '50-100K' | '100-250K' | '250K+';
  status: 'new' | 'contacted' | 'qualified' | 'proposal_sent' | 'closed_won' | 'closed_lost';
  reportedBy: string;
  salesforceSync?: 'not_synced' | 'synced' | 'error';
  salesforceError?: string | null;
  leadOwner?: string;
}

export interface TgeAccountApplication {
  id: string;
  userId: string;
  companyId: string;
  companyName: string;
  abn: string;
  signeeTitle: string;
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2?: string;
  suburb: string;
  state: StateAbbreviation;
  postcode: string;
  country: string;
  phone: string;
  email: string;
  preferredContact: 'Phone' | 'Email';
  customerConsent: boolean;
  driverEmail?: string;
  referrerId?: string;
  createdAt: string;
  status: 'New' | 'In Progress' | 'Submitted';
  estSatchelsPerWeek: number;
  estParcelsPerWeek: number;
  estPalletsPerWeek: number;
  speedSameDay: boolean;
  speedPriority: boolean;
  speedStandard: boolean;
  notes?: string;
}

export type LeadSalutation = 'Mr' | 'Ms' | 'Mrs' | 'Miss' | 'Dr' | 'Prof';
export const ALL_LEAD_SALUTATIONS: LeadSalutation[] = ['Mr', 'Ms', 'Mrs', 'Miss', 'Dr', 'Prof'];

export type LeadSource = 'Cold Call' | 'Inbound Inquiry' | 'Referral' | 'Social Media' | 'Event' | 'Other';
export const ALL_LEAD_SOURCES: LeadSource[] = ['Cold Call', 'Inbound Inquiry', 'Referral', 'Social Media', 'Event', 'Other'];

export type LeadFrequency = 'Reoccurring' | 'Tender';
export const ALL_LEAD_FREQUENCIES: LeadFrequency[] = ['Reoccurring', 'Tender'];

export type BusinessUnit = 'PE' | 'IPEC' | 'Priority' | 'Other';
export const ALL_BUSINESS_UNITS: BusinessUnit[] = ['PE', 'IPEC', 'Priority', 'Other'];

export type SimplifiedCarrier = 'IPEC' | 'Priority' | 'B2C' | 'LCP' | 'Other';
export const ALL_SIMPLIFIED_CARRIERS: SimplifiedCarrier[] = ['IPEC', 'Priority', 'B2C', 'LCP', 'Other'];

export const StopSchema = z.object({
  type: z.enum(['Standard', 'Time Sensitive', 'Large Parcel']),
  address: z.string(),
  description: z.string(),
});

export const RoutePlannerInputSchema = z.object({
  startLocation: z.string(),
  stops: z.array(StopSchema),
});

export const RoutePlannerAIOutputSchema = z.object({
  optimizedRoute: z.array(StopSchema),
  orderedAddresses: z.array(z.string()),
  estimatedTime: z.string(),
  potentialRisks: z.array(z.string()),
});

export interface RoutePlannerInput {
  startLocation: string;
  stops: {
    type: 'Standard' | 'Time Sensitive' | 'Large Parcel';
    address: string;
    description: string;
  }[];
}

export interface RoutePlannerOutput {
  optimizedRoute: {
    address: string;
    description: string;
    type: 'Standard' | 'Time Sensitive' | 'Large Parcel';
  }[];
  orderedAddresses: string[];
  estimatedTime: string;
  potentialRisks: string[];
  googleMapsUrl: string;
  routeSegments?: string[];
}

export interface DeliveryRun {
  id: string;
  userId: string;
  userEmail?: string;
  companyId: string;
  date: string;
  status: 'pending' | 'in_progress' | 'completed';
  consignments?: Consignment[];
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
  status: StopStatus;
}

export type StopStatus = 'pending' | 'completed' | 'failed';

export interface VipContact {
  id: string;
  userId: string;
  name: string;
  role: string;
  businessUnit: 'PE' | 'IPEC' | 'Priority' | 'Other';
  state: StateAbbreviation | 'National';
  phone?: string;
  email: string;
  notes?: string;
}

export type RateData = any[];

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
  isBestFit?: boolean;
}

export const CSV_EXPECTED_HEADERS: Partial<Record<RateFileType, string[]>> = {
  b2c: ['Logic', 'Service', 'B2C1', 'B2C3', 'B2C5', 'KG', 'B2CP1', 'B2CP3', 'B2CP5', 'PKG'],
  lcprdex: ['Logic', 'LCPRDEXBasic', 'LCPRDEXKg'],
  lcpprio: ['Logic', 'LCPPrioBasic', 'LCPPrioKg'],
  lcpgo: ['Logic', 'Go1', 'Go3', 'Go5', 'Go10', 'GoKilo'],
  b2b_std: ['Logic', 'B1', 'K1', 'M1', 'B2', 'K2', 'M2', 'B3', 'K3', 'M3', 'B4', 'K4', 'M4', 'B5', 'K5', 'M5', 'B6', 'K6', 'M6'],
  b2b_priority: ['Logic', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'K1', 'K2', 'K3', 'K4', 'K5', 'K6'],
  b2brdex: ['Logic', 'Service', 'Origin', 'Destination', 'B1', 'K1', 'M1', 'B2', 'K2', 'M2', 'B3', 'K3', 'M3', 'B4', 'K4', 'M4', 'B5', 'K5', 'M5', 'B6', 'K6', 'M6'],
  west_east: ['To', 'Basic', 'Minimum', '0-99999KGS'],
  customer_b2b_priority: ['Logic', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'K1', 'K2', 'K3', 'K4', 'K5', 'K6'],
  customer_b2brdex: ['Logic', 'Service', 'Origin', 'Destination', 'B1', 'K1', 'M1', 'B2', 'K2', 'M2', 'B3', 'K3', 'M3', 'B4', 'K4', 'M4', 'B5', 'K5', 'M5', 'B6', 'K6', 'M6'],
  customer_b2c: ['Logic', 'Service', 'B2C1', 'B2C3', 'B2C5', 'KG', 'B2CP1', 'B2CP3', 'B2CP5', 'PKG'],
};

export type RateFileType =
  | 'b2c' | 'regionallookup' | 'lcprdex' | 'lcpprio' | 'lcpgo' | 'b2b_std' | 'b2b_priority' | 'b2brdex' | 'pezone' | 'pe1' | 'pe2' | 'pe3' | 'pe4' | 'pe5' | 'pallet6' | 'west_east' | 'ras' | 'eprates' | 'postcodes' | 'locations'
  | 'customer_b2b_priority' | 'customer_b2brdex' | 'customer_pe' | 'customer_b2c' | 'customer_lcpgo' | 'customer_lcprdex' | 'customer_lcpprio' | 'customer_west_east' | 'customer_b2bsatchel';

export type QuickActionKey = 'calculator' | 'competitor-comparison' | 'problem-log' | 'new-lead' | 'ai-guru' | 'rate-card' | 'sb-comparison' | 'rate-comparison' | 'multi' | 'leg-discount' | 'location-lookup' | 'csv-converter';

export interface ExternalLink {
  id: string;
  label: string;
  url: string;
  icon: string;
}

export interface EPRateEntry {
  Logic: string;
  [key: string]: any;
}

export type ProposalSectionId = 'execSummary' | 'yourNeeds' | 'overviewSolution' | 'solutionDetail' | 'investment' | 'benefits' | 'nextSteps' | 'authorityToProceed';

export interface ProposalDetails {
  proposalDate: Date;
  customerCompanyName: string;
  customerContactName: string;
  salesProfessionalName: string;
  salesProfessionalEmail: string;
  salesProfessionalPhone: string;
  sections?: Partial<Record<ProposalSectionId, string>>;
  dynamicFields?: {
    yourNeeds?: string[];
    benefits?: string[];
  };
}

export interface RateCardGeneratorFormValues {
  customerName: string;
  sendingLocations: PostcodeData[];
  date: Date;
  spendBand: string;
  services: ServiceName[];
  currentSendingLocationQuery?: string;
  currentSendingLocation?: PostcodeData | null;
}

export interface PendingProposalState {
  proposalDetails?: Partial<ProposalDetails>;
  rateCardEntries?: RateCardDisplayEntry[];
}

export function isServiceEnabledForCompany(serviceName: ServiceName, company: Company | null, role?: UserRole): boolean {
    if (role === 'superadmin' || role === 'admin') return true;
    if (!company) return true; 
    
    const featureId = `service-${serviceName.toLowerCase().replace(/\s+/g, '-')}`;
    return company.enabledFeatures?.[featureId] !== false;
}

export function normalizeServiceName(name: string): ServiceName {
    return name.replace(/^Customer\s+/, '') as ServiceName;
}

export const getServiceFeatureId = (serviceName: ServiceName): string => {
  return `service-${serviceName.toLowerCase().replace(/\s+/g, '-')}`;
};

export const QuoteAgentOutputSchema = z.object({
  summary: z.string(),
  results: z.array(z.any()).optional(),
  warnings: z.array(z.string()).optional(),
  trace: z.array(z.object({
    step: z.number(),
    title: z.string(),
    detail: z.string(),
    status: z.enum(['success', 'warning', 'error'])
  })).optional(),
  resolvedInput: z.any().optional(),
  rawIntent: z.any().optional()
});

export type QuoteAgentOutput = z.infer<typeof QuoteAgentOutputSchema>;

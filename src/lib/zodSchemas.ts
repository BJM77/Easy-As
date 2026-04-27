import { z } from 'zod';
import type { 
  PostcodeData, ServiceName, AdditionalPercentageType, ProblemType, 
  StateAbbreviation, SimplifiedCarrier, BusinessUnit, 
  LeadSalutation, LeadSource, LeadFrequency 
} from './types';
import { 
  ALL_SERVICES, ALL_STATES, ALL_SIMPLIFIED_CARRIERS, ALL_BUSINESS_UNITS, 
  ALL_LEAD_SALUTATIONS, ALL_LEAD_SOURCES, ALL_LEAD_FREQUENCIES 
} from './types';

const optionalDimensionSchema = z.preprocess(
  (val) => {
    if (val === "" || val === null || val === undefined) return undefined;
    const num = Number(val);
    return isNaN(num) ? val : num;
  },
  z.number({ invalid_type_error: "Must be a valid number or empty." })
    .min(0, { message: "Dimension cannot be negative." })
    .optional()
);

const baseItemSchema = z.object({
  weight: z.coerce.number({ invalid_type_error: "Weight must be a number." })
    .positive({ message: "Weight must be greater than 0." }),
  length: optionalDimensionSchema,
  width: optionalDimensionSchema,
  height: optionalDimensionSchema,
  quantity: z.coerce.number().int().min(1, { message: "Quantity must be at least 1." }),
});

export const freightItemSchema = baseItemSchema;

export const serviceNameEnum = z.enum(ALL_SERVICES as [ServiceName, ...ServiceName[]]);
export const additionalPercentageTypeEnum = z.enum(['none', '3', '5', '8', '10', '12', '15', '18', '20', '30', 'other'] as [AdditionalPercentageType, ...AdditionalPercentageType[]]);

const freightObjectFieldsDefinition = {
  spendBand: z.string().min(1, { message: "Spend Band is required." }),
  originQuery: z.string().min(3, { message: "Origin must be at least 3 characters." }),
  originLocation: z.custom<PostcodeData | null>((data) => data !== null, {
    message: "Valid Origin location is required.",
  }),
  destinationQuery: z.string().min(3, { message: "Destination must be at least 3 characters." }),
  destinationLocation: z.custom<PostcodeData | null>((data) => data !== null, {
    message: "Please select a valid destination from the suggestions.",
  }),
  items: z.array(freightItemSchema).min(1, { message: "At least one item is required." }),
  globalNoCubic: z.boolean().default(false),
  globalOnPallet: z.boolean().default(false),
  selectedServices: z.array(serviceNameEnum).min(1, { message: "At least one service must be selected." }),
  enableOtherRate: z.boolean().optional(),
  otherRateBasic: z.coerce.number().optional(),
  otherRateKilo: z.coerce.number().optional(),
  otherRateMin: z.coerce.number().optional(),
  otherRateFuelPercent: z.coerce.number().optional(),
  otherRateSecurityPercent: z.coerce.number().optional(),
  globalExtras: z.number({ invalid_type_error: "Extras must be a valid number." })
    .min(0, "Extras cannot be negative.")
    .optional()
    .or(z.nan().transform(() => undefined)),
  additionalPercentageType: additionalPercentageTypeEnum.default('none'),
  additionalPercentageCustom: z.preprocess(
    (val) => {
        if (val === "" || val === null || val === undefined) return 0;
        const num = Number(val);
        return isNaN(num) ? 0 : num;
    },
    z.number().min(0, "Custom percentage cannot be negative.")
  ).optional().default(0),
  applyGST: z.boolean().default(false),
  accountTransferRequired: z.boolean().optional().default(false),
  afterHoursCollection: z.boolean().optional().default(false),
  afterHoursDelivery: z.boolean().optional().default(false),
  publicHolidayService: z.boolean().optional().default(false),
  bookInDeliveryRequired: z.boolean().optional().default(false),
  dangerousGoodsConsignment: z.boolean().optional().default(false),
  handUnloadRequired: z.boolean().optional().default(false),
  routeViaMelbourne: z.boolean().optional().default(false),
  tailLiftRequired: z.boolean().optional().default(false),
};

const freightSuperRefineLogic = (data: any, ctx: z.RefinementCtx) => {
  if (!data.globalNoCubic) {
    data.items.forEach((item: any, index: number) => {
      const hasSomeDims = item.length !== undefined || item.width !== undefined || item.height !== undefined;
      const hasAllDims = item.length !== undefined && item.width !== undefined && item.height !== undefined;
      if (hasSomeDims && !hasAllDims) {
        if (item.length === undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [`items.${index}.length`], message: "Length is required if other dims are set." });
        if (item.width === undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [`items.${index}.width`], message: "Width is required if other dims are set." });
        if (item.height === undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [`items.${index}.height`], message: "Height is required if other dims are set." });
      }
      if (hasAllDims) {
        if (item.length <= 0) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [`items.${index}.length`], message: "Length must be > 0." });
        if (item.width <= 0) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [`items.${index}.width`], message: "Width must be > 0." });
        if (item.height <= 0) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [`items.${index}.height`], message: "Height must be > 0." });
      }
    });
  }
  if (data.enableOtherRate) {
    if (data.otherRateBasic === undefined || data.otherRateBasic === null || data.otherRateBasic < 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Manual Basic Rate must be a positive number.", path: ["otherRateBasic"] });
    if (data.otherRateKilo === undefined || data.otherRateKilo === null || data.otherRateKilo < 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Manual Kilo Rate must be a positive number.", path: ["otherRateKilo"] });
    if (data.otherRateMin === undefined || data.otherRateMin === null || data.otherRateMin < 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Manual Minimum Rate must be a positive number.", path: ["otherRateMin"] });
    if (data.otherRateFuelPercent === undefined || data.otherRateFuelPercent === null || data.otherRateFuelPercent < 0 || data.otherRateFuelPercent > 100) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Manual Fuel % must be between 0 and 100.", path: ["otherRateFuelPercent"] });
    if (data.otherRateSecurityPercent === undefined || data.otherRateSecurityPercent === null || data.otherRateSecurityPercent < 0 || data.otherRateSecurityPercent > 100) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Manual Security % must be between 0 and 100.", path: ["otherRateSecurityPercent"] });
  }
};

export const freightFormSchema = z.object(freightObjectFieldsDefinition).superRefine(freightSuperRefineLogic);

export const tgeAccountApplicationSchema = z.object({
  companyName: z.string().min(1, "Company Name is required"),
  abn: z.string().min(9, "Valid ABN is required"),
  signeeTitle: z.string(),
  firstName: z.string().min(1, "First Name is required"),
  lastName: z.string().min(1, "Last Name is required"),
  addressLine1: z.string().min(1, "Address is required"),
  addressLine2: z.string().optional().or(z.literal('')),
  suburb: z.string().min(1, "Suburb is required"),
  state: z.enum(ALL_STATES as [StateAbbreviation, ...StateAbbreviation[]]),
  postcode: z.string().min(4, "4-digit postcode required"),
  country: z.string().default('Australia'),
  phone: z.string().min(1, "Phone is required"),
  email: z.string().email("Valid email required"),
  preferredContact: z.enum(['Phone', 'Email']),
  customerConsent: z.boolean().refine(v => v === true, "Consent is required"),
  driverEmail: z.string().email().optional().or(z.literal('')),
  referrerId: z.string().optional().or(z.literal('')),
  createdAt: z.string().optional(),
  status: z.enum(['New', 'In Progress', 'Submitted']).default('Submitted'),
  estSatchelsPerWeek: z.coerce.number().min(0).optional().default(0),
  estParcelsPerWeek: z.coerce.number().min(0).optional().default(0),
  estPalletsPerWeek: z.coerce.number().min(0).optional().default(0),
  speedSameDay: z.boolean().optional().default(false),
  speedPriority: z.boolean().optional().default(false),
  speedStandard: z.boolean().optional().default(false),
  notes: z.string().optional().or(z.literal('')),
});

export const industryOptions = [
  "Agriculture, Forestry and Fishing", "Mining", "Manufacturing",
  "Electricity, Gas, Water And Waste Services", "Construction", "Wholesale Trade",
  "Retail Trade", "Accommodation and Food Services", "Transport, Postal and Warehousing",
  "Information Media and Telecommunications", "Financial and Insurance Services",
  "Rental, Hiring And Real Estate Services", "Professional, Scientific And Technical Services",
  "Administrative and Support Services", "Public Administration and Safety",
  "Education and Training", "Health Care and Support Services", "Arts and Recreation Services", "Other Services"
];

export const leadSchema = z.object({
  companyName: z.string().min(1, "Company Name is required"),
  lastName: z.string().min(1, "Last Name is required"),
  status: z.enum(['new', 'contacted', 'qualified', 'proposal_sent', 'closed_won', 'closed_lost']).default('new'),
  businessUnit: z.enum(ALL_BUSINESS_UNITS as [BusinessUnit, ...BusinessUnit[]]),
  salutation: z.enum(ALL_LEAD_SALUTATIONS as [LeadSalutation, ...LeadSalutation[]]).optional(),
  firstName: z.string().optional(),
  leadTopic: z.string().optional(),
  street: z.string().optional(),
  suburb: z.string().optional(),
  state: z.enum(ALL_STATES as [StateAbbreviation, ...StateAbbreviation[]]).optional(),
  postcode: z.string().optional(),
  country: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email("Invalid email address.").optional().or(z.literal('')),
  leadSource: z.enum(ALL_LEAD_SOURCES as [LeadSource, ...LeadSource[]]).optional(),
  frequencyOfActivity: z.enum(ALL_LEAD_FREQUENCIES as [LeadFrequency, ...LeadFrequency[]]).optional(),
  serviceOfInterest: z.string().optional(),
  notes: z.string().optional(),
  industry: z.string().optional(),
  depot: z.string().optional(),
  estimatedValue: z.coerce.number().min(0).optional(),
  estimatedSpend: z.enum(['0-50K', '50-100K', '100-250K', '250K+']).optional(),
  leadOwner: z.string().optional(),
});

export const problemLogSchema = z.object({
  problemType: z.enum(['freight_issue', 'delivery_issue', 'billing_issue', 'freight_damage', 'customer_complaint', 'other']),
  consignmentNumber: z.string().min(1, "Consignment number required."),
  accountNumber: z.string().optional(),
  problemSubType: z.string().optional(),
  otherProblemTypeDescription: z.string().optional(), 
  carrier: z.enum(ALL_SIMPLIFIED_CARRIERS as [SimplifiedCarrier, ...SimplifiedCarrier[]]).optional(),
  depotAtFault: z.string().optional(),
  customerImpacted: z.string().optional(),
  description: z.string().min(10, "Detail required (min. 10 chars).").max(500),
  solution: z.string().optional(),
  outcome: z.string().optional(),
  status: z.enum(['open', 'in_progress', 'resolved']).optional(),
  dateCompleted: z.date().nullable().optional(),
  userId: z.string().optional(),
});

export const perfectPlanSchema = z.object({
  customerName: z.string().min(1, "Customer name is required."),
  originLocationQuery: z.string().min(1, 'Sending location is required.'),
  originLocation: z.custom<PostcodeData | null>(data => data !== null, 'Valid sending location is required.'),
  palletsPerWeek: z.coerce.number().int().min(0).optional().default(0),
  parcelsPerWeek: z.coerce.number().int().min(0).optional().default(0),
  satchelsPerWeek: z.coerce.number().int().min(0).optional().default(0),
  addressType: z.enum(['Residential', 'Business', 'Both']),
  distributionArea: z.enum(['Metro', 'Regional', 'Both']),
  monthlySpend: z.coerce.number().min(0, "Monthly spend cannot be negative").optional().default(0),
  destinations: z.array(z.object({
    id: z.string(),
    destinationQuery: z.string().min(1, 'Location is required'),
    destinationLocation: z.custom<PostcodeData | null>(data => data !== null, 'Valid location is required'),
    serviceLegs: z.array(z.object({
      id: z.string(),
      service: z.enum(ALL_SERVICES as [ServiceName, ...ServiceName[]]),
      averageWeight: z.coerce.number().positive('Weight must be positive'),
      targetPrice: z.coerce.number().positive('Target price must be positive'),
    })).min(1, "At least one service leg is required."),
  })).min(1, 'At least one destination is required').max(5, 'Maximum of 5 destinations allowed'),
});

export const rateCardGeneratorFormSchema = z.object({
  customerName: z.string().optional(),
  sendingLocations: z.array(z.custom<PostcodeData>((data) => data !== null, "Valid sending location must be selected."))
                     .min(1, "At least one sending location is required."),
  currentSendingLocationQuery: z.string().optional(),
  currentSendingLocation: z.custom<PostcodeData | null>().optional(),
  date: z.date({ required_error: "Effective date is required." }),
  spendBand: z.string().min(1, "Spend band is required."),
  services: z.array(serviceNameEnum)
               .min(1, "At least one service must be selected."),
});

export const sbComparisonFormSchema = z.object({
  originQuery: z.string().min(3, { message: "Origin must be at least 3 characters." }),
  originLocation: z.custom<PostcodeData | null>((data) => data !== null, {
    message: "Valid Origin location is required.",
  }),
  destinationQuery: z.string().min(3, { message: "Destination must be at least 3 characters." }),
  destinationLocation: z.custom<PostcodeData | null>((data) => data !== null, {
    message: "Please select a valid destination from the suggestions.",
  }),
  items: z.array(baseItemSchema).min(1, { message: "At least one item is required." }),
  globalNoCubic: z.boolean().default(false),
  globalOnPallet: z.boolean().default(false),
  selectedServices: z.array(serviceNameEnum).min(1, { message: "At least one service must be selected." }),
});

export const competitorComparisonFormSchema = z.object({
  companyName: z.string().optional(),
  competitorName: z.string().optional(),
  date: z.date().optional(),
  legs: z.array(z.object({
    id: z.string(),
    originQuery: z.string().min(1, "Origin is required."),
    originLocation: z.custom<PostcodeData | null>((data) => data !== null, "Valid Origin location is required."),
    destinationQuery: z.string().min(1, "Destination is required."),
    destinationLocation: z.custom<PostcodeData | null>((data) => data !== null, {
      message: "Please select a valid destination from the suggestions.",
    }),
    weight: z.coerce.number().positive("Weight must be positive."),
    price: z.coerce.number().positive("Price must be positive."),
  })).min(1, "At least one leg is required.").max(2000, "A maximum of 2000 legs can be compared at once."),
  selectedServices: z.array(serviceNameEnum).min(1, "At least one service must be selected."),
});

export const newSurchargeSchema = z.object({
  id: z.string().min(1, "ID is required"),
  name: z.string().min(1, "Name is required"),
  type: z.enum(['percentage', 'fixed_per_shipment', 'fixed_per_kg']),
  defaultValue: z.coerce.number().min(0),
  applicableServices: z.array(serviceNameEnum).min(1, "Select at least one service"),
});

export const multiFreightFormSchema = z.object({
    spendBand: z.string().min(1),
    originQuery: z.string().min(1),
    originLocation: z.custom<PostcodeData | null>((d) => d !== null),
    destinationQuery: z.string().min(1),
    destinationLocation: z.custom<PostcodeData | null>((d) => d !== null),
    via1Query: z.string().min(1),
    via1Location: z.custom<PostcodeData | null>((d) => d !== null),
    via2Query: z.string().optional(),
    via2Location: z.custom<PostcodeData | null>().optional(),
    items: z.array(baseItemSchema).min(1),
    globalNoCubic: z.boolean().default(false),
    globalOnPallet: z.boolean().default(false),
    selectedServices: z.array(serviceNameEnum).min(1),
    additionalPercentageType: additionalPercentageTypeEnum.default('none'),
    applyGST: z.boolean().default(false),
});

export const proposalDetailsSchema = z.object({
  proposalDate: z.date(),
  customerCompanyName: z.string().min(1, "Customer company name is required."),
  customerContactName: z.string().min(1, "Customer contact name is required."),
  salesProfessionalName: z.string().min(1, "Sales professional name is required."),
  salesProfessionalEmail: z.string().email("Invalid email for sales professional.").min(1, "Sales professional email is required."),
  salesProfessionalPhone: z.string().min(1, "Sales professional phone is required."),
  sections: z.object({
    execSummary: z.string().optional(),
    yourNeeds: z.string().optional(),
    overviewSolution: z.string().optional(),
    solutionDetail: z.string().optional(),
    investment: z.string().optional(),
    benefits: z.string().optional(),
    nextSteps: z.string().optional(),
    authorityToProceed: z.string().optional(),
  }).optional(),
  dynamicFields: z.object({
    yourNeeds: z.array(z.string()).optional(),
    benefits: z.array(z.string()).optional(),
  }).optional(),
});

export const vipContactSchema = z.object({
  name: z.string().min(1, "Name is required."),
  role: z.string().min(1, "Role is required."),
  businessUnit: z.enum(['PE', 'IPEC', 'Priority', 'Other']),
  state: z.enum([...ALL_STATES, 'National'] as [string, ...string[]]),
  phone: z.string().optional(),
  email: z.string().email("Invalid email address."),
  notes: z.string().max(250).optional(),
});

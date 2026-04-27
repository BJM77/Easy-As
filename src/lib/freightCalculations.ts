import type {
  FreightFormValues,
  CalculatedPriceItem,
  ServiceSettings,
  SurchargeDefinition,
  ServiceName,
  FreightItem,
  PEZonesEntry,
  PostcodeData,
  RateFileType,
  RateData,
  IntelliSendResult,
  RASRateEntry
} from './types';
import { 
  PALLET_LIKE_SERVICES, 
  PRIORITY_MAPPED_SERVICES, 
  RAS_APPLICABLE_SERVICES, 
  LCP_SERVICES, 
  STANDARD_ROAD_MAPPED_SERVICES, 
  NON_PALLET_SERVICES, 
  normalizeServiceName 
} from './types';

/**
 * @fileOverview Pricing Engine v5.9.0
 * Hardened for custom organization rates and schema-agnostic matching.
 */

const CONFIG = {
    CUBIC_FACTORS: {
        PALLET: 333,
        PARCEL: 250,
        LCP_GO_167: 167
    },
    GST_RATE: 0.10,
    LCP_GO_WEIGHT_LIMIT: 10.01
};

function parseSafeNum(val: any): number {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const clean = String(val).replace(/[^0-9.-]/g, '');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
}

const roundUp = (num: number, decimalPlaces: number = 0): number => {
  const factor = Math.pow(10, decimalPlaces);
  return Math.ceil(num * factor) / factor;
};

/**
 * Robust entry lookup. 
 * 1. Tries exact logic key.
 * 2. Tries key without common technical prefixes (Parcel, 02 02).
 */
function findRateEntry(data: any[] | undefined, key: string, keyField: string = 'Logic'): any | undefined {
  if (!data || !Array.isArray(data) || !key) return undefined;
  const upperKey = key.toUpperCase();
  
  // 1. Try common key fields first to handle inconsistent JSON schemas
  const fieldsToTry = [keyField, 'Logic', 'LUP', 'From - To', 'Lane', 'From-To'];
  const uniqueFields = Array.from(new Set(fieldsToTry));

  for (const field of uniqueFields) {
      const found = data.find(r => String(r[field] || '').toUpperCase() === upperKey);
      if (found) return found;
  }

  // 2. Try matching without technical prefixes
  const cleanKey = key.replace(/^(Parcel|02 02|LCPRDEX|LCPPrio|GoOvernight|GoOff Peak|B2CStandard|B2CPriority|ParcelPallets)/, '').toUpperCase();
  if (cleanKey && cleanKey !== upperKey) {
    const suffixMatch = data.find(r => String(r[keyField] || '').toUpperCase().endsWith(cleanKey));
    if (suffixMatch) return suffixMatch;
  }

  // 3. Try fuzzy match (remove all spaces and special chars)
  const alphanumericKey = key.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  if (alphanumericKey) {
    const fuzzy = data.find(r => {
        const rowKey = String(r[keyField] || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
        return rowKey === alphanumericKey;
    });
    if (fuzzy) return fuzzy;
  }

  // 4. Try generating logic key if missing but Origin/Destination exist
  const partsMatch = data.find(r => {
      const rowOrigin = String(r.Origin || '').toUpperCase();
      const rowDest = String(r.Destination || '').toUpperCase();
      return rowOrigin && rowDest && upperKey.includes(rowOrigin) && upperKey.includes(rowDest);
  });
  if (partsMatch) return partsMatch;

  return undefined;
}

/**
 * Flexible field resolver to handle B1/K1 vs Basic/Kg vs LCPRDEXBasic names.
 */
function resolveRates(entry: any, spendBand: string, isOurRates: boolean): { basic: number, kilo: number, min: number } {
    if (isOurRates) {
        return {
            basic: parseSafeNum(entry.B1 ?? entry.Basic ?? entry.LCPRDEXBasic ?? entry.LCPPrioBasic),
            kilo: parseSafeNum(entry.K1 ?? entry.Kilo ?? entry.Kg ?? entry.LCPRDEXKg ?? entry.LCPPrioKg),
            min: parseSafeNum(entry.M1 ?? entry.Min ?? entry.Minimum ?? 0)
        };
    }
    return {
        basic: parseSafeNum(entry[`B${spendBand}`] ?? entry.Basic ?? entry.LCPRDEXBasic ?? entry.LCPPrioBasic),
        kilo: parseSafeNum(entry[`K${spendBand}`] ?? entry.Kilo ?? entry.Kg ?? entry.LCPRDEXKg ?? entry.LCPPrioKg),
        min: parseSafeNum(entry[`M${spendBand}`] ?? entry.Min ?? entry.Minimum ?? 0)
    };
}

export function calculateChargeableWeight(items: FreightItem[], cubicFactor: number, globalNoCubic: boolean): number {
  let totalDeadWeight = 0; let totalCubicWeight = 0;
  items.forEach(item => {
    const deadWeightKg = (item.weight || 0) * (item.quantity || 1); totalDeadWeight += deadWeightKg;
    if (!globalNoCubic && item.length && item.width && item.height) {
      const cubicVolumeM3 = (item.length / 100) * (item.width / 100) * (item.height / 100) * item.quantity;
      const itemCubicWeightKg = cubicVolumeM3 * cubicFactor;
      totalCubicWeight += itemCubicWeightKg;
    }
  });
  return roundUp(Math.max(totalDeadWeight, totalCubicWeight));
}

// --- PRICING STRATEGIES ---

interface PricingContext {
    originLocation: PostcodeData;
    destinationLocation: PostcodeData;
    spendBand: string;
    isOurRates: boolean;
    uiServiceName: ServiceName;
    chargeableWeightKg: number;
    totalDeadWeightKg: number;
}

const StandardParcelStrategy = (data: any[], context: PricingContext): Partial<CalculatedPriceItem> => {
    const { originLocation, destinationLocation, spendBand, chargeableWeightKg, isOurRates } = context;
    const logicKey = `Parcel${originLocation.ipec}${destinationLocation.ipec}`;
    const entry = findRateEntry(data, logicKey);
    if (!entry) return { isApplicable: false, remarks: [`Lane key '${logicKey}' not found in data.`] };

    const { basic, kilo, min } = resolveRates(entry, spendBand, isOurRates);
    const baseFreight = Math.max(basic + (kilo * chargeableWeightKg), min);
    
    return { 
        baseRate: baseFreight, 
        chargeZoneUsed: logicKey, 
        calculationFormula: `MAX((${basic} + (${kilo} * CW)), ${min})`,
        isApplicable: true,
        rateEntryUsed: entry
    };
};

const PriorityParcelStrategy = (data: any[], context: PricingContext): Partial<CalculatedPriceItem> => {
    const { originLocation, destinationLocation, spendBand, chargeableWeightKg, isOurRates } = context;
    const prefix = isOurRates ? 'Parcel' : '02 02';
    const logicKey = `${prefix}${originLocation.prio}${destinationLocation.prio}`;
    const entry = findRateEntry(data, logicKey);
    if (!entry) return { isApplicable: false, remarks: [`Lane key '${logicKey}' not found in data.`] };

    const { basic, kilo } = resolveRates(entry, spendBand, isOurRates);
    const baseFreight = basic + (kilo * chargeableWeightKg);
    
    return { 
        baseRate: baseFreight, 
        chargeZoneUsed: logicKey, 
        calculationFormula: `(${basic} + (${kilo} * CW))`,
        isApplicable: true,
        rateEntryUsed: entry
    };
};

const LCPStandardStrategy = (data: any[], context: PricingContext): Partial<CalculatedPriceItem> => {
    const { originLocation, destinationLocation, chargeableWeightKg, isOurRates, spendBand } = context;
    let logicKey = `LCPRDEX${originLocation.ipec}${destinationLocation.ipec}`;
    let entry = findRateEntry(data, logicKey);
    
    if (!entry) {
        // Fallback to prio zones if ipec doesn't match (common in some LCP datasets)
        logicKey = `LCPRDEX${originLocation.prio}${destinationLocation.prio}`;
        entry = findRateEntry(data, logicKey);
    }

    if (!entry) return { isApplicable: false, remarks: [`Lane key '${logicKey}' not found in data.`] };

    const { basic, kilo } = resolveRates(entry, spendBand, isOurRates);
    const baseFreight = basic + (kilo * chargeableWeightKg);

    return { 
        baseRate: baseFreight, 
        chargeZoneUsed: logicKey, 
        calculationFormula: `(${basic} + (${kilo} * CW))`,
        isApplicable: true,
        rateEntryUsed: entry
    };
};

const LCPPriorityStrategy = (data: any[], context: PricingContext): Partial<CalculatedPriceItem> => {
    const { originLocation, destinationLocation, chargeableWeightKg, isOurRates, spendBand } = context;
    let logicKey = `LCPPrio${originLocation.prio}${destinationLocation.prio}`;
    let entry = findRateEntry(data, logicKey);

    if (!entry) {
        // Fallback to ipec zones
        logicKey = `LCPPrio${originLocation.ipec}${destinationLocation.ipec}`;
        entry = findRateEntry(data, logicKey);
    }

    if (!entry) return { isApplicable: false, remarks: [`Lane key '${logicKey}' not found in data.`] };

    const { basic, kilo } = resolveRates(entry, spendBand, isOurRates);
    const baseFreight = basic + (kilo * chargeableWeightKg);

    return { 
        baseRate: baseFreight, 
        chargeZoneUsed: logicKey, 
        calculationFormula: `(${basic} + (${kilo} * CW))`,
        isApplicable: true,
        rateEntryUsed: entry
    };
};

const B2CStrategy = (data: any[], context: PricingContext, regionalData: any[]): Partial<CalculatedPriceItem> => {
    const { originLocation, destinationLocation, spendBand, chargeableWeightKg, isOurRates, uiServiceName } = context;
    const isPriority = uiServiceName.includes('Priority');
    let logicKey = '';
    
    if (isOurRates) {
        logicKey = `${isPriority ? 'B2CPriority' : 'B2CStandard'}${originLocation.prio}${destinationLocation.prio}`;
    } else {
        const lupKey = `${originLocation.prio}${destinationLocation.prio}`;
        const regional = regionalData.find(r => r.LUP === lupKey);
        if (!regional?.Journey) return { isApplicable: false, remarks: [`Journey mapping not found for key '${lupKey}'.`] };
        logicKey = `${spendBand}${regional.Journey}`;
    }

    const entry = findRateEntry(data, logicKey);
    if (!entry) return { isApplicable: false, remarks: [`No entry for B2C key '${logicKey}'.`] };

    let baseRate = 0;
    const r1 = parseSafeNum(entry[isPriority ? 'b2cp1' : 'b2c1']);
    const r3 = parseSafeNum(entry[isPriority ? 'b2cp3' : 'b2c3']);
    const r5 = parseSafeNum(entry[isPriority ? 'b2cp5' : 'b2c5']);
    const rKg = parseSafeNum(entry[isPriority ? 'pkg' : 'kg']);

    if (chargeableWeightKg <= 1) baseRate = r1;
    else if (chargeableWeightKg <= 3) baseRate = r3;
    else if (chargeableWeightKg <= 5) baseRate = r5;
    else baseRate = r5 + ((chargeableWeightKg - 5) * rKg);

    return { 
        baseRate, 
        chargeZoneUsed: logicKey, 
        isApplicable: true,
        rateEntryUsed: entry
    };
};

const PalletStrategy = (data: any[], context: PricingContext, pezoneData?: any[]): Partial<CalculatedPriceItem> => {
    const { originLocation, destinationLocation, chargeableWeightKg, isOurRates, uiServiceName } = context;
    
    const getPeZone = (loc: PostcodeData) => {
        if (!pezoneData) return null;
        const searchKey = `${loc.suburb.toUpperCase()} ${loc.state.toUpperCase()}`;
        return pezoneData.find(pz => String(pz["PE Suburb"] || "").toUpperCase() === searchKey)?.["PE Zone"];
    };

    const originZone = getPeZone(originLocation);
    const destZone = getPeZone(destinationLocation);

    if (!originZone || !destZone) return { isApplicable: false, remarks: ["Could not resolve PE Zone for origin or destination."] };

    const logicKey = isOurRates 
        ? `ParcelPallets${originZone.replace(/\s+/g, '')}${destZone.replace(/\s+/g, '')}`
        : `${originZone.replace(/\s+/g, '')}${destZone.replace(/\s+/g, '')}Express`;

    const entry = findRateEntry(data, logicKey, isOurRates ? 'Logic' : 'LUP');
    if (!entry) return { isApplicable: false, remarks: [`No pallet rate for key '${logicKey}'.`] };

    const prefix = uiServiceName.includes('Express') ? 'E' : 'G';
    const basic = parseSafeNum(entry[`${prefix}Basic`]);
    const min = parseSafeNum(entry[`${prefix}minimum`] || entry[`${prefix}Minimum`]);
    
    let kilo = 0;
    if (chargeableWeightKg <= 250) kilo = parseSafeNum(entry[`${prefix}0 - 250`]);
    else if (chargeableWeightKg <= 750) kilo = parseSafeNum(entry[`${prefix}251 - 750`]);
    else if (chargeableWeightKg <= 1500) kilo = parseSafeNum(entry[`${prefix}751 - 1500`]);
    else if (chargeableWeightKg <= 3000) kilo = parseSafeNum(entry[`${prefix}1501 - 3000`]);
    else if (chargeableWeightKg <= 5000) kilo = parseSafeNum(entry[`${prefix}3001 - 5000`]);
    else kilo = parseSafeNum(entry[`${prefix}5001 - 99999`]);

    const baseFreight = Math.max(basic + (kilo * chargeableWeightKg), min);
    return { 
        baseRate: baseFreight, 
        chargeZoneUsed: logicKey, 
        calculationFormula: `MAX((${basic} + (${kilo} * CW)), ${min})`,
        isApplicable: true,
        rateEntryUsed: entry
    };
};

const LCPGoStrategy = (data: any[], context: PricingContext): Partial<CalculatedPriceItem> => {
    const { totalDeadWeightKg, isOurRates, uiServiceName, chargeableWeightKg, spendBand } = context;
    if (totalDeadWeightKg > CONFIG.LCP_GO_WEIGHT_LIMIT) return { isApplicable: false, remarks: [`Out of Scope: Dead weight ${totalDeadWeightKg}kg exceeds 10.01kg.`] };

    const isPriority = uiServiceName.includes('Priority');
    const prefix = isPriority ? "GoOvernight" : "GoOff Peak";
    const logicKey = `${prefix}${context.originLocation.prio}${context.destinationLocation.prio}`;
    
    let entry = findRateEntry(data, logicKey);
    
    if (!entry && isOurRates) {
        const legacyKey = isPriority ? `GoOvernight${context.originLocation.prio}${context.destinationLocation.prio}` : `GoOff Peak${context.originLocation.prio}${context.destinationLocation.prio}`;
        entry = findRateEntry(data, legacyKey);
    }

    if (!entry) return { isApplicable: false, remarks: [`No LCP GO entry found for key '${logicKey}'.`] };

    // Check for dynamic Spend Band columns first (B1/K1 etc.)
    const basic = Number(entry[`B${spendBand}`]);
    const kilo = Number(entry[`K${spendBand}`]);

    if (!isNaN(basic) && !isNaN(kilo) && (basic > 0 || kilo > 0)) {
        return { 
            baseRate: (chargeableWeightKg * kilo) + basic, 
            chargeZoneUsed: logicKey, 
            isApplicable: true, 
            rateEntryUsed: entry,
            calculationFormula: `(B${spendBand}: ${basic} + (K${spendBand}: ${kilo} * CW: ${chargeableWeightKg.toFixed(2)}))`
        };
    }

    // Fallback to tiered logic
    let selected; 
    if (totalDeadWeightKg <= 1) selected = entry.Go1; 
    else if (totalDeadWeightKg <= 3) selected = entry.Go3; 
    else if (totalDeadWeightKg <= 5) selected = entry.Go5; 
    else if (totalDeadWeightKg <= 10) selected = entry.Go10;

    return typeof selected === 'number' ? { baseRate: selected, chargeZoneUsed: logicKey, isApplicable: true, rateEntryUsed: entry } : { isApplicable: false, remarks: ["Weight tier mismatch for LCP GO."] };
};

const WestEastStrategy = (data: any[], context: PricingContext): Partial<CalculatedPriceItem> => {
    const { originLocation, destinationLocation, chargeableWeightKg } = context;
    if (originLocation.prio !== 'PER') return { isApplicable: false, remarks: ["WA PE Special is only for PER zone origins."] };
    
    const cityMap: Record<string, string> = { "SYD": "SYDNEY", "MEL": "MELBOURNE", "BNE": "BRISBANE", "ADL": "ADELAIDE" };
    const destinationCity = cityMap[destinationLocation.prio];
    if (!destinationCity) return { isApplicable: false, remarks: ["No matching city found for destination PRIO zone."] };

    const entry = data.find(r => String(r.To || '').toUpperCase() === destinationCity);
    if (!entry) return { isApplicable: false, remarks: [`No rate for city '${destinationCity}' in west_east data.`] };

    const basic = parseSafeNum(entry.Basic);
    const min = parseSafeNum(entry.Minimum);
    const kilo = parseSafeNum(entry["0-99999KGS"] || entry.Kg);

    const baseFreight = Math.max(basic + (kilo * chargeableWeightKg), min);
    return {
        baseRate: baseFreight,
        chargeZoneUsed: `PER > ${destinationCity}`,
        calculationFormula: `MAX((${basic} + (${kilo} * CW)), ${min})`,
        isApplicable: true,
        rateEntryUsed: entry
    };
};

// --- MAIN ORCHESTRATOR ---

interface CalcOptions {
  formData: FreightFormValues;
  allServiceSettings: ServiceSettings[];
  allSurchargeDefinitions: SurchargeDefinition[];
  getRateFile: (type: RateFileType) => RateData | undefined;
  getAllRateFiles?: (type: RateFileType) => { accountNumber?: string, data: RateData }[];
  pezoneData?: PEZonesEntry[];
}

export const CUSTOMER_SERVICE_NAME_MAPPINGS: Partial<Record<ServiceName, string>> = {
  'B2B Std': 'Customer B2B Standard', 
  'B2B Priority': 'Customer B2B Priority', 
  'B2C Std': 'Customer B2C Standard', 
  'B2C Priority': 'Customer B2C Priority', 
  'B2B Pallets Express': 'Customer Pallet Express', 
  'B2B Pallets General Tiered': 'Customer Pallet General', 
  'WA PE Special': 'Customer WA PE Special', 
  'LCP Std': 'Customer LCP Standard', 
  'LCP Priority': 'Customer LCP Priority', 
  'LCP GO Std': 'Customer LCP GO Standard', 
  'LCP GO Priority': 'Customer LCP GO Priority',
};

export async function calculateAllFreightPrices(options: CalcOptions): Promise<CalculatedPriceItem[]> {
  const { formData, allServiceSettings, allSurchargeDefinitions, getRateFile, getAllRateFiles, pezoneData } = options;
  const { originLocation, destinationLocation, spendBand: uiSpendBand, items, globalNoCubic, applyGST, globalExtras, globalOnPallet, additionalPercentageType, additionalPercentageCustom } = formData;
  
  if (!originLocation || !destinationLocation) return [];

  const isOurRates = uiSpendBand === 'Customer Rates';
  const spendBand = isOurRates ? '1' : uiSpendBand;
  const results: CalculatedPriceItem[] = [];

  const rasData = getRateFile('ras') as RASRateEntry[] | undefined;

  for (const uiServiceName of formData.selectedServices) {
    const serviceConfig = allServiceSettings.find(s => s.id === uiServiceName);
    if (!serviceConfig) continue;

    let accountsToCalculate: { accountNumber?: string, data: RateData }[] = [];
    if (isOurRates && getAllRateFiles) {
        const fileTypeMap: Partial<Record<ServiceName, RateFileType>> = { 'B2B Std': 'customer_b2brdex', 'B2B Priority': 'customer_b2b_priority', 'B2C Std': 'customer_b2c', 'B2C Priority': 'customer_b2c', 'B2B Pallets Express': 'customer_pe', 'B2B Pallets General Tiered': 'customer_pe', 'WA PE Special': 'customer_west_east', 'LCP Std': 'customer_lcprdex', 'LCP Priority': 'customer_lcpprio', 'LCP GO Std': 'customer_lcpgo', 'LCP GO Priority': 'customer_lcpgo' };
        const baseFileType = fileTypeMap[uiServiceName];
        if (baseFileType) accountsToCalculate = getAllRateFiles(baseFileType);
    } else {
        const fileTypeMap: Partial<Record<ServiceName, RateFileType>> = { 'B2B Std': 'b2brdex', 'B2B Priority': 'b2b_priority', 'B2C Std': 'b2c', 'B2C Priority': 'b2c', 'B2B Pallets Express': `pe${spendBand}` as any, 'B2B Pallets General Tiered': `pe${spendBand}` as any, 'WA PE Special': 'west_east', 'LCP Std': 'lcprdex', 'LCP Priority': 'lcpprio', 'LCP GO Std': 'lcpgo', 'LCP GO Priority': 'lcpgo' };
        const data = getRateFile(fileTypeMap[uiServiceName] || 'b2brdex');
        if (data) accountsToCalculate = [{ data }];
    }

    for (const account of accountsToCalculate) {
        const context: PricingContext = {
            originLocation, destinationLocation, spendBand, isOurRates, uiServiceName,
            chargeableWeightKg: calculateChargeableWeight(items, uiServiceName.includes('Pallet') ? CONFIG.CUBIC_FACTORS.PALLET : CONFIG.CUBIC_FACTORS.PARCEL, globalNoCubic),
            totalDeadWeightKg: items.reduce((sum, i) => sum + ((i.weight || 0) * (i.quantity || 1)), 0)
        };

        let strategyResult: Partial<CalculatedPriceItem> = { isApplicable: false };

        if (uiServiceName === 'B2B Std') strategyResult = StandardParcelStrategy(account.data, context);
        else if (uiServiceName === 'LCP Std') strategyResult = LCPStandardStrategy(account.data, context);
        else if (uiServiceName === 'B2B Priority') strategyResult = PriorityParcelStrategy(account.data, context);
        else if (uiServiceName === 'LCP Priority') strategyResult = LCPPriorityStrategy(account.data, context);
        else if (uiServiceName.startsWith('B2C')) strategyResult = B2CStrategy(account.data, context, getRateFile('regionallookup') || []);
        else if (uiServiceName.includes('Pallet')) strategyResult = PalletStrategy(account.data, context, pezoneData);
        else if (uiServiceName.startsWith('LCP GO')) strategyResult = LCPGoStrategy(account.data, context);
        else if (uiServiceName === 'WA PE Special') strategyResult = WestEastStrategy(account.data, context);

        if (strategyResult.isApplicable && strategyResult.baseRate !== null) {
            const baseFreight = strategyResult.baseRate!;
            const otherSurcharges: Array<{ name: string; amount: number; id: string }> = [];
            const fuelPercent = serviceConfig.fuelSurchargePercent;
            const fuelAmount = baseFreight * (fuelPercent / 100);

            const secCfg = serviceConfig.surcharges.find(s => s.surchargeId === 'security' && s.enabled);
            if (secCfg) {
                const amount = (baseFreight + fuelAmount) * (secCfg.value / 100);
                otherSurcharges.push({ name: 'Security Surcharge', amount, id: 'security' });
            }

            if (RAS_APPLICABLE_SERVICES.includes(uiServiceName) && rasData) {
                const rasEntry = rasData.find(r => Number(r.postcode) === Number(destinationLocation.postcode) && String(r.suburb || '').trim().toUpperCase() === String(destinationLocation.suburb || '').trim().toUpperCase());
                if (rasEntry) {
                    const amount = (PRIORITY_MAPPED_SERVICES.includes(uiServiceName) || uiServiceName.includes('Priority')) ? rasEntry.prio : rasEntry.ipec;
                    if (amount > 0) otherSurcharges.push({ name: 'Remote Area Surcharge', amount, id: 'remote_area_surcharge' });
                }
            }

            const triggers: { key: keyof FreightFormValues, id: string }[] = [{ key: 'bookInDeliveryRequired', id: 'book_in_delivery_fee' }, { key: 'dangerousGoodsConsignment', id: 'dg_consignment_fee' }, { key: 'handUnloadRequired', id: 'hand_unload_fee' }, { key: 'tailLiftRequired', id: uiServiceName.includes('Pallet') ? 'tail_lift_pallet' : 'tail_lift_road_prio' }, { key: 'afterHoursCollection', id: 'after_hours_collection_fee' }, { key: 'afterHoursDelivery', id: 'after_hours_delivery_fee' }, { key: 'publicHolidayService', id: 'public_holiday_service_fee' }, { key: 'accountTransferRequired', id: 'account_transfer_fee' }];

            triggers.forEach(t => {
                if (formData[t.key]) {
                    const cfg = serviceConfig.surcharges.find(s => s.surchargeId === t.id && s.enabled);
                    if (cfg) {
                        const def = allSurchargeDefinitions.find(d => d.id === t.id);
                        let amount = cfg.value;
                        if (def?.type === 'percentage') amount = baseFreight * (cfg.value / 100);
                        else if (def?.type === 'fixed_per_kg') amount = cfg.value * context.chargeableWeightKg;
                        otherSurcharges.push({ name: def?.name || t.id, amount, id: t.id });
                    }
                }
            });

            // WA-specific pallet surcharges
            if (uiServiceName.includes('Pallet') && originLocation.state === "WA" && (destinationLocation.state === "WA" || destinationLocation.state === "NT")) {
                const exWaConsCfg = serviceConfig.surcharges.find(s => s.surchargeId === 'ex_wa_pickup_consignment_fee' && s.enabled);
                if (exWaConsCfg) {
                    otherSurcharges.push({ name: 'Ex WA Pickup Consignment Fee', amount: exWaConsCfg.value, id: 'ex_wa_pickup_consignment_fee' });
                }

                let exWaKgId = '';
                if (context.chargeableWeightKg <= 1000) exWaKgId = 'ex_wa_pickup_kg_rate_tier1';
                else if (context.chargeableWeightKg <= 3000) exWaKgId = 'ex_wa_pickup_kg_rate_tier2';
                else if (context.chargeableWeightKg <= 8000) exWaKgId = 'ex_wa_pickup_kg_rate_tier3';
                else exWaKgId = 'ex_wa_pickup_kg_rate_tier4';

                const exWaKgCfg = serviceConfig.surcharges.find(s => s.surchargeId === exWaKgId && s.enabled);
                if (exWaKgCfg) {
                    otherSurcharges.push({ name: 'Ex WA Pickup Kg Rate', amount: exWaKgCfg.value * context.chargeableWeightKg, id: exWaKgId });
                }
            }

            if (NON_PALLET_SERVICES.includes(uiServiceName) && !globalOnPallet) {
                let handling = 0;
                items.forEach(item => {
                    let h = 0;
                    const gt35 = serviceConfig.surcharges.find(s => s.surchargeId === 'manual_handling_gt35kg' && s.enabled);
                    const overLen = serviceConfig.surcharges.find(s => s.surchargeId === 'oversize_item_fee' && s.enabled);
                    const gt30 = serviceConfig.surcharges.find(s => s.surchargeId === 'manual_handling_gt30kg' && s.enabled);
                    if (gt35 && item.weight >= 35) h = Math.max(h, gt35.value);
                    if (item.length && item.length > 180) h = Math.max(h, overLen?.value || 0);
                    if (h === 0 && gt30 && item.weight > 30) h = Math.max(h, gt30.value);
                    handling += h * item.quantity;
                });
                if (handling > 0) otherSurcharges.push({ name: 'Oversize/Handling Fee', amount: handling, id: 'item_specific_handling_oversize_total' });
            }

            const totalSurcharges = fuelAmount + otherSurcharges.reduce((sum, s) => sum + s.amount, 0) + (globalExtras || 0);
            const subBeforeMarkup = baseFreight + totalSurcharges;
            const markup = additionalPercentageType === 'other' ? (parseSafeNum(additionalPercentageCustom) || 0) : parseSafeNum(additionalPercentageType);
            const markupAmount = subBeforeMarkup * (markup / 100);
            const subTotalBeforeGST = subBeforeMarkup + markupAmount;
            const finalPrice = subTotalBeforeGST + (applyGST ? subTotalBeforeGST * CONFIG.GST_RATE : 0);

            results.push({
                serviceName: isOurRates ? (CUSTOMER_SERVICE_NAME_MAPPINGS[uiServiceName] || `Customer ${uiServiceName}`) as any : uiServiceName,
                accountNumber: account.accountNumber,
                baseRate: baseFreight,
                chargeableWeight: context.chargeableWeightKg,
                chargeZoneUsed: strategyResult.chargeZoneUsed || "N/A",
                fuelSurchargeAmount: fuelAmount,
                fuelSurchargePercentApplied: fuelPercent,
                securitySurchargePercentApplied: secCfg?.value,
                otherSurcharges,
                totalSurcharges,
                totalExtrasAmount: globalExtras || 0,
                subTotalBeforeMarkupAndGST: subBeforeMarkup,
                additionalMarkupPercentApplied: markup,
                additionalMarkupAmount: markupAmount,
                subTotalBeforeGST,
                gstAmount: applyGST ? subTotalBeforeGST * CONFIG.GST_RATE : 0,
                finalPrice,
                remarks: strategyResult.remarks || [],
                isApplicable: true,
                calculationFormula: strategyResult.calculationFormula,
                rateEntryUsed: strategyResult.rateEntryUsed,
                originLocation: context.originLocation,
                destinationLocation: context.destinationLocation
            });
        } else {
            results.push({
                serviceName: isOurRates ? (CUSTOMER_SERVICE_NAME_MAPPINGS[uiServiceName] || `Customer ${uiServiceName}`) as any : uiServiceName,
                isApplicable: false,
                remarks: strategyResult.remarks || ["No rate entry found for this lane."],
                baseRate: null,
                chargeableWeight: context.chargeableWeightKg,
                chargeZoneUsed: strategyResult.chargeZoneUsed || "N/A",
                fuelSurchargeAmount: 0,
                otherSurcharges: [],
                totalSurcharges: 0,
                totalExtrasAmount: 0,
                subTotalBeforeMarkupAndGST: null,
                additionalMarkupPercentApplied: null,
                additionalMarkupAmount: null,
                subTotalBeforeGST: null,
                gstAmount: null,
                finalPrice: null
            });
        }
    }
  }

  if (formData.enableOtherRate) {
    const manualCW = calculateChargeableWeight(items, 250, globalNoCubic);
    const basic = parseSafeNum(formData.otherRateBasic);
    const kilo = parseSafeNum(formData.otherRateKilo);
    const min = parseSafeNum(formData.otherRateMin);
    const fuelPct = parseSafeNum(formData.otherRateFuelPercent);
    const secPct = parseSafeNum(formData.otherRateSecurityPercent);

    const baseFreight = Math.max(basic + (kilo * manualCW), min);
    const fuelAmount = baseFreight * (fuelPct / 100);
    const secAmount = (baseFreight + fuelAmount) * (secPct / 100);
    
    const otherSurcharges = [{ name: 'Manual Security Surcharge', amount: secAmount, id: 'manual_security' }];
    const totalSurcharges = fuelAmount + secAmount + (globalExtras || 0);
    const subBeforeMarkup = baseFreight + totalSurcharges;
    const markup = additionalPercentageType === 'other' ? (parseSafeNum(additionalPercentageCustom) || 0) : parseSafeNum(additionalPercentageType);
    const markupAmount = subBeforeMarkup * (markup / 100);
    const subTotalBeforeGST = subBeforeMarkup + markupAmount;
    const finalPrice = subTotalBeforeGST + (applyGST ? subTotalBeforeGST * CONFIG.GST_RATE : 0);

    results.push({
        serviceName: "Manual Rate" as any,
        isApplicable: true,
        baseRate: baseFreight,
        chargeableWeight: manualCW,
        chargeZoneUsed: "Manual",
        fuelSurchargeAmount: fuelAmount,
        fuelSurchargePercentApplied: fuelPct,
        securitySurchargePercentApplied: secPct,
        otherSurcharges,
        totalSurcharges,
        totalExtrasAmount: globalExtras || 0,
        subTotalBeforeMarkupAndGST: subBeforeMarkup,
        additionalMarkupPercentApplied: markup,
        additionalMarkupAmount: markupAmount,
        subTotalBeforeGST,
        gstAmount: applyGST ? subTotalBeforeGST * CONFIG.GST_RATE : 0,
        finalPrice,
        remarks: [],
        calculationFormula: `MAX((${basic} + (${kilo} * CW)), ${min})`
    });
  }

  return results;
}

function findBestCombination(w: number, tiers: number[]): { combo: number[], text: string } {
    const sortedTiers = [...tiers].sort((a, b) => b - a); 
    let remainingWeight = w; 
    const combo: number[] = [];
    
    for (const tier of sortedTiers) { 
        const count = Math.floor(remainingWeight / tier); 
        if (count > 0) { 
            for (let i = 0; i < count; i++) { 
                combo.push(tier); 
            } 
            remainingWeight %= tier; 
        } 
    }
    
    if (remainingWeight > 0) { 
        const smallestTierGreaterThanRemainder = [...tiers].sort((a, b) => a - b).find(t => t >= remainingWeight); 
        if (smallestTierGreaterThanRemainder) { 
            combo.push(smallestTierGreaterThanRemainder); 
        } else { 
            combo.push(sortedTiers[0]); 
        } 
    }
    
    const counts = combo.reduce((acc, val) => { 
        acc[val] = (acc[val] || 0) + 1; 
        return acc; 
    }, {} as Record<number, number>);
    
    const comboTextParts = Object.entries(counts).map(([tier, count]) => `${count}x ${tier}kg`);
    return { combo, text: comboTextParts.join(' & ') };
}

export async function calculateOptimizedRates(options: CalcOptions): Promise<IntelliSendResult> {
    const results = await calculateAllFreightPrices(options);
    const applicable = results.filter(r => r.isApplicable && r.finalPrice !== null);
    
    const findResult = (baseName: string) => applicable.find(r => (r.serviceName as string) === baseName || (r.serviceName as string) === `Customer ${baseName}` || r.serviceName === CUSTOMER_SERVICE_NAME_MAPPINGS[baseName as ServiceName]);

    let intelliSendResult: Partial<IntelliSendResult> = {
        isApplicable: applicable.length > 0,
        bestStdResult: applicable.find(r => r.serviceName.includes('Std')),
        bestPrioResult: applicable.find(r => r.serviceName.includes('Priority')),
        bestPalletResult: applicable.find(r => r.serviceName.includes('Pallet')),
        b2cStdPrice: findResult('B2C Std')?.finalPrice ?? null,
        b2cPriorityPrice: findResult('B2C Priority')?.finalPrice ?? null,
        lcpGoStdPrice: findResult('LCP GO Std')?.finalPrice ?? null,
        lcpGoPriorityPrice: findResult('LCP GO Priority')?.finalPrice ?? null,
    };

    // --- Combination Logic (IntelliSend) ---
    // Only attempt splitting if we have a single item (most common scenario for quick quotes)
    if (options.formData.items.length === 1) {
        const item = options.formData.items[0];
        const weight = item.weight || 0;

        // B2C Splitting (1, 3, 5kg tiers)
        const b2cCombo = findBestCombination(weight, [1, 3, 5]);
        let totalB2CStd = 0;
        let totalB2CPrio = 0;
        
        for (const splitWt of b2cCombo.combo) {
            const splitResults = await calculateAllFreightPrices({
                ...options,
                formData: { ...options.formData, items: [{ ...item, weight: splitWt }], selectedServices: ['B2C Std', 'B2C Priority'] }
            });
            const std = splitResults.find(r => r.serviceName.includes('B2C Std'));
            if (std?.finalPrice) totalB2CStd += std.finalPrice;
            const prio = splitResults.find(r => r.serviceName.includes('B2C Priority'));
            if (prio?.finalPrice) totalB2CPrio += prio.finalPrice;
        }

        // LCP GO Splitting (1, 3, 5, 10kg tiers)
        const goCombo = findBestCombination(weight, [1, 3, 5, 10]);
        let totalGoStd = 0;
        let totalGoPrio = 0;

        for (const splitWt of goCombo.combo) {
            const splitResults = await calculateAllFreightPrices({
                ...options,
                formData: { ...options.formData, items: [{ ...item, weight: splitWt }], selectedServices: ['LCP GO Std', 'LCP GO Priority'] }
            });
            const std = splitResults.find(r => r.serviceName.includes('LCP GO Std'));
            if (std?.finalPrice) totalGoStd += std.finalPrice;
            const prio = splitResults.find(r => r.serviceName.includes('LCP GO Priority'));
            if (prio?.finalPrice) totalGoPrio += prio.finalPrice;
        }

        intelliSendResult.b2cStdPrice = totalB2CStd || intelliSendResult.b2cStdPrice;
        intelliSendResult.b2cPriorityPrice = totalB2CPrio || intelliSendResult.b2cPriorityPrice;
        intelliSendResult.lcpGoStdPrice = totalGoStd || intelliSendResult.lcpGoStdPrice;
        intelliSendResult.lcpGoPriorityPrice = totalGoPrio || intelliSendResult.lcpGoPriorityPrice;
        intelliSendResult.combinationText = `B2C Split: ${b2cCombo.text} | LCP GO Split: ${goCombo.text}`;
    }

    return intelliSendResult as IntelliSendResult;
}

export const transformPdfDataToAppLogic = (rawData: any[], targetBU: string): any[] => {
    const data = Array.isArray(rawData) ? rawData : [rawData];
    
    if (targetBU === 'B2C') {
      return data.map(row => {
        const serviceRaw = String(row.Service || '').trim().toUpperCase();
        const from = String(row.From || '').trim().toUpperCase();
        const to = String(row.To || '').trim().toUpperCase();
        if (!from || !to) return null;
        
        const isPriority = serviceRaw.includes('PRIORITY');
        const serviceKey = isPriority ? 'B2CPriority' : 'B2CStandard';
        const logic = `${serviceKey}${from}${to}`;
        
        const r1 = parseSafeNum(row["Rate Break 1"] || row.b2c1 || row.b2cp1 || 0);
        const r2 = parseSafeNum(row["Rate Break 2"] || row.b2c3 || row.b2cp3 || 0);
        const r3 = parseSafeNum(row["Rate Break 3"] || row.b2c5 || row.b2cp5 || 0);
        const rKilo = parseSafeNum(row["Kilo Rate Thereafter"] || row.kg || row.pkg || 0);

        if (isPriority) {
          return { ...row, Logic: logic, Service: row.Service, b2cp1: r1, b2cp3: r2, b2cp5: r3, pkg: rKilo };
        } else {
          return { ...row, Logic: logic, Service: row.Service, b2c1: r1, b2c3: r2, b2c5: r3, kg: rKilo };
        }
      }).filter(Boolean);
    } 
    
    if (targetBU === 'Pallets') {
      return data.map(row => {
        const from = String(row.From || '').trim().toUpperCase();
        const to = String(row.To || '').trim().toUpperCase();
        if (!from || !to) return null;

        const logic = `ParcelPallets${from}${to}`;
        return {
          ...row,
          "Logic": logic,
          "From - To": logic,
          "From": from,
          "To": to,
          "EBasic": parseSafeNum(row.Basic || row.EBasic || 0),
          "Eminimum": parseSafeNum(row.Minimum || row.Eminimum || 0),
          "E0 - 250": parseSafeNum(row.Thereafter || row.Kilo || row["E0 - 250"] || 0),
          "E251 - 750": parseSafeNum(row.Thereafter || row.Kilo || row["E251 - 750"] || 0),
          "E751 - 1500": parseSafeNum(row.Thereafter || row.Kilo || row["E751 - 1500"] || 0),
          "E1501 - 3000": parseSafeNum(row.Thereafter || row.Kilo || row["E1501 - 3000"] || 0),
          "E3001 - 5000": parseSafeNum(row.Thereafter || row.Kilo || row["E3001 - 5000"] || 0),
          "E5001 - 99999": parseSafeNum(row.Thereafter || row.Kilo || row["E5001 - 99999"] || 0),
          "GBasic": parseSafeNum(row.Basic || row.GBasic || 0),
          "GMinimum": parseSafeNum(row.Minimum || row.GMinimum || 0),
          "G0 - 250": parseSafeNum(row.Thereafter || row.Kilo || row["G0 - 250"] || 0),
          "G251 - 750": parseSafeNum(row.Thereafter || row.Kilo || row["G251 - 750"] || 0),
          "G751 - 1500": parseSafeNum(row.Thereafter || row.Kilo || row["G751 - 1500"] || 0),
          "G1501 - 3000": parseSafeNum(row.Thereafter || row.Kilo || row["G1501 - 3000"] || 0),
          "G3001 - 5000": parseSafeNum(row.Thereafter || row.Kilo || row["G3001 - 5000"] || 0),
          "G5001 - 99999": parseSafeNum(row.Thereafter || row.Kilo || row["G5001 - 99999"] || 0),
        };
      }).filter(Boolean);
    }

    return data.map(entry => ({
        ...entry,
        Logic: entry.Logic || (entry.Origin && entry.Destination ? `${entry.Origin}${entry.Destination}` : undefined),
        B1: entry.Basic || entry.B1 || entry.LCPRDEXBasic || entry.LCPPrioBasic || 0,
        K1: entry.Kilo || entry.K1 || entry.Kg || entry.LCPRDEXKg || entry.LCPPrioKg || 0,
        M1: entry.Min || entry.M1 || entry.Minimum || 0
    }));
};
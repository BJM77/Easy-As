import type {
  FreightFormValues,
  CalculatedPriceItem,
  ServiceSettings,
  SurchargeDefinition,
  B2CRateEntry,
  RegionalLookupEntry,
  LCPRdexRateEntry,
  LCPPrioRateEntry,
  LCPGoRateEntry,
  B2BPriorityRateEntry,
  B2BRdexEntry,
  TieredPalletRateEntry,
  ServiceName,
  FreightItem,
  B2BStdRateEntry,
  PEZonesEntry,
  WestEastRateEntry,
  RASRateEntry,
  PostcodeData,
  RateFileType,
  RateData,
  IntelliSendResult
} from './types';
import { ALL_SERVICES, PALLET_LIKE_SERVICES, PALLET_SERVICES, PRIORITY_MAPPED_SERVICES, RAS_APPLICABLE_SERVICES, LCP_SERVICES, STANDARD_ROAD_MAPPED_SERVICES, SECURITY_APPLICABLE_SERVICES, NON_PALLET_SERVICES } from './types';

/**
 * @fileOverview Refactored Pricing Engine v5.1.0
 * FIXED: LCP GO products now correctly include Fuel and Security Surcharges per user request.
 * FIXED: LCP GO products now correctly incur Remote Area Surcharges (RAS) when applicable.
 * FIXED: Restored Markup calculation logic for additional margins.
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

const roundUp = (num: number, decimalPlaces: number = 0): number => {
  const factor = Math.pow(10, decimalPlaces);
  return Math.ceil(num * factor) / factor;
};

function findRateEntry(data: any[] | undefined, key: string, keyField: string = 'Logic'): any | undefined {
  if (!data || !Array.isArray(data) || !key) return undefined;
  const upperKey = key.toUpperCase();
  const exactMatch = data.find(r => String(r[keyField] || '').toUpperCase() === upperKey);
  if (exactMatch) return exactMatch;
  const cleanKey = key.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  return data.find(r => String(r[keyField] || '').replace(/[^A-Z0-9]/gi, '').toUpperCase() === cleanKey);
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
    const prefix = 'Parcel';
    const logicKey = `${prefix}${originLocation.ipec}${destinationLocation.ipec}`;
    const entry = findRateEntry(data, logicKey);
    if (!entry) return { isApplicable: false, remarks: [`No entry for ${logicKey} in RDEX file.`] };

    const basic = Number(entry[isOurRates ? 'B1' : `B${spendBand}`]); 
    const kilo = Number(entry[isOurRates ? 'K1' : `K${spendBand}`]); 
    const min = Number(entry[isOurRates ? 'M1' : `M${spendBand}`]);
    
    if (isNaN(basic) || isNaN(kilo)) return { isApplicable: false, remarks: ["Invalid rate fields in data file."] };

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
    if (!entry) return { isApplicable: false, remarks: [`No entry for ${logicKey} in Priority file.`] };

    const basic = Number(entry[isOurRates ? 'B1' : `B${spendBand}`]); 
    const kilo = Number(entry[isOurRates ? 'K1' : `K${spendBand}`]); 
    
    if (isNaN(basic) || isNaN(kilo)) return { isApplicable: false, remarks: ["Invalid rate fields in data file."] };

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
    const { originLocation, destinationLocation, chargeableWeightKg, isOurRates } = context;
    const prefix = isOurRates ? 'Parcel' : 'LCPRDEX';
    const logicKey = `${prefix}${originLocation.ipec}${destinationLocation.ipec}`;
    const entry = findRateEntry(data, logicKey);
    if (!entry) return { isApplicable: false, remarks: [`No entry for ${logicKey} in LCP Std file.`] };

    const basicField = isOurRates ? 'B1' : 'LCPRDEXBasic';
    const kiloField = isOurRates ? 'K1' : 'LCPRDEXKg';

    const basic = Number(entry[basicField]);
    const kilo = Number(entry[kiloField]);

    if (isNaN(basic) || isNaN(kilo)) return { isApplicable: false, remarks: ["Invalid LCP Std rate fields."] };

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
    const { originLocation, destinationLocation, chargeableWeightKg, isOurRates } = context;
    const prefix = isOurRates ? 'Parcel' : 'LCPPrio';
    const logicKey = `${prefix}${originLocation.prio}${destinationLocation.prio}`;
    const entry = findRateEntry(data, logicKey);
    if (!entry) return { isApplicable: false, remarks: [`No entry for ${logicKey} in LCP Priority file.`] };

    const basicField = isOurRates ? 'B1' : 'LCPPrioBasic';
    const kiloField = isOurRates ? 'K1' : 'LCPPrioKg';

    const basic = Number(entry[basicField]);
    const kilo = Number(entry[kiloField]);

    if (isNaN(basic) || isNaN(kilo)) return { isApplicable: false, remarks: ["Invalid LCP Priority rate fields."] };

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
        if (!regional?.Journey) return { isApplicable: false, remarks: [`Journey mapping not found for ${lupKey}.`] };
        logicKey = `${spendBand}${regional.Journey}`;
    }

    const entry = findRateEntry(data, logicKey);
    if (!entry) return { isApplicable: false, remarks: [`No rate entry found for ${logicKey}.`] };

    let baseRate = 0;
    const r1 = Number(entry[isPriority ? 'b2cp1' : 'b2c1']);
    const r3 = Number(entry[isPriority ? 'b2cp3' : 'b2c3']);
    const r5 = Number(entry[isPriority ? 'b2cp5' : 'b2c5']);
    const rKg = Number(entry[isPriority ? 'pkg' : 'kg']);

    if (chargeableWeightKg <= 1) baseRate = r1;
    else if (chargeableWeightKg <= 3) baseRate = r3;
    else if (chargeableWeightKg <= 5) baseRate = r5;
    else baseRate = r5 + ((chargeableWeightKg - 5) * rKg);

    return { 
        baseRate, 
        chargeZoneUsed: logicKey, 
        calculationFormula: `Tiered B2C logic for ${chargeableWeightKg}kg`,
        isApplicable: true,
        rateEntryUsed: entry
    };
};

const PalletStrategy = (data: any[], context: PricingContext, pezoneData?: any[]): Partial<CalculatedPriceItem> => {
    const { originLocation, destinationLocation, chargeableWeightKg, isOurRates, uiServiceName } = context;
    
    const getPeZone = (loc: PostcodeData) => {
        if ((loc as any).isZoneDirect) return loc.suburb;
        const key = (loc.suburb.toUpperCase().replace(/\s+/g, '') + loc.postcode).trim();
        return pezoneData?.find(pz => pz["Combined"]?.trim().toUpperCase() === key)?.["PE Zone"];
    };

    const originZone = getPeZone(originLocation);
    const destZone = getPeZone(destinationLocation);

    if (!originZone || !destZone) return { isApplicable: false, remarks: ["Could not resolve PE Zone for origin or destination."] };

    const logicKey = isOurRates 
        ? `ParcelPallets${originZone.replace(/\s+/g, '')}${destZone.replace(/\s+/g, '')}`
        : `${originZone.replace(/\s+/g, '')}${destZone.replace(/\s+/g, '')}Express`;

    const entry = findRateEntry(data, logicKey, isOurRates ? 'Logic' : 'LUP');
    if (!entry) return { isApplicable: false, remarks: [`No pallet rate found for ${logicKey}.`] };

    const prefix = uiServiceName.includes('Express') ? 'E' : 'G';
    const basic = Number(entry[`${prefix}Basic`]);
    const min = Number(entry[`${prefix}minimum` || `${prefix}Minimum`]);
    
    let kilo = 0;
    if (chargeableWeightKg <= 250) kilo = Number(entry[`${prefix}0 - 250`]);
    else if (chargeableWeightKg <= 750) kilo = Number(entry[`${prefix}251 - 750`]);
    else if (chargeableWeightKg <= 1500) kilo = Number(entry[`${prefix}751 - 1500`]);
    else if (chargeableWeightKg <= 3000) kilo = Number(entry[`${prefix}1501 - 3000`]);
    else if (chargeableWeightKg <= 5000) kilo = Number(entry[`${prefix}3001 - 5000`]);
    else kilo = Number(entry[`${prefix}5001 - 99999`]);

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
    const { totalDeadWeightKg, isOurRates, uiServiceName, chargeableWeightKg } = context;
    if (totalDeadWeightKg > CONFIG.LCP_GO_WEIGHT_LIMIT) return { isApplicable: false, remarks: [`Out of Scope: ${totalDeadWeightKg}kg > 10.01kg`] };

    const isPriority = uiServiceName.includes('Priority');
    const prefix = isPriority ? "GoOvernight" : "GoOff Peak";
    const logicKey = `${prefix}${context.originLocation.prio}${context.destinationLocation.prio}`;
    
    let entry = findRateEntry(data, logicKey);
    
    if (!entry && isOurRates) {
        const legacyKey = isPriority 
            ? `LCPGOPriority${context.originLocation.prio}${context.destinationLocation.prio}` 
            : `LCPGOStandard${context.originLocation.prio}${context.destinationLocation.prio}`;
        entry = findRateEntry(data, legacyKey);
    }

    if (!entry) return { isApplicable: false, remarks: [`No LCP GO rate for ${logicKey}.`] };

    if (isOurRates && entry.B1 !== undefined) {
        const basic = Number(entry.B1 || entry.LCPRDEXBasic || 0); 
        const kilo = Number(entry.K1 || entry.LCPRDEXKg || 0);
        return { baseRate: (chargeableWeightKg * kilo) + basic, chargeZoneUsed: entry.Logic || logicKey, isApplicable: true, rateEntryUsed: entry };
    }

    let selected; 
    if (totalDeadWeightKg <= 1) selected = entry.Go1; 
    else if (totalDeadWeightKg <= 3) selected = entry.Go3; 
    else if (totalDeadWeightKg <= 5) selected = entry.Go5; 
    else if (totalDeadWeightKg <= 10) selected = entry.Go10;

    return typeof selected === 'number' ? { baseRate: selected, chargeZoneUsed: logicKey, isApplicable: true, rateEntryUsed: entry } : { isApplicable: false };
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

  // Calculate Markup Percentage
  let additionalMarkupActualPercent = 0;
  if (additionalPercentageType !== 'none') {
    if (additionalPercentageType === 'other') {
      additionalMarkupActualPercent = Number(additionalPercentageCustom) || 0;
    } else {
      additionalMarkupActualPercent = Number(additionalPercentageType) || 0;
    }
  }

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

        if (strategyResult.isApplicable && strategyResult.baseRate !== null) {
            const baseFreight = strategyResult.baseRate!;
            const otherSurcharges: Array<{ name: string; amount: number; id: string }> = [];

            // 1. Fuel Surcharge
            const fuelPercent = serviceConfig.fuelSurchargePercent;
            const fuelAmount = baseFreight * (fuelPercent / 100);

            // 2. Security Surcharge (Apply to Base + Fuel)
            const secCfg = serviceConfig.surcharges.find(s => s.surchargeId === 'security' && s.enabled);
            if (secCfg) {
                const amount = (baseFreight + fuelAmount) * (secCfg.value / 100);
                otherSurcharges.push({ name: 'Security Surcharge', amount, id: 'security' });
            }

            // 3. Remote Area Surcharge (RAS)
            if (RAS_APPLICABLE_SERVICES.includes(uiServiceName) && rasData) {
                const rasEntry = rasData.find(r => 
                    Number(r.postcode) === Number(destinationLocation.postcode) && 
                    String(r.suburb || '').trim().toUpperCase() === String(destinationLocation.suburb || '').trim().toUpperCase()
                );

                if (rasEntry) {
                    const isPrioBased = PRIORITY_MAPPED_SERVICES.includes(uiServiceName) || uiServiceName.includes('Priority');
                    const amount = isPrioBased ? rasEntry.prio : rasEntry.ipec;
                    if (amount > 0) otherSurcharges.push({ name: 'Remote Area Surcharge', amount, id: 'remote_area_surcharge' });
                }
            }

            // 4. Triggered Surcharges (DG, Tail Lift, etc.)
            const triggers: { key: keyof FreightFormValues, id: string }[] = [
                { key: 'bookInDeliveryRequired', id: 'book_in_delivery_fee' },
                { key: 'dangerousGoodsConsignment', id: 'dg_consignment_fee' },
                { key: 'handUnloadRequired', id: 'hand_unload_fee' },
                { key: 'tailLiftRequired', id: uiServiceName.includes('Pallet') ? 'tail_lift_pallet' : 'tail_lift_road_prio' },
                { key: 'afterHoursCollection', id: 'after_hours_collection_fee' },
                { key: 'afterHoursDelivery', id: 'after_hours_delivery_fee' },
                { key: 'publicHolidayService', id: 'public_holiday_service_fee' },
                { key: 'accountTransferRequired', id: 'account_transfer_fee' },
            ];

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

            // 5. Item-Specific Handling & Oversize
            if (NON_PALLET_SERVICES.includes(uiServiceName) && !globalOnPallet && !uiServiceName.toLowerCase().includes('pallet')) {
                let accumulatedHandling = 0;
                items.forEach(item => {
                    const gt35 = serviceConfig.surcharges.find(s => s.surchargeId === 'manual_handling_gt35kg' && s.enabled);
                    const overLen = serviceConfig.surcharges.find(s => s.surchargeId === 'oversize_item_fee' && s.enabled);
                    const gt30 = serviceConfig.surcharges.find(s => s.surchargeId === 'manual_handling_gt30kg' && s.enabled);
                    const mh_120 = serviceConfig.surcharges.find(s => s.surchargeId === 'manual_handling_120_179' && s.enabled);

                    let oversizeTierValue = 0;
                    if (gt35 && item.weight >= 35) oversizeTierValue = Math.max(oversizeTierValue, gt35.value);
                    if (overLen && (item.length >= 180 || item.width >= 180)) oversizeTierValue = Math.max(oversizeTierValue, overLen.value);

                    let manualHandlingTierValue = 0;
                    if (gt30 && item.weight >= 30 && item.weight < 35) manualHandlingTierValue = Math.max(manualHandlingTierValue, gt30.value);
                    if (mh_120 && ((item.length >= 120 && item.length < 180) || (item.width >= 120 && item.width < 180))) manualHandlingTierValue = Math.max(manualHandlingTierValue, mh_120.value);

                    const highestApplicable = Math.max(oversizeTierValue, manualHandlingTierValue);
                    accumulatedHandling += highestApplicable * item.quantity;
                });

                if (accumulatedHandling > 0) {
                    otherSurcharges.push({ name: 'Oversize/Handling Fee', amount: accumulatedHandling, id: 'item_specific_handling_oversize_total' });
                }
            }

            const totalOther = otherSurcharges.reduce((sum, s) => sum + s.amount, 0);
            const totalSurcharges = fuelAmount + totalOther + (globalExtras || 0);
            const subBeforeMarkup = baseFreight + totalSurcharges;
            
            // Apply Markup
            const markupAmount = subBeforeMarkup * (additionalMarkupActualPercent / 100);
            const subTotalBeforeGST = subBeforeMarkup + markupAmount;
            const gstAmount = applyGST ? subTotalBeforeGST * CONFIG.GST_RATE : 0;
            const finalPrice = subTotalBeforeGST + gstAmount;

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
                additionalMarkupPercentApplied: additionalMarkupActualPercent,
                additionalMarkupAmount: markupAmount,
                subTotalBeforeGST: subTotalBeforeGST,
                gstAmount: gstAmount,
                finalPrice: finalPrice,
                remarks: strategyResult.remarks || [],
                isApplicable: true,
                calculationFormula: strategyResult.calculationFormula,
                rateEntryUsed: strategyResult.rateEntryUsed
            });
        }
    }
  }
  return results;
}

export async function calculateOptimizedRates(options: CalcOptions): Promise<IntelliSendResult> {
    const results = await calculateAllFreightPrices(options);
    const applicable = results.filter(r => r.isApplicable);
    
    const findFinalPrice = (baseName: string) => {
      const match = applicable.find(r => 
        r.serviceName === baseName || 
        r.serviceName === `Customer ${baseName}` ||
        r.serviceName === CUSTOMER_SERVICE_NAME_MAPPINGS[baseName as ServiceName]
      );
      return match?.finalPrice;
    };

    return {
        isApplicable: applicable.length > 0,
        bestStdResult: applicable.find(r => r.serviceName.includes('Std')),
        bestPrioResult: applicable.find(r => r.serviceName.includes('Priority')),
        bestPalletResult: applicable.find(r => r.serviceName.includes('Pallet')),
        b2cStdPrice: findFinalPrice('B2C Std'),
        b2cPriorityPrice: findFinalPrice('B2C Priority'),
        lcpGoStdPrice: findFinalPrice('LCP GO Std'),
        lcpGoPriorityPrice: findFinalPrice('LCP GO Priority'),
    };
}

export const transformPdfDataToAppLogic = (rawData: any[], targetBU: string): any[] => {
    return rawData.map(entry => ({
        ...entry,
        Logic: entry.Logic || `${entry.Origin}${entry.Destination}`,
        B1: entry.Basic || entry.B1,
        K1: entry.Kilo || entry.K1,
        M1: entry.Min || entry.M1
    }));
};

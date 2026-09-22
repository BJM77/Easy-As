'use server';
/**
 * @fileOverview Elite Two-Phase AI Quote Agent (Logic v3.0.0).
 * 
 * 1. INTERPRETER PHASE: AI extracts intent/parameters with confidence scoring.
 * 2. EXECUTOR PHASE: Deterministic TypeScript logic orchestrates tools and formatting.
 * 
 * UPDATED: Integrated with Enterprise Token Deduction system.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fs from 'fs/promises';
import path from 'path';
import { QuoteAgentOutputSchema, type QuoteAgentOutput, type PostcodeData, type FreightFormValues } from '@/lib/types';
import { calculateAllFreightPrices } from '@/lib/freightCalculations';
import { logAiUsage } from '@/lib/aiUsage';

// --- SCHEMAS ---

const IntentSchema = z.object({
  originQuery: z.string().nullable().describe("Extracted origin location string."),
  destinationQuery: z.string().nullable().describe("Extracted destination location string."),
  items: z.array(z.object({
    weight: z.number(),
    quantity: z.number().default(1)
  })).describe("List of all items mentioned."),
  confidence: z.number().min(0).max(1).describe("Self-assigned confidence score (0-1)."),
  isQuoteRequest: z.boolean().describe("True if the user is asking for a price/quote.")
}).passthrough();

const QuoteAgentInputSchema = z.object({
  query: z.string().describe("The user's natural language request."),
  history: z.array(z.object({
    role: z.enum(['user', 'model']),
    content: z.string()
  })).optional().describe("Previous conversation turns for context."),
  spendBand: z.string().default("1"),
  companyId: z.string().optional(),
  userId: z.string().optional(),
});
export type QuoteAgentInput = z.infer<typeof QuoteAgentInputSchema>;

// --- CACHING LAYER ---

const jsonCache: Record<string, any> = {};
const intentCache = new Map<string, z.infer<typeof IntentSchema>>();
const knowledgeCache = new Map<string, any>();

async function loadServerJson(fileName: string) {
  if (jsonCache[fileName]) return jsonCache[fileName];
  const pathsToTry = [
    path.join(process.cwd(), 'public', fileName),
    path.join(process.cwd(), 'src', 'public', fileName),
  ];
  for (const filePath of pathsToTry) {
    try {
      await fs.access(filePath);
      const content = await fs.readFile(filePath, 'utf8');
      const data = JSON.parse(content);
      jsonCache[fileName] = data;
      return data;
    } catch (e) { continue; }
  }
  return fileName.includes('settings') ? {} : [];
}

// --- TOOLS ---

const findPostcodeTool = async (queryStr: string | null) => {
  if (!queryStr) return [];
  try {
    const allPostcodes = await loadServerJson('postcodes.json');
    const q = queryStr.toLowerCase().trim();
    if (!Array.isArray(allPostcodes)) return [];
    return allPostcodes.filter((p: any) => 
      String(p.suburb || '').toLowerCase().includes(q) || 
      String(p.postcode || '') === q
    ).slice(0, 5);
  } catch (err) { return []; }
};

const getFreightQuoteTool = async (input: { origin: any, destination: any, items: any[], spendBand: string }) => {
  try {
    const [settings, b2c, regional, lcprdex, lcpprio, lcpgo, b2bprio, b2brdex, pezone, west_east, ras] = await Promise.all([
      loadServerJson('settings.json'), loadServerJson('b2c.json'), loadServerJson('regionallookup.json'),
      loadServerJson('lcprdex.json'), loadServerJson('lcpprio.json'), loadServerJson('lcpgo.json'),
      loadServerJson('b2b_priority.json'), loadServerJson('b2brdex.json'), loadServerJson('PEZones.json'),
      loadServerJson('west_east.json'), loadServerJson('ras.json'),
    ]);

    const formData: FreightFormValues = {
      spendBand: input.spendBand,
      originLocation: input.origin as PostcodeData,
      destinationLocation: input.destination as PostcodeData,
      originQuery: `${input.origin.suburb} ${input.origin.postcode}`,
      destinationQuery: `${input.destination.suburb} ${input.destination.postcode}`,
      items: input.items,
      globalNoCubic: false, globalOnPallet: false, applyGST: true,
      selectedServices: ['B2B Std', 'B2B Priority', 'B2C Std', 'B2C Priority', 'LCP Std'],
      additionalPercentageType: 'none',
      accountTransferRequired: false, afterHoursCollection: false, afterHoursDelivery: false,
      publicHolidayService: false, bookInDeliveryRequired: false, dangerousGoodsConsignment: false,
      handUnloadRequired: false, routeViaMelbourne: false, tailLiftRequired: false,
    };

    return await calculateAllFreightPrices({
      formData, 
      allServiceSettings: settings?.serviceSettings || [], 
      allSurchargeDefinitions: settings?.surchargeDefinitions || [],
      getRateFile: (type) => ({ b2c, regionallookup: regional, lcprdex, lcpprio, lcpgo, b2b_priority: b2bprio, b2brdex, pezone, west_east, ras }[type]),
      pezoneData: pezone
    });
  } catch (err) { 
    console.error("[getFreightQuoteTool] Error:", err);
    return []; 
  }
};

const getTransitTimeTool = async (input: { originState: string, destinationState: string, serviceType: string }) => {
  const key = `transit-${input.originState}-${input.destinationState}-${input.serviceType}`;
  if (knowledgeCache.has(key)) return knowledgeCache.get(key);
  let days = '2-3 Days';
  if (input.originState === input.destinationState) days = input.serviceType === 'Priority' ? 'Overnight' : '1-2 Days';
  knowledgeCache.set(key, days);
  return days;
};

// --- PHASE 1: INTERPRETER PROMPT ---

const interpreterPrompt = ai.definePrompt({
  name: 'interpreterPrompt',
  input: { schema: z.object({ 
    query: z.string(),
    history: z.array(z.object({ role: z.string(), content: z.string() })).optional()
  }) },
  output: { schema: IntentSchema },
  prompt: `You are the Interpreter for Freight assist.online, a professional logistics intelligence platform.
  
  HISTORY:
  {{#each history}}
  {{role}}: {{content}}
  {{/each}}

  TASK:
  Parse the user's latest natural language freight request and extract parameters.
  
  CONTEXT AWARENESS:
  - If the user provides a follow-up (e.g. "Now make it 20kg" or "What if it's express?"), use the HISTORY to resolve missing origin/destination.
  - If the user mentions a specific choice from a previous turn (e.g. "Option 2"), use the history to resolve it.

  FIELD EXTRACTION:
  1. Origin (suburb and/or postcode)
  2. Destination (suburb and/or postcode)
  3. Items (weight in kg and quantity)
  
  Instructions:
  - Extract the origin and destination as clean strings (e.g. "Perth 6000").
  - For items, always try to find a weight. If no quantity is mentioned, default to 1.
  - Set 'isQuoteRequest' to true if the user is asking for pricing, cost, or a quote.
  - Assign a confidence score (0 to 1).
  
  User Query: "{{query}}"`
});

// --- ELITE AGENT FLOW ---

export async function processQuoteQuery(input: QuoteAgentInput): Promise<QuoteAgentOutput> {
  const version = "v3.0.0";
  const normalizedQuery = input.query.toLowerCase().trim();
  const cacheKey = `${input.companyId || 'global'}-${normalizedQuery}`;

  try {
    // 1. INTERPRETATION (With Caching)
    let intent = intentCache.get(cacheKey);
    let usage: any = { totalTokens: 0, inputTokens: 0, outputTokens: 0 };

    if (!intent) {
      console.log(`[Phase 1] Conversational Interpretation: "${normalizedQuery}"`);
      const response = await interpreterPrompt({ 
        query: normalizedQuery,
        history: input.history || []
      });
      if (!response.output) throw new Error("AI failed to produce intent.");
      intent = response.output;
      usage = response.usage;
      // No caching for conversational queries as they are context-dependent
    }

    // 2. FALLBACK TO HUMAN (Low Confidence / Missing Info)
    if (intent.confidence < 0.6 || !intent.originQuery || !intent.destinationQuery) {
      console.warn(`[Phase 2] Low confidence (${intent.confidence}) or missing info. Falling back to human.`);
      return {
        summary: "I'm missing some details. Could you please specify both the origin and destination, and the weight of the items?",
        warnings: ["Low confidence or missing information."],
        results: [],
        rawIntent: intent
      };
    }

    // 3. EXECUTION (Deterministic Tool Orchestration)
    if (!intent.originQuery || !intent.destinationQuery) {
      return {
        summary: "I couldn't identify the origin and destination in your request.",
        warnings: ["Missing location data"],
        results: [],
        rawIntent: intent
      };
    }

    const [origins, dests] = await Promise.all([
      findPostcodeTool(intent.originQuery),
      findPostcodeTool(intent.destinationQuery)
    ]);

    // AMBIGUITY DETECTION
    if ((origins.length > 1 && intent.originQuery) || (dests.length > 1 && intent.destinationQuery)) {
        const choices: any[] = [];
        if (origins.length > 1) {
            origins.forEach((p: any) => choices.push({ id: String(p.postcode), label: `${p.suburb} ${p.state} ${p.postcode}`, type: 'origin' }));
        }
        if (dests.length > 1) {
            dests.forEach((p: any) => choices.push({ id: String(p.postcode), label: `${p.suburb} ${p.state} ${p.postcode}`, type: 'destination' }));
        }

        return {
            summary: `I found multiple locations matching your request. Please clarify which one you mean.`,
            isAmbiguous: true,
            choices,
            rawIntent: intent
        };
    }

    if (origins.length === 0 || dests.length === 0) {
      return {
        summary: `I couldn't map "${origins.length === 0 ? intent.originQuery : intent.destinationQuery}" to a known zone.`,
        warnings: [`Origin search: ${intent.originQuery} (${origins.length} found), Dest search: ${intent.destinationQuery} (${dests.length} found).`],
        results: [],
        rawIntent: intent
      };
    }

    const pricingResults = await getFreightQuoteTool({
      origin: origins[0],
      destination: dests[0],
      items: intent.items,
      spendBand: input.spendBand
    });

    // 4. FORMATTING & TRANSIT ENRICHMENT
    const formattedResults = await Promise.all(pricingResults.map(async (r) => {
      const transit = await getTransitTimeTool({
        originState: origins[0].state,
        destinationState: dests[0].state,
        serviceType: String(r.serviceName || '').includes('Priority') ? 'Priority' : 'Standard'
      });

      return {
        serviceName: r.serviceName,
        price: r.finalPrice,
        isBestValue: false, 
        transitTime: transit,
        breakdown: {
          baseRate: r.baseRate,
          fuelSurcharge: r.fuelSurchargeAmount,
          gst: r.gstAmount,
          formula: r.calculationFormula
        }
      };
    }));

    const finalOutput: QuoteAgentOutput = {
      summary: `Pricing for ${intent.items.map(i => `${i.quantity}x ${i.weight}kg`).join(', ')} from ${origins[0].suburb} to ${dests[0].suburb}.`,
      results: formattedResults,
      rawIntent: intent,
      resolvedInput: {
        spendBand: input.spendBand,
        originQuery: `${origins[0].suburb} ${origins[0].postcode}`,
        originLocation: origins[0],
        destinationQuery: `${dests[0].suburb} ${dests[0].postcode}`,
        destinationLocation: dests[0],
        items: intent.items,
        globalNoCubic: false, globalOnPallet: false, applyGST: true,
        selectedServices: ['B2B Std', 'B2B Priority', 'B2C Std', 'B2C Priority', 'LCP Std'],
        additionalPercentageType: 'none',
        accountTransferRequired: false, afterHoursCollection: false, afterHoursDelivery: false,
        publicHolidayService: false, bookInDeliveryRequired: false, dangerousGoodsConsignment: false,
        handUnloadRequired: false, routeViaMelbourne: false, tailLiftRequired: false,
      },
      warnings: intent.confidence < 0.8 ? ["AI interpretation confidence is low. Please verify locations."] : []
    };

    // QUOTA ENFORCEMENT: Deduct tokens and log usage
    if (input.userId) {
        await logAiUsage('AI Quote Agent', usage, { 
            userId: input.userId, 
            companyId: input.companyId,
            metadata: { version, confidence: intent.confidence } 
        });
    }

    return finalOutput;

  } catch (error: any) {
    const errorMsg = error.message || 'Unknown server error';
    console.error("Quote Agent Execution Critical Failure:", error);
    
    if (errorMsg.includes('429') || errorMsg.toLowerCase().includes('quota')) {
      return {
        summary: "The AI service is currently at its limit. Please try again in 60 seconds.",
        results: [],
        warnings: ["AI Service Quota Exceeded (429). Please wait before retrying."],
        suggestedAction: "Please use the manual Freight Calculator for urgent quotes."
      };
    }

    return {
      summary: "I encountered a technical issue while processing your request.",
      results: [],
      warnings: [`System execution failure: ${errorMsg}`],
      suggestedAction: "Please use the manual Freight Calculator."
    };
  }
}

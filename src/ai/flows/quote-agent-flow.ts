'use server';
/**
 * @fileOverview Elite Two-Phase AI Quote Agent (Logic v12.0.0).
 *
 * FIXES applied in this version:
 *  1. API key now read exclusively from server-side GEMINI_API_KEY env var.
 *     The NEXT_PUBLIC_ prefix is client-only and is NOT available in server
 *     actions at runtime (hosted environments). Callers can also pass an
 *     apiKey override which is forwarded to a scoped Genkit instance.
 *  2. settings.json never existed. Settings (serviceSettings, surchargeDefinitions)
 *     are now accepted as flow input, passed in from the client via useSettings().
 *  3. apiKey override parameter is now actually used (previously accepted but ignored).
 *  4. Conversation history is threaded through the prompt so the model has
 *     multi-turn memory.
 */

import { buildAi } from '@/ai/genkit';
import { z } from 'genkit';
import {
  QuoteAgentOutputSchema,
  type QuoteAgentOutput,
  type PostcodeData,
  type FreightFormValues,
  type ServiceSettings,
  type SurchargeDefinition,
} from '@/lib/types';
import { calculateAllFreightPrices } from '@/lib/freightCalculations';
import { logAiUsage } from '@/lib/aiUsage';
import fs from 'fs/promises';
import path from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface QuoteQueryInput {
  query: string;
  /** Full prior conversation for multi-turn context */
  history?: ChatMessage[];
  userId?: string;
  companyId?: string;
  /** Optional key override (e.g. from admin settings panel) */
  apiKey?: string;
  /** Passed from useSettings() — replaces the missing settings.json */
  serviceSettings?: ServiceSettings[];
  surchargeDefinitions?: SurchargeDefinition[];
}

// ---------------------------------------------------------------------------
// Schema for intent extraction
// ---------------------------------------------------------------------------

const IntentSchema = z.object({
  originQuery: z.string().nullable().describe('Extracted origin (suburb or postcode)'),
  destinationQuery: z.string().nullable().describe('Extracted destination (suburb or postcode)'),
  items: z.array(
    z.object({
      weight: z.number().describe('Weight in kg'),
      quantity: z.number().default(1).describe('Number of items'),
    })
  ),
  requiresTailLift: z.boolean().nullable().describe('True if user mentioned tail lift, forklift, or heavy lifting needs'),
  isFragile: z.boolean().nullable().describe('True if user mentioned fragile or delicate items'),
  confidence: z.number().min(0).max(1).describe('AI confidence in extraction'),
  isQuoteRequest: z.boolean().describe('True if user is asking for pricing'),
  isInfoRequest: z.boolean().describe('True if user is asking for definitions'),
}).passthrough();

// ---------------------------------------------------------------------------
// Server-side data loader (postcodes + rate files)
// ---------------------------------------------------------------------------

async function loadServerData(fileName: string) {
  const possiblePaths = [
    path.join(process.cwd(), 'src', 'public', fileName),
    path.join(process.cwd(), 'public', fileName),
    path.join(process.cwd(), fileName),
  ];

  for (const filePath of possiblePaths) {
    try {
      await fs.access(filePath);
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch {
      continue;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Deterministic postcode resolver
// ---------------------------------------------------------------------------

function resolvePostcode(query: string | null, allPostcodes: PostcodeData[]): PostcodeData | null {
  if (!query || !allPostcodes) return null;
  const q = query.toLowerCase().trim();

  // Handle "Perth 6000" or "Sydney 2000" format — split and try postcode first
  const parts = q.split(/\s+/);
  if (parts.length > 1) {
    const lastPart = parts[parts.length - 1];
    const postcodeFromString = parseInt(lastPart);
    if (!isNaN(postcodeFromString) && lastPart.length === 4) {
      const byPostcode = allPostcodes.find(p => p.postcode === postcodeFromString);
      if (byPostcode) return byPostcode;
    }
  }

  const pc = parseInt(q);
  if (!isNaN(pc) && q.length === 4) {
    return allPostcodes.find(p => p.postcode === pc) || null;
  }

  const exact = allPostcodes.find(p => p.suburb.toLowerCase() === q);
  if (exact) return exact;

  return allPostcodes.find(p => p.suburb.toLowerCase().includes(q)) || null;
}

// ---------------------------------------------------------------------------
// Build conversation context string for prompts
// ---------------------------------------------------------------------------

function buildHistoryContext(history: ChatMessage[]): string {
  if (!history || history.length === 0) return '';
  const lines = history
    .slice(-6) // keep last 6 turns (3 exchanges) to avoid token bloat
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n');
  return `\n\nConversation so far:\n${lines}\n`;
}

// ---------------------------------------------------------------------------
// Core flow logic (extracted so it can be called with a dynamic ai instance)
// ---------------------------------------------------------------------------

async function runQuoteAgentFlow(
  input: QuoteQueryInput,
  ai: ReturnType<typeof buildAi>
): Promise<QuoteAgentOutput> {
  const trace: QuoteAgentOutput['trace'] = [];
  const warnings: string[] = [];
  const historyContext = buildHistoryContext(input.history || []);

  // --- PHASE 1: INTERPRETER ---
  trace.push({ step: 1, title: 'Intelligence Phase', detail: 'Decoding request via Gemini...', status: 'success' });

  const IntentExtractionPrompt = ai.definePrompt({
    name: 'intentExtractionPrompt_v12',
    input: { schema: z.object({ query: z.string(), historyContext: z.string() }) },
    output: { schema: IntentSchema },
    prompt: `You are the Logistics Interpreter for LedgerLight.
Convert the user's latest query to JSON. Use the conversation history to resolve references like "what about 20kg?" or "same route but priority".
Assume 1kg if weight is missing. Determine if asking for price (isQuoteRequest) or info (isInfoRequest).

Special Rules:
- For originQuery and destinationQuery, extract EITHER the suburb name OR the 4-digit postcode alone — never both together.
- If the user mentions "tail lift", "forklift", "tailgate", set requiresTailLift accordingly.
- If the user mentions "fragile", "glass", "delicate", set isFragile to true.
- Use context to see if they already answered a question about tail lifts.

{{historyContext}}
Latest query: {{query}}`,
  });

  const { output: intent, usage } = await IntentExtractionPrompt({
    query: input.query,
    historyContext: historyContext,
  });

  if (!intent) throw new Error('AI failed to resolve intent.');

  logAiUsage('Quote Agent - Phase 1', usage, {
    userId: input.userId,
    companyId: input.companyId,
  }).catch(console.warn);

  if (!intent.isQuoteRequest && !intent.isInfoRequest) {
    return {
      summary: "I specialise in freight pricing and logistics lookups. How can I help you today?",
      trace: [
        ...trace,
        { step: 2, title: 'Intent Ignored', detail: 'Non-logistics intent detected.', status: 'warning' },
      ],
    };
  }

  // --- PHASE 2: EXECUTOR ---
  trace.push({
    step: 2,
    title: 'Data Resolution',
    detail: `Entities identified. Confidence: ${(intent.confidence * 100).toFixed(0)}%`,
    status: 'success',
  });

  const allPostcodes = await loadServerData('postcodes.json');
  if (!allPostcodes) throw new Error('Postcode data missing on server (postcodes.json).');

  // Handle info-only requests
  if (intent.isInfoRequest && !intent.isQuoteRequest) {
    const infoResponse = await ai.generate({
      prompt: `You are a logistics expert for Team Global Express (TGE). Answer clearly and concisely.
${historyContext}
User question: ${input.query}`,
    });
    return {
      summary: infoResponse.text,
      trace: [
        ...trace,
        { step: 3, title: 'Info Resolved', detail: 'Answer generated.', status: 'success' },
      ],
    };
  }

  const origin = resolvePostcode(intent.originQuery, allPostcodes);
  const destination = resolvePostcode(intent.destinationQuery, allPostcodes);

  if (!origin || !destination) {
    if (!origin) warnings.push(`Could not locate origin: "${intent.originQuery}"`);
    if (!destination) warnings.push(`Could not locate destination: "${intent.destinationQuery}"`);
    return {
      summary: "I'll need clearer location details (suburb or 4-digit postcode) to calculate an accurate price.",
      warnings,
      trace: [
        ...trace,
        { step: 3, title: 'Resolution Failed', detail: 'Ambiguous locations.', status: 'error' },
      ],
    };
  }

  // --- PHASE 2.5: INTELLIGENT PROBING ---
  const totalWeight = intent.items.reduce((sum, item) => sum + (item.weight * item.quantity), 0);
  const isHeavy = totalWeight >= 30;
  const mentionsPallet = input.query.toLowerCase().includes('pallet');
  
  if ((isHeavy || mentionsPallet) && intent.requiresTailLift === null) {
      return {
          summary: `I've mapped the route for your ${totalWeight}kg shipment. Before I provide the rates, will you require a tail-lift at the delivery address, or is there a forklift available?`,
          trace: [
              ...trace,
              { step: 3, title: 'Clarification Needed', detail: 'Probing for heavy lifting requirements.', status: 'warning' },
          ],
      };
  }

  trace.push({
    step: 3,
    title: 'Pricing Engine',
    detail: `Mapping: ${origin.suburb} → ${destination.suburb}...`,
    status: 'success',
  });

  // Load rate files from the filesystem (server-side)
  const [rdex, prio, b2c, regional, pallet1, pezone, ras] = await Promise.all([
    loadServerData('b2brdex.json'),
    loadServerData('b2b_priority.json'),
    loadServerData('b2c.json'),
    loadServerData('regionallookup.json'),
    loadServerData('pe1.json'),
    loadServerData('PEZones.json'),
    loadServerData('ras.json'),
  ]);

  // Use settings passed from the client, or fall back to safe defaults.
  // This replaces the broken loadServerData('settings.json') call.
  const serviceSettings = input.serviceSettings ?? [];
  const surchargeDefinitions = input.surchargeDefinitions ?? [];

  const calculatorInput: FreightFormValues = {
    spendBand: '1',
    originQuery: `${origin.suburb} ${origin.state} ${origin.postcode}`,
    originLocation: origin,
    destinationQuery: `${destination.suburb} ${destination.state} ${destination.postcode}`,
    destinationLocation: destination,
    items:
      intent.items.length > 0
        ? intent.items.map(i => ({ weight: i.weight, quantity: i.quantity }))
        : [{ weight: 1, quantity: 1 }],
    globalNoCubic: false,
    globalOnPallet: false,
    applyGST: true,
    additionalPercentageType: 'none',
    selectedServices: ['B2B Std', 'B2B Priority', 'B2C Std', 'B2C Priority'],
    accountTransferRequired: false,
    afterHoursCollection: false,
    afterHoursDelivery: false,
    publicHolidayService: false,
    bookInDeliveryRequired: false,
    dangerousGoodsConsignment: false,
    handUnloadRequired: false,
    routeViaMelbourne: false,
    tailLiftRequired: intent.requiresTailLift || false,
  };

  const calcResults = await calculateAllFreightPrices({
    formData: calculatorInput,
    allServiceSettings: serviceSettings,
    allSurchargeDefinitions: surchargeDefinitions,
    getRateFile: (type) => {
      const map: Record<string, any> = {
        b2brdex: rdex,
        b2b_priority: prio,
        pezone,
        pe1: pallet1,
        b2c,
        regionallookup: regional,
        ras,
      };
      return map[type];
    },
    pezoneData: pezone,
  });

  const finalResults = calcResults
    .filter(r => r.isApplicable && r.finalPrice !== null)
    .map(r => ({
      serviceName: r.serviceName,
      price: r.finalPrice,
      isBestValue: false,
      transitTime: r.serviceName.includes('Priority') ? 'Overnight' : '1-3 Days',
      breakdown: {
        baseRate: r.baseRate,
        fuelSurcharge: r.fuelSurchargeAmount,
        gst: r.gstAmount,
        formula: r.calculationFormula,
      },
    }));

  if (finalResults.length === 0) {
    return {
      summary: `I found the route (${origin.suburb} → ${destination.suburb}), but no standard rates are available for these parameters.`,
      trace: [
        ...trace,
        { step: 4, title: 'Zero Results', detail: 'No services applicable for this weight/lane.', status: 'warning' },
      ],
    };
  }

  const summaryResponse = await ai.generate({
    prompt: `You are a friendly and expert freight quote assistant for Team Global Express.
Summarise the following shipping options naturally. 

OPTIMIZATION RULES:
1. Identify the absolute cheapest option and explicitly recommend it.
2. Identify the fastest option (Priority) and mention it, especially if the price difference is small (e.g. "For only $5 more, you can get it there overnight").
3. If applicable, mention if they are close to a weight threshold where they might save money (e.g. "You're at 22kg; if you can reduce this to 20kg, your rate would drop significantly").
4. Keep the tone professional, consultant-like, and helpful.

${historyContext}
Options: ${JSON.stringify(finalResults.map(r => ({ name: r.serviceName, price: r.price, transit: r.transitTime })))}`,
  });

  return {
    summary: summaryResponse.text,
    results: finalResults as any,
    resolvedInput: calculatorInput,
    rawIntent: intent,
    warnings: intent.confidence < 0.7 ? ['Extraction confidence is low — please verify the locations and weight.'] : [],
    trace: [
      ...trace,
      { step: 4, title: 'Complete', detail: 'Pricing finalised.', status: 'success' },
    ],
  };
}

// ---------------------------------------------------------------------------
// Public export — called by the chat UI
// ---------------------------------------------------------------------------

export async function processQuoteQuery(input: QuoteQueryInput): Promise<QuoteAgentOutput> {
  try {
    // actually use the apiKey override by passing it to buildAi()
    const ai = buildAi(input.apiKey);
    return await runQuoteAgentFlow(input, ai);
  } catch (error: any) {
    console.error('[Quote Agent Flow Error]', error.message);

    const isQuotaError =
      error.message?.includes('429') || error.message?.toLowerCase().includes('quota');
    const isKeyError =
      error.message?.includes('API key') || error.message?.includes('GEMINI_API_KEY');

    let summary =
      "I encountered a technical interruption while calculating your quote. Our engineers have been notified.";
    if (isQuotaError) {
      summary =
        "I'm currently receiving too many requests. Please try again in a few minutes.";
    } else if (isKeyError) {
      summary =
        "The AI service is not configured yet. Please ask your administrator to set the GEMINI_API_KEY environment variable.";
    }

    return {
      summary,
      warnings: ['Service temporarily degraded'],
      trace: [
        {
          step: 0,
          title: 'Intelligence Link Offline',
          detail: isQuotaError
            ? 'API Quota Exceeded (429)'
            : isKeyError
            ? 'Missing or invalid GEMINI_API_KEY'
            : `Internal Service Error: ${error.message}`,
          status: 'error',
        },
      ],
    };
  }
}

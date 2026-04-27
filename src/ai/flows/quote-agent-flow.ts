'use server';
/**
 * @fileOverview Elite Two-Phase AI Quote Agent (Logic v11.0.0).
 * Hardened v24.1.0: Merged system instructions into prompts for compatibility.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { QuoteAgentOutputSchema, type QuoteAgentOutput, type PostcodeData, type FreightFormValues } from '@/lib/types';
import { calculateAllFreightPrices } from '@/lib/freightCalculations';
import { logAiUsage } from '@/lib/aiUsage';
import fs from 'fs/promises';
import path from 'path';

// Schema for raw intent extraction
const IntentSchema = z.object({
  originQuery: z.string().nullable().describe("Extracted origin (suburb or postcode)"),
  destinationQuery: z.string().nullable().describe("Extracted destination (suburb or postcode)"),
  items: z.array(z.object({ 
    weight: z.number().describe("Weight in kg"), 
    quantity: z.number().default(1).describe("Number of items") 
  })),
  confidence: z.number().min(0).max(1).describe("AI confidence in extraction"),
  isQuoteRequest: z.boolean().describe("True if user is asking for pricing"),
  isInfoRequest: z.boolean().describe("True if user is asking for definitions")
}).passthrough();

const IntentExtractionPrompt = ai.definePrompt({
  name: 'intentExtractionPrompt',
  input: { schema: z.object({ query: z.string() }) },
  output: { schema: IntentSchema },
  prompt: `You are the Logistics Interpreter for LedgerLight. 
  Convert queries to JSON. Assume 1kg if weight is missing.
  Determine if asking for price (isQuoteRequest) or info (isInfoRequest).
  
  Query: {{query}}`,
});

/**
 * Server-side data loader with path resilience
 */
async function loadServerData(fileName: string) {
  const possiblePaths = [
    path.join(process.cwd(), 'src', 'public', fileName),
    path.join(process.cwd(), 'public', fileName),
    path.join(process.cwd(), fileName)
  ];

  for (const filePath of possiblePaths) {
    try {
      await fs.access(filePath);
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch (e) {
      continue;
    }
  }
  return null;
}

/**
 * Deterministic Postcode Resolver
 */
function resolvePostcode(query: string | null, allPostcodes: PostcodeData[]): PostcodeData | null {
  if (!query || !allPostcodes) return null;
  const q = query.toLowerCase().trim();
  
  // Try exact postcode match
  const pc = parseInt(q);
  if (!isNaN(pc) && q.length === 4) {
    return allPostcodes.find(p => p.postcode === pc) || null;
  }
  
  // Try exact suburb match
  const exact = allPostcodes.find(p => p.suburb.toLowerCase() === q);
  if (exact) return exact;
  
  // Try partial suburb match
  return allPostcodes.find(p => p.suburb.toLowerCase().includes(q)) || null;
}

const quoteAgentFlow = ai.defineFlow(
  {
    name: 'quoteAgentFlow',
    inputSchema: z.object({ query: z.string(), userId: z.string().optional(), companyId: z.string().optional() }),
    outputSchema: QuoteAgentOutputSchema,
  },
  async (input) => {
    const trace: QuoteAgentOutput['trace'] = [];
    const warnings: string[] = [];

    // --- PHASE 1: INTERPRETER ---
    trace.push({ step: 1, title: "Intelligence Phase", detail: "Decoding request via Gemini...", status: 'success' });
    
    const { output: intent, usage } = await IntentExtractionPrompt(input);
    if (!intent) throw new Error("AI failed to resolve intent.");
    
    logAiUsage('Quote Agent - Phase 1', usage, { userId: input.userId, companyId: input.companyId }).catch(console.warn);

    if (!intent.isQuoteRequest && !intent.isInfoRequest) {
        return {
            summary: "I specialize in freight pricing and logistics lookups. How can I help you today?",
            trace: [...trace, { step: 2, title: "Intent Ignored", detail: "Non-logistics intent detected.", status: 'warning' }]
        };
    }

    // --- PHASE 2: EXECUTOR ---
    trace.push({ step: 2, title: "Data Resolution", detail: `Entities identified. Confidence: ${(intent.confidence * 100).toFixed(0)}%`, status: 'success' });

    const allPostcodes = await loadServerData('postcodes.json');
    const settings = await loadServerData('settings.json');
    const pezone = await loadServerData('PEZones.json');
    
    if (!allPostcodes || !settings) throw new Error("Critical data files missing on server.");

    if (intent.isInfoRequest && !intent.isQuoteRequest) {
        const infoResponse = await ai.generate({
            prompt: `Instructions: You are a logistics expert. Answer the user's question clearly based on Team Global Express (TGE) context.
            
            User Question: ${input.query}`
        });
        return { summary: infoResponse.text, trace: [...trace, { step: 3, title: "Info Resolved", detail: "Answer generated.", status: 'success' }] };
    }

    const origin = resolvePostcode(intent.originQuery, allPostcodes);
    const destination = resolvePostcode(intent.destinationQuery, allPostcodes);

    if (!origin || !destination) {
        if (!origin) warnings.push(`Could not locate origin: "${intent.originQuery}"`);
        if (!destination) warnings.push(`Could not locate destination: "${intent.destinationQuery}"`);
        return { 
          summary: "I'll need clearer location details (suburb or postcode) to calculate an accurate price.", 
          warnings, 
          trace: [...trace, { step: 3, title: "Resolution Failed", detail: "Ambiguous locations.", status: 'error' }] 
        };
    }

    trace.push({ step: 3, title: "Pricing Engine", detail: `Mapping: ${origin.suburb} to ${destination.suburb}...`, status: 'success' });

    const [rdex, prio, b2c, regional, pallet1] = await Promise.all([
        loadServerData('b2brdex.json'), loadServerData('b2b_priority.json'),
        loadServerData('b2c.json'), loadServerData('regionallookup.json'), loadServerData('pe1.json')
    ]);

    const calculatorInput: FreightFormValues = {
        spendBand: "1",
        originQuery: `${origin.suburb} ${origin.state} ${origin.postcode}`,
        originLocation: origin,
        destinationQuery: `${destination.suburb} ${destination.state} ${destination.postcode}`,
        destinationLocation: destination,
        items: intent.items.length > 0 ? intent.items.map(i => ({ weight: i.weight, quantity: i.quantity })) : [{ weight: 1, quantity: 1 }],
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
        tailLiftRequired: false
    };

    const calcResults = await calculateAllFreightPrices({
        formData: calculatorInput,
        allServiceSettings: settings.serviceSettings,
        allSurchargeDefinitions: settings.surchargeDefinitions,
        getRateFile: (type) => {
          const map: Record<string, any> = { b2brdex: rdex, b2b_priority: prio, pezone, pe1: pallet1, b2c, regionallookup: regional };
          return map[type];
        },
        pezoneData: pezone
    });

    const finalResults = calcResults.filter(r => r.isApplicable && r.finalPrice !== null).map(r => ({
        serviceName: r.serviceName,
        price: r.finalPrice,
        isBestValue: false, 
        transitTime: r.serviceName.includes('Priority') ? "Overnight" : "1-3 Days",
        breakdown: { baseRate: r.baseRate, fuelSurcharge: r.fuelSurchargeAmount, gst: r.gstAmount, formula: r.calculationFormula }
    }));

    if (finalResults.length === 0) {
        return { 
          summary: `I found the route, but no standard rates were returned for these parameters.`, 
          trace: [...trace, { step: 4, title: "Zero Results", detail: "No services applicable for this weight/lane.", status: 'warning' }] 
        };
    }

    const summaryResponse = await ai.generate({
        prompt: `Instructions: You are a friendly freight quote assistant. Summarize the following shipping options naturally and professionally.
        
        Options: ${JSON.stringify(finalResults.map(r => ({ name: r.serviceName, price: r.price })))}`
    });

    return { 
      summary: summaryResponse.text, 
      results: finalResults as any, 
      resolvedInput: calculatorInput, 
      rawIntent: intent, 
      warnings: intent.confidence < 0.7 ? ["Extraction confidence is low. Verify inputs."] : [], 
      trace: [...trace, { step: 4, title: "Complete", detail: "Pricing finalized.", status: 'success' }] 
    };
  }
);

/**
 * Wrapper function with v22.0.0 Error Boundaries.
 * Prevents 500 errors if API quota is reached or network fails.
 */
export async function processQuoteQuery(input: { query: string; userId?: string; companyId?: string; apiKey?: string }): Promise<QuoteAgentOutput> {
  try {
    return await quoteAgentFlow(input);
  } catch (error: any) {
    console.error("[Quote Agent Flow Error] Graceful fallback triggered:", error.message);
    
    const isQuotaError = error.message?.includes('429') || error.message?.toLowerCase().includes('quota');

    return {
      summary: isQuotaError 
        ? "I'm currently receiving too many requests to process this quote immediately. Please try again in a few minutes."
        : "I encountered a technical interruption while calculating your quote. Our engineers have been notified.",
      warnings: ["Service temporarily degraded"],
      trace: [{ 
        step: 0, 
        title: "Intelligence Link Offline", 
        detail: isQuotaError ? "API Quota Exceeded (429)" : "Internal Service Error", 
        status: 'error' 
      }]
    };
  }
}

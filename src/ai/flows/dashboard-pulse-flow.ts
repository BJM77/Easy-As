'use server';
/**
 * @fileOverview AI flow to generate a "Pulse" summary of recent business activity.
 * Hardened with error boundaries and raw JSON enforcement to handle Gemini formatting quirks.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { logAiUsage } from '@/lib/aiUsage';

const PulseOutputSchema = z.object({
  headline: z.string().describe("A short, punchy insight about current trends."),
  sentiment: z.enum(['positive', 'neutral', 'warning']).describe("The general mood of the data."),
  recommendation: z.string().describe("A one-sentence actionable suggestion for the user.")
});

export type PulseOutput = z.infer<typeof PulseOutputSchema>;

const PulsePrompt = ai.definePrompt({
  name: 'pulsePrompt',
  input: { schema: z.object({ activitySummary: z.string(), companyName: z.string() }) },
  output: { schema: PulseOutputSchema },
  prompt: `You are the Strategic Analyst for {{companyName}}. Analyze the activity log and provide a high-level Pulse summary.
  
  Identify patterns (carrier issues, route spikes, lead momentum) in this data:
  
  {{activitySummary}}
  
  Do NOT use markdown code blocks like \`\`\`json. Output raw JSON only.`,
});

const dashboardPulseFlow = ai.defineFlow(
  {
    name: 'dashboardPulseFlow',
    inputSchema: z.object({ activitySummary: z.string(), companyName: z.string() }),
    outputSchema: PulseOutputSchema,
  },
  async (input) => {
    const { output, usage } = await PulsePrompt(input);
    if (!output) throw new Error("Model failed to return structured output.");

    logAiUsage('Dashboard Pulse', usage).catch(console.warn);
    return output;
  }
);

/**
 * Wrapper function with high-resiliency error handling.
 * Prevents 500 errors if API quota is reached.
 */
export async function generateBusinessPulse(input: { activitySummary: string; companyName: string }): Promise<PulseOutput> {
  try {
    return await dashboardPulseFlow(input);
  } catch (error: any) {
    console.error("[Dashboard Pulse Flow Error] Graceful fallback triggered:", error.message);
    
    // Check for Quota/Rate Limit specific indicators
    const isQuotaError = error.message?.includes('429') || error.message?.toLowerCase().includes('quota');

    return {
      headline: isQuotaError ? "Intelligence Quota Reached" : "Analytics Pulse Offline",
      sentiment: 'neutral',
      recommendation: isQuotaError 
        ? "Global usage is high. The strategic pulse will refresh shortly." 
        : "Operational review recommended while we re-establish the intelligence link."
    };
  }
}

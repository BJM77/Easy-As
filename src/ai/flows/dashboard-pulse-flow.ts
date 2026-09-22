
'use server';
/**
 * @fileOverview AI flow to generate a "Pulse" summary of recent business activity.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { logAiUsage } from '@/lib/aiUsage';

const PulseInputSchema = z.object({
  activitySummary: z.string().describe("A condensed string representation of recent leads, problems, and quotes."),
  companyName: z.string()
});

const PulseOutputSchema = z.object({
  headline: z.string().describe("A short, punchy insight about current trends."),
  sentiment: z.enum(['positive', 'neutral', 'warning']).describe("The general mood of the data."),
  recommendation: z.string().describe("A one-sentence actionable suggestion for the user.")
});

export async function generateBusinessPulse(input: z.infer<typeof PulseInputSchema>) {
  const prompt = ai.definePrompt({
    name: 'generateBusinessPulsePrompt',
    input: { schema: PulseInputSchema },
    output: { schema: PulseOutputSchema },
    prompt: `You are the Strategic Analyst for {{companyName}}. 
    Analyze the following recent activity log and provide a high-level "Pulse" summary.
    
    Data:
    {{{activitySummary}}}
    
    Identify patterns like:
    - Spikes in specific routes
    - Recurring problems with a carrier
    - High-value lead momentum
    
    Be professional, concise, and logistics-focused. Do NOT use markdown code blocks like \`\`\`json. Output raw JSON only.`
  });

  try {
    const response = await prompt(input);
    const output = response.output;
    if (!output) throw new Error("AI failed to generate pulse.");

    // Log usage in the background without throwing if it fails
    logAiUsage('Dashboard Pulse', response.usage).catch(console.warn);
    return output;
  } catch (error: any) {
    const errorMsg = error.message || '';
    console.error("[Dashboard Pulse Flow Error]", errorMsg);

    if (errorMsg.includes('429') || errorMsg.toLowerCase().includes('quota')) {
      return {
        headline: "Intelligence Quota Reached",
        sentiment: 'warning',
        recommendation: "Global usage is high. The strategic pulse will refresh shortly."
      };
    }

    if (errorMsg.includes('401') || errorMsg.toLowerCase().includes('api key')) {
      return {
        headline: "Authorization Required",
        sentiment: 'warning',
        recommendation: "Please verify the system API key configuration."
      };
    }

    return {
      headline: "Analytics Pulse Unavailable",
      sentiment: 'neutral',
      recommendation: "Operational review recommended while we re-establish the intelligence link."
    };
  }
}

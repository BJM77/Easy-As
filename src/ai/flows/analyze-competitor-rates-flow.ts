
'use server';
/**
 * @fileOverview An AI agent that analyzes competitor rate comparison data.
 *
 * - analyzeCompetitorRates - A function that takes a JSON string of rate comparison results and returns a strategic summary.
 * - AnalysisInput - The input type for the analyzeCompetitorRates function.
 * - AnalysisSummary - The return type for the analyzeCompetitorRates function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { logAiUsage } from '@/lib/aiUsage';

const AnalysisInputSchema = z.object({
  analysisJSON: z.string().describe('A JSON string representing the full competitor rate analysis results.'),
});
export type AnalysisInput = z.infer<typeof AnalysisInputSchema>;

const AnalysisSummarySchema = z.object({
  overallVerdict: z.string().describe("A one-sentence summary of TGE's overall competitiveness."),
  keyStrengths: z.array(z.string()).describe("A list of 2-3 bullet points highlighting where TGE is most competitive."),
  keyOpportunities: z.array(z.string()).describe("A list of 2-3 bullet points identifying where TGE is less competitive and suggesting potential actions."),
  strategicRecommendation: z.string().describe("A short paragraph of actionable advice for the salesperson."),
  suggestedEmailBody: z.string().describe("A friendly, professional email body written to the customer contact, summarizing the key findings and strengths from the analysis. It should be concise, highlight TGE's value using the keyStrengths, and end with a call to action. The tone should be confident and helpful.")
});
export type AnalysisSummary = z.infer<typeof AnalysisSummarySchema>;

export async function analyzeCompetitorRates(input: AnalysisInput) {
  const analysisPrompt = ai.definePrompt({
    name: 'competitorAnalysisPrompt',
    input: {schema: AnalysisInputSchema},
    output: {schema: AnalysisSummarySchema},
    prompt: `You are a senior sales analyst for a logistics company called TGE. Your task is to analyze a JSON dataset representing a comparison between TGE's rates and a competitor's rates for a series of freight legs.
Your audience is a TGE sales professional who needs a quick, strategic overview to prepare for a client meeting.
Based on the provided JSON data, generate a concise summary. The data contains multiple freight leg objects. Each leg object contains an origin, destination, weight, the competitorPrice, and tgeAnalyses which is an array of TGE's prices for different services and spend bands.

Provide the following in your analysis:
1.  **Overall Verdict:** A one-sentence summary of TGE's competitiveness.
2.  **Key Strengths:** 2-3 bullet points highlighting which services or types of shipments TGE is most competitive on. Be specific (e.g., "B2B Priority for heavy items to metro areas").
3.  **Key Opportunities:** 2-3 bullet points identifying where TGE is less competitive and what could be done. Be specific (e.g., "Our B2C rates are consistently higher. A 5% discount on SB3 would win 80% of these lanes.").
4.  **Strategic Recommendation:** A short paragraph with actionable advice for the salesperson.
5.  **Suggested Email Body:** A friendly, professional email body to the customer. This should be concise, highlight the key strengths of TGE's offering based on the analysis, and end with a positive call to action to discuss things further. Start with something like "Hi [Customer Name]," and sign off with "[Your Name]". Do not include a subject line.

Do not just repeat the numbers. Provide insights.

JSON Input:
{{{analysisJSON}}}`,
  });

  const response = await analysisPrompt(input);
  const output = response.output;
  if (!output) {
    throw new Error('AI analysis failed to produce an output.');
  }

  const usage = response.usage;
  await logAiUsage('Competitor Rate Analysis', usage);

  return { summary: output, usage };
}

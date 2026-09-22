
'use server';
/**
 * @fileOverview An AI agent that analyzes freight problem log data to identify trends.
 *
 * - analyzeProblemLog - A function that takes a JSON string of problem entries and returns a summary of trends.
 * - ProblemLogAnalysisInput - The input type for the analyzeProblemLog function.
 * - ProblemLogAnalysisSummary - The return type for the analyzeProblemLog function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { logAiUsage } from '@/lib/aiUsage';

const ProblemLogAnalysisInputSchema = z.object({
  problemLogJSON: z.string().describe('A JSON string representing an array of freight problem log entries.'),
});
export type ProblemLogAnalysisInput = z.infer<typeof ProblemLogAnalysisInputSchema>;

const ProblemLogAnalysisSummarySchema = z.object({
  totalProblems: z.number().describe("The total number of problems in the log."),
  openIssues: z.number().describe("The number of issues currently with 'open' status."),
  mostCommonProblemType: z.string().describe("The problem type that occurs most frequently."),
  topProblematicConsignments: z.array(z.string()).describe("A list of up to 3 consignment numbers that appear most frequently in the log."),
  emergingTrends: z.array(z.string()).describe("A list of 2-3 bullet points identifying any potential emerging trends or patterns, such as repeated issues with a specific location, a spike in a certain problem type, or connections between different problems."),
  recommendation: z.string().describe("A short paragraph providing a strategic recommendation for an operations manager based on the identified trends."),
});
export type ProblemLogAnalysisSummary = z.infer<typeof ProblemLogAnalysisSummarySchema>;

export async function analyzeProblemLog(input: ProblemLogAnalysisInput) {
  const analysisPrompt = ai.definePrompt({
    name: 'problemLogAnalysisPrompt',
    input: { schema: ProblemLogAnalysisInputSchema },
    output: { schema: ProblemLogAnalysisSummarySchema },
    prompt: `You are a logistics operations analyst. Your task is to analyze a JSON dataset of freight problem log entries and provide a concise, actionable summary for an operations manager.

Based on the provided JSON data, generate the following insights:
1.  **Total Problems:** The total count of entries in the log.
2.  **Open Issues:** The number of problems with a status of 'open'.
3.  **Most Common Problem Type:** The single most frequent 'problemType' (e.g., 'delivery_issue').
4.  **Top Problematic Consignments:** Identify up to 3 consignment numbers that appear most often. If none repeat, return an empty array.
5.  **Emerging Trends:** Analyze the descriptions, consignment numbers, and dates to identify 2-3 potential trends. Look for patterns like repeated delays on a specific route, multiple damage claims from a particular depot, or a recent surge in a specific issue type.
6.  **Recommendation:** A brief, strategic paragraph suggesting what the operations manager should investigate or act on based on your findings.

Do not just list the data. Synthesize the information to provide valuable operational insights.

JSON Input:
{{{problemLogJSON}}}`,
  });

  const response = await analysisPrompt(input);
  const output = response.output;

  if (!output) {
    throw new Error('AI failed to analyze the problem log data.');
  }

  const usage = response.usage;
  await logAiUsage('Problem Log Analysis', usage);

  return { summary: output, usage };
}

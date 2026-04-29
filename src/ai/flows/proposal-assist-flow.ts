'use server';
/**
 * @fileOverview An AI agent that helps draft and refine sections of a sales proposal.
 */

import {ai, buildAi} from '@/ai/genkit';
import {z} from 'genkit';
import { logAiUsage } from '@/lib/aiUsage';
import { gemini } from '@genkit-ai/googleai';

// Schema for generating an executive summary
const ExecSummaryInputSchema = z.object({
  customerName: z.string().describe("The name of the customer the proposal is for."),
  userNotes: z.string().describe("The user's key points or notes for the summary."),
  apiKey: z.string().optional(),
});
export type ExecSummaryInput = z.infer<typeof ExecSummaryInputSchema>;

const ExecSummaryOutputSchema = z.object({
  summary: z.string().describe("A polished, market-leading executive summary based on the user's notes, tailored to the customer."),
});
export type ExecSummaryOutput = z.infer<typeof ExecSummaryOutputSchema>;

export async function generateExecutiveSummary(input: ExecSummaryInput) {
  try {
    const activeAi = input.apiKey ? buildAi(input.apiKey) : ai;
    
    const hasKey = !!(input.apiKey || process.env.GEMINI_API_KEY);
    if (!hasKey) {
        throw new Error('Intelligence service configuration missing. Please set your GEMINI_API_KEY in the Admin panel.');
    }

    const response = await activeAi.generate({
        system: `You are an expert sales proposal writer for a logistics company. 
                 Your task is to write a powerful, market-leading executive summary.
                 Always respond with a single paragraph summary that is professional, confident, and clearly states the value proposition.`,
        prompt: `Write an executive summary for: ${input.customerName}\n\nSalesperson's Notes:\n${input.userNotes}`,
        output: { schema: ExecSummaryOutputSchema }
    });

    const output = response.output;
    if (!output) {
      throw new Error('AI failed to generate an executive summary.');
    }

    await logAiUsage('Proposal - Exec Summary', response.usage);
    return { summary: output.summary, usage: response.usage };
  } catch (error: any) {
    console.error('[generateExecutiveSummary] Error:', error);
    throw new Error(error.message || 'Failed to generate executive summary.');
  }
}

// Schema for refining a list of points into a paragraph
const RefinePointsInputSchema = z.object({
  points: z.array(z.string()).describe("A list of bullet points or short phrases."),
  topic: z.enum(['customer needs', 'solution benefits']).describe("The topic of the points, which will determine the tone and structure of the paragraph."),
  apiKey: z.string().optional(),
});
export type RefinePointsInput = z.infer<typeof RefinePointsInputSchema>;

const RefinePointsOutputSchema = z.object({
    paragraph: z.string().describe("A well-written paragraph that smoothly incorporates all the provided points."),
});
export type RefinePointsOutput = z.infer<typeof RefinePointsOutputSchema>;

export async function refinePointsToParagraph(input: RefinePointsInput) {
    try {
        const activeAi = input.apiKey ? buildAi(input.apiKey) : ai;
        
        const hasKey = !!(input.apiKey || process.env.GEMINI_API_KEY);
        if (!hasKey) {
            throw new Error('Intelligence service configuration missing.');
        }

        const pointsList = input.points.map(p => `- ${p}`).join('\n');

        const response = await activeAi.generate({
            system: `You are an expert sales proposal writer. Your task is to take a list of bullet points and rewrite them into a smooth, professional paragraph.
                     The topic is: ${input.topic}.
                     Synthesize the points into a coherent paragraph without losing any key information.`,
            prompt: `Convert these points into a professional paragraph about ${input.topic}:\n\n${pointsList}`,
            output: { schema: RefinePointsOutputSchema }
        });

        const output = response.output;
        if (!output) {
            throw new Error('AI failed to refine the points.');
        }

        await logAiUsage(`Proposal - Refine ${input.topic}`, response.usage);
        return { paragraph: output.paragraph, usage: response.usage };
    } catch (error: any) {
        console.error('[refinePointsToParagraph] Error:', error);
        throw new Error(error.message || 'Failed to refine points.');
    }
}

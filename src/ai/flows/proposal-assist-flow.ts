
'use server';
/**
 * @fileOverview An AI agent that helps draft and refine sections of a sales proposal.
 */

import {ai, buildAi} from '@/ai/genkit';
import {z} from 'genkit';
import { logAiUsage } from '@/lib/aiUsage';


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

// Define prompt at module level
const execSummaryPrompt = ai.definePrompt({
    name: 'execSummaryPrompt',
    input: {schema: ExecSummaryInputSchema},
    output: {schema: ExecSummaryOutputSchema},
    prompt: `You are an expert sales proposal writer for a logistics company. Your task is to write a powerful, market-leading executive summary.
    
    The proposal is for: {{customerName}}
    
    Use the following key points provided by the salesperson to draft a compelling summary. It should be professional, confident, and clearly state the value proposition.

    Salesperson's Notes:
    {{{userNotes}}}
    `,
});

export async function generateExecutiveSummary(input: ExecSummaryInput) {
  try {
    // If an API key is provided from the client, rebuild the AI instance to use it
    const activeAi = input.apiKey ? buildAi(input.apiKey) : ai;
    
    // Check if we have a valid key (either global or override)
    const hasKey = !!(input.apiKey || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY);
    if (!hasKey) {
        throw new Error('Intelligence service configuration missing. Please set your GEMINI_API_KEY in the Admin panel.');
    }

    const response = await activeAi.executePrompt({
        prompt: execSummaryPrompt,
        input
    });

    const output = response.output;
    if (!output) {
      throw new Error('AI failed to generate an executive summary.');
    }

    const usage = response.usage;
    await logAiUsage('Proposal - Exec Summary', usage);

    return { summary: output.summary, usage };
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

// Define prompt at module level
const refinePointsPrompt = ai.definePrompt({
    name: 'refinePointsPrompt',
    input: {schema: RefinePointsInputSchema},
    output: {schema: RefinePointsOutputSchema},
    prompt: `You are an expert sales proposal writer. Your task is to take a list of bullet points and rewrite them into a smooth, professional paragraph.

    The topic is: {{topic}}.

    Based on this topic, synthesize the following points into a coherent paragraph. Do not lose any key information from the points.

    Points:
    {{#each points}}
    - {{{this}}}
    {{/each}}
    `,
});

export async function refinePointsToParagraph(input: RefinePointsInput) {
    try {
        const activeAi = input.apiKey ? buildAi(input.apiKey) : ai;
        
        const hasKey = !!(input.apiKey || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY);
        if (!hasKey) {
            throw new Error('Intelligence service configuration missing.');
        }

        const response = await activeAi.executePrompt({
            prompt: refinePointsPrompt,
            input
        });

        const output = response.output;
        if (!output) {
            throw new Error('AI failed to refine the points.');
        }

        const usage = response.usage;
        await logAiUsage(`Proposal - Refine ${input.topic}`, usage);

        return { paragraph: output.paragraph, usage };
    } catch (error: any) {
        console.error('[refinePointsToParagraph] Error:', error);
        throw new Error(error.message || 'Failed to refine points.');
    }
}

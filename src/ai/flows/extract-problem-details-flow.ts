'use server';
/**
 * @fileOverview An AI agent that extracts problem details from an email body.
 */

import {z} from 'genkit';
import { logAiUsage } from '@/lib/aiUsage';
import { ALL_SIMPLIFIED_CARRIERS } from '@/lib/types';


const ExtractProblemInputSchema = z.object({
  emailBody: z.string().describe("The full text content of an email reporting a freight issue."),
});
export type ExtractProblemInput = z.infer<typeof ExtractProblemInputSchema>;

const ExtractProblemOutputSchema = z.object({
  consignmentNumbers: z.array(z.string()).describe('A list of all consignment numbers found in the email. Should be codes like "TGE12345678".'),
  carrier: z.enum(ALL_SIMPLIFIED_CARRIERS as [string, ...string[]]).describe('The carrier or service involved, inferred from the text (e.g., IPEC, Priority, Palletised).'),
  problemType: z.enum(['freight_issue', 'delivery_issue', 'billing_issue', 'freight_damage', 'customer_complaint', 'other']).describe('The general category of the problem.'),
  descriptionSummary: z.string().describe('A concise, one or two-sentence summary of the core issue based on the email content, excluding any consignment numbers.'),
});
export type ExtractProblemOutput = z.infer<typeof ExtractProblemOutputSchema>;

export async function extractProblemDetailsFromEmail(input: ExtractProblemInput) {
  // Dynamic import prevents Handlebars conflict in UI bundles
  const { ai } = await import('@/ai/genkit');

  const prompt = ai.definePrompt({
    name: 'extractProblemDetailsPrompt',
    input: {schema: ExtractProblemInputSchema},
    output: {schema: ExtractProblemOutputSchema},
    prompt: `You are a logistics support analyst. Your task is to read an email and extract key details about a freight problem.

    Instructions:
    1.  **Consignment Numbers**: Find ALL consignment numbers (e.g., starting with TGE, IPEC, or having 4 letters followed by 6 numbers). Return them as a list of strings.
    2.  **Carrier**: Identify the carrier or service being discussed (e.g., IPEC, Priority, Pallets). If not explicitly mentioned, infer from context. Default to 'Other' if unclear.
    3.  **Problem Type**: Categorize the issue into one of the following: 'freight_issue', 'delivery_issue', 'billing_issue', 'freight_damage', 'customer_complaint', 'other'.
    4.  **Description Summary**: Write a one or two-sentence summary of the core problem. CRITICALLY, this summary should NOT include any of the consignment numbers you found.

    Return the extracted data in the specified JSON format.

    Email Content:
    {{{emailBody}}}
    `,
  });

  const response = await prompt(input);
  const aiOutput = response.output;

  if (!aiOutput) {
    throw new Error('AI failed to extract problem details from the email.');
  }

  // Process the multiple consignment numbers
  const primaryConsignment = aiOutput.consignmentNumbers.length > 0 ? aiOutput.consignmentNumbers[0] : '';
  const additionalConsignments = aiOutput.consignmentNumbers.slice(1);
  
  let finalDescription = aiOutput.descriptionSummary;
  if (additionalConsignments.length > 0) {
      finalDescription += `\n\nAdditional Consignments: ${additionalConsignments.join(', ')}`;
  }

  const finalOutput = {
    consignmentNumber: primaryConsignment,
    carrier: aiOutput.carrier,
    problemType: aiOutput.problemType,
    description: finalDescription,
  };

  const usage = response.usage;
  await logAiUsage('Extract Problem Details from Email', usage);

  return { details: finalOutput, usage };
}

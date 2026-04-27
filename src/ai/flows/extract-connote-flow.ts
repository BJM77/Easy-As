
'use server';
/**
 * @fileOverview An AI agent that extracts consignment details from an image.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { logAiUsage } from '@/lib/aiUsage';

const ExtractConnoteInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of a consignment note, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractConnoteInput = z.infer<typeof ExtractConnoteInputSchema>;

const ExtractConnoteOutputSchema = z.object({
  consignmentNumber: z.string().describe('The consignment number, found next to "CONNOTE #" label.'),
  address: z.string().describe('The full recipient address, including street, suburb, state, and postcode.'),
  carrier: z.string().describe('The carrier name, usually near the top, like "IPEC" or "Road Express".'),
});
export type ExtractConnoteOutput = z.infer<typeof ExtractConnoteOutputSchema>;

export async function extractConnoteDetails(input: ExtractConnoteInput) {
  const prompt = ai.definePrompt({
    name: 'extractConnotePrompt',
    input: {schema: ExtractConnoteInputSchema},
    output: {schema: ExtractConnoteOutputSchema},
    prompt: `You are an expert logistics data entry clerk. Your task is to analyze the provided image of a consignment note and extract key information.

    Instructions:
    1.  **Find the Consignment Number**: This is a critical field. Look for labels like "CONNOTE #", "CON NOTE", or a long alphanumeric code (e.g., 'TGE12345678', 'CBEEW009027'). Extract this code as the 'consignmentNumber'.
    2.  **Find the Carrier/Service**: This is often at the top of the label. Look for terms like "IPEC", "ROAD EXPRESS", "PRIORITY", or "PALLET". This is the 'carrier'.
    3.  **Find the Recipient Address**: This is often the largest block of text. Look for keywords like "TO:" or a typical address structure (street name, suburb, state, postcode). Combine all parts of the address into a single, clean string for the 'address' field.

    Return the extracted data in the specified JSON format. If a field is not clearly identifiable, make a best guess or return an empty string for that field.

    Image to analyze:
    {{media url=photoDataUri}}
    `,
  });

  const response = await prompt(input);
  const output = response.output;

  if (!output) {
    throw new Error('AI failed to extract consignment details from the image.');
  }

  const usage = response.usage;
  await logAiUsage('Extract Connote Details', usage);

  return { details: output, usage };
}

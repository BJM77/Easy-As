'use server';
/**
 * @fileOverview An AI agent that extracts structured data from PDF documents.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { logAiUsage } from '@/lib/aiUsage';

const ExtractPdfInputSchema = z.object({
  pdfDataUri: z
    .string()
    .describe(
      "A PDF file, as a data URI that must include the 'application/pdf' MIME type and use Base64 encoding. Format: 'data:application/pdf;base64,<encoded_data>'."
    ),
  extractionType: z.enum(['Rate Card', 'Invoice', 'Consignment Note', 'General']).describe('The type of document being processed.'),
  customInstructions: z.string().optional().describe('Specific details or fields to look for in the document.'),
});
export type ExtractPdfInput = z.infer<typeof ExtractPdfInputSchema>;

const ExtractPdfOutputSchema = z.object({
  extractedData: z.any().describe('The structured data extracted from the PDF, represented as a JSON object or array.'),
  summary: z.string().describe('A brief summary of what was found in the document.'),
});
export type ExtractPdfOutput = z.infer<typeof ExtractPdfOutputSchema>;

export async function extractPdfData(input: ExtractPdfInput) {
  const prompt = ai.definePrompt({
    name: 'extractPdfPrompt',
    input: {schema: ExtractPdfInputSchema},
    output: {schema: ExtractPdfOutputSchema},
    prompt: `You are an expert data extraction assistant. Your task is to analyze the provided PDF document and extract information into a clean, structured JSON format.

    Document Type: {{extractionType}}
    Custom Instructions: {{customInstructions}}

    Instructions:
    1. If this is a **Rate Card**, extract the origin/destination zones, basic rates, kilo rates, and minimum charges.
    2. If this is a **Consignment Note** or **Invoice**, extract the numbers, dates, addresses, and line items.
    3. If this is **General**, extract any relevant tabular data or key-value pairs.
    4. Ensure numbers are parsed as actual numbers, not strings with currency symbols.
    5. If data is tabular, return it as an array of objects.

    Document:
    {{media url=pdfDataUri}}
    `,
  });

  const response = await prompt(input);
  const output = response.output;

  if (!output) {
    throw new Error('AI failed to extract data from the PDF.');
  }

  const usage = response.usage;
  await logAiUsage(`PDF Extractor - ${input.extractionType}`, usage);

  return { result: output, usage };
}

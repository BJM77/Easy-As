'use server';
/**
 * @fileOverview AI agents for extracting lead details from images and text.
 * v2.0.0: Added userId and companyId for token attribution.
 */

import {z} from 'genkit';
import { logAiUsage } from '@/lib/aiUsage';
import { ai } from '@/ai/genkit';

const ExtractLeadInputSchema = z.object({
  photoDataUri: z.string().describe("A photo data URI."),
  userId: z.string().optional(),
  companyId: z.string().optional(),
});
export type ExtractLeadInput = z.infer<typeof ExtractLeadInputSchema>;

const ExtractLeadTextSchema = z.object({
  text: z.string().describe('Unstructured text.'),
  userId: z.string().optional(),
  companyId: z.string().optional(),
});
export type ExtractLeadTextInput = z.infer<typeof ExtractLeadTextSchema>;

const ExtractLeadOutputSchema = z.object({
  companyName: z.string().describe('The name of the company or business.'),
  firstName: z.string().describe('The first name of the contact person.'),
  lastName: z.string().describe('The last name of the contact person.'),
  email: z.string().describe('The email address of the contact.'),
  phone: z.string().describe('The primary phone or mobile number of the contact.'),
  role: z.string().describe('The job title or role.'),
  street: z.string().describe('The street address.'),
  suburb: z.string().describe('The suburb or city.'),
  state: z.string().describe('The state or territory abbreviation.'),
  postcode: z.string().describe('The 4-digit postcode.'),
});

const extractLeadDetailsPrompt = ai.definePrompt({
    name: 'extractLeadDetailsPrompt',
    input: {schema: ExtractLeadInputSchema},
    output: {schema: ExtractLeadOutputSchema},
    prompt: `Extract contact details from this image: {{media url=photoDataUri}}`,
});

const extractLeadFromTextPrompt = ai.definePrompt({
    name: 'extractLeadFromTextPrompt',
    input: {schema: ExtractLeadTextSchema},
    output: {schema: ExtractLeadOutputSchema},
    prompt: `Extract lead details from this text: {{text}}`,
});

export async function extractLeadDetailsFromImage(input: ExtractLeadInput) {
  const response = await extractLeadDetailsPrompt(input);
  if (!response.output) throw new Error('AI failed to extract details from image.');
  await logAiUsage('Extract Lead Details from Image', response.usage, { userId: input.userId, companyId: input.companyId });
  return { details: response.output, usage: response.usage };
}

export async function extractLeadDetailsFromText(input: ExtractLeadTextInput) {
    const response = await extractLeadFromTextPrompt(input);
    if (!response.output) throw new Error('AI failed to extract details from text.');
    await logAiUsage('Extract Lead Details from Text', response.usage, { userId: input.userId, companyId: input.companyId });
    return { details: response.output, usage: response.usage };
}

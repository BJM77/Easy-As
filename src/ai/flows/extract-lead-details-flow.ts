'use server';
/**
 * @fileOverview An AI agent that extracts lead details from an image.
 */

import {z} from 'genkit';
import { logAiUsage } from '@/lib/aiUsage';

const ExtractLeadInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of a business card or email signature, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractLeadInput = z.infer<typeof ExtractLeadInputSchema>;

const ExtractLeadOutputSchema = z.object({
  companyName: z.string().describe('The name of the company or business.'),
  firstName: z.string().describe('The first name of the contact person.'),
  lastName: z.string().describe('The last name of the contact person.'),
  email: z.string().describe('The email address of the contact.'),
  phone: z.string().describe('The primary phone or mobile number of the contact.'),
  role: z.string().describe('The job title or role of the contact (e.g., "Director", "Logistics Manager").'),
  street: z.string().describe('The street address, including number and street name.'),
  suburb: z.string().describe('The suburb or city.'),
  state: z.string().describe('The state or territory abbreviation (e.g., NSW, VIC).'),
  postcode: z.string().describe('The 4-digit postcode.'),
});
export type ExtractLeadOutput = z.infer<typeof ExtractLeadOutputSchema>;

export async function extractLeadDetailsFromImage(input: ExtractLeadInput) {
  // Dynamic import prevents Handlebars conflict in UI bundles
  const { ai } = await import('@/ai/genkit');

  const prompt = ai.definePrompt({
    name: 'extractLeadDetailsPrompt',
    input: {schema: ExtractLeadInputSchema},
    output: {schema: ExtractLeadOutputSchema},
    prompt: `You are an expert data extraction assistant. Your task is to analyze the provided image of a business card or email signature and accurately extract the key contact details.

    Instructions:
    1.  Identify and extract the full Company Name.
    2.  Identify the person's full name and separate it into a First Name and a Last Name.
    3.  Find and extract the primary Email Address.
    4.  Find and extract the best contact Phone Number (prefer mobile numbers if available).
    5.  Identify the person's job Role or Title.
    6.  Extract the full physical address and break it down into its components: Street (number and name), Suburb/City, State (abbreviation), and Postcode.

    Return the extracted data in the specified JSON format. If a field cannot be found, return an empty string for it.

    Image to analyze:
    {{media url=photoDataUri}}
    `,
  });

  const response = await prompt(input);
  const output = response.output;

  if (!output) {
    throw new Error('AI failed to extract lead details from the image.');
  }

  const usage = response.usage;
  await logAiUsage('Extract Lead Details from Image', usage);

  return { details: output, usage };
}

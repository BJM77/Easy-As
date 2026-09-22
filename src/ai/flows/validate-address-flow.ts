'use server';
/**
 * @fileOverview An AI agent that validates and cleans a street address.
 */

import {z} from 'genkit';
import { logAiUsage } from '@/lib/aiUsage';

const AddressValidationInputSchema = z.object({
  originalAddress: z.string().describe("The raw, potentially messy address string to be validated."),
});
export type AddressValidationInput = z.infer<typeof AddressValidationInputSchema>;

const AddressValidationOutputSchema = z.object({
  cleanedAddress: z.string().describe("The corrected, well-formatted full address."),
  isConfident: z.boolean().describe("True if the model is highly confident in the cleaned address and that it's a valid, complete address. False if components seem missing or ambiguous."),
  reason: z.string().describe("A brief explanation of why the address was flagged as not confident (e.g., 'Missing street number', 'Name detected in address'). Only required if isConfident is false."),
  streetNumber: z.string().describe("The extracted street number, including any unit numbers (e.g., '12' or 'Unit 3/15').").optional(),
  streetName: z.string().describe("The extracted street name and type (e.g., 'Example St' or 'Main Rd').").optional(),
  suburb: z.string().describe("The extracted suburb or city.").optional(),
  state: z.string().describe("The extracted state or territory abbreviation (e.g., WA, NSW).").optional(),
  postcode: z.string().describe("The extracted 4-digit postcode.").optional(),
});
export type AddressValidationOutput = z.infer<typeof AddressValidationOutputSchema>;

export async function validateAddress(input: AddressValidationInput) {
  const { ai } = await import('@/ai/genkit');

  const prompt = ai.definePrompt({
    name: 'validateAddressPrompt',
    input: {schema: AddressValidationInputSchema},
    output: {schema: AddressValidationOutputSchema},
    prompt: `You are an expert Australian address parser and validator. Your task is to analyze the provided raw address string, clean it, and determine if it is a complete, valid address.

    Original Address: "{{originalAddress}}"

    Instructions:
    1.  **Clean the Address**: Correct formatting, remove extraneous text (like names, instructions, or invalid characters), and produce a standard Australian address format (e.g., "123 Example St, Sydney NSW 2000").
    2.  **Break Down Components**: Extract the individual components: street number, street name, suburb, state, and postcode.
    3.  **Assess Confidence**:
        - Set \`isConfident\` to \`true\` ONLY if you can clearly identify all essential components (street number, street name, suburb, state, postcode) and there is no ambiguous text.
        - Set \`isConfident\` to \`false\` if any essential component is missing (especially street number), or if it appears a person's or company's name is part of the address string.
    4.  **Provide a Reason**: If \`isConfident\` is \`false\`, you MUST provide a brief, clear reason (e.g., "Missing street number", "Possible name 'John Smith' detected in address").

    Return the result in the specified JSON format.`,
  });

  const response = await prompt(input);
  const output = response.output;
  if (!output) {
    throw new Error('AI failed to validate the address.');
  }

  const usage = response.usage;
  await logAiUsage('Validate Address', usage);

  return { result: output, usage };
}

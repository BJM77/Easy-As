import '@/lib/handlebars-helpers';
import {genkit} from 'genkit';
import {googleAI, gemini} from '@genkit-ai/googleai';

/**
 * Initializes and exports the Genkit instance.
 * This file does NOT use 'use server' because it exports an object.
 * Flows that use this instance should use 'use server' and dynamic imports.
 */
export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY,
      apiVersion: 'v1beta',
    }),
  ],
  model: gemini('gemini-2.0-flash'),
});

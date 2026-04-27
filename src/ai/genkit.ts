/**
 * @fileOverview Shared Genkit Singleton (v55.0.0 Infrastructure).
 * Standardized on @genkit-ai/googleai at 1.8.0 for registry stability.
 * Forced to v1beta to ensure Gemini 2.0 Flash resolution in this SDK version.
 */
import { genkit } from 'genkit';
import { googleAI, gemini } from '@genkit-ai/googleai';

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY,
      apiVersion: 'v1beta',
    }),
  ],
  model: gemini('gemini-2.0-flash'),
});

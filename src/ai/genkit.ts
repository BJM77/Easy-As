import '@/lib/handlebars-helpers';
import {genkit} from 'genkit';
import {googleAI, gemini} from '@genkit-ai/googleai';

/**
 * Initializes and exports the Genkit instance.
 * This file does NOT use 'use server' because it exports an object.
 * Flows that use this instance should use 'use server' and dynamic imports.
 */
const getGeminiApiKey = (): string => {
  const cleaned = process.env.GEMINI_API_KEY?.trim().replace(/^["']|["']$/g, '');
  if (!cleaned) {
    throw new Error(
      'Missing GEMINI_API_KEY. Configure GEMINI_API_KEY as a server-side secret (for example in Firebase App Hosting/Secret Manager).'
    );
  }
  return cleaned;
};

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: getGeminiApiKey(),
      apiVersion: 'v1beta',
    }),
  ],
  model: gemini('gemini-2.5-flash'),
});

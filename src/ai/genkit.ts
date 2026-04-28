/**
 * @fileOverview Shared Genkit Singleton (v55.0.0 Infrastructure).
 * Standardized on @genkit-ai/googleai at 1.8.0 for registry stability.
 * Forced to v1beta to ensure Gemini 2.0 Flash resolution in this SDK version.
 */
import { genkit } from 'genkit';
import { googleAI, gemini } from '@genkit-ai/googleai';

/**
 * Genkit factory
 * Builds a scoped instance when an API key override is supplied, otherwise
 * falls back to the server-side GEMINI_API_KEY environment variable.
 */
export function buildAi(apiKeyOverride?: string) {
  const apiKey = apiKeyOverride || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not set. Add it to your .env file or pass it as an override.'
    );
  }

  return genkit({
    plugins: [
      googleAI({
        apiKey,
        apiVersion: 'v1beta',
      }),
    ],
    model: gemini('gemini-2.0-flash'),
  });
}

// Default instance for shared use
export const ai = buildAi();

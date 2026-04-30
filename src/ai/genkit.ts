/**
 * @fileOverview Shared Genkit Singleton (v55.0.0 Infrastructure).
 * Standardized on @genkit-ai/googleai at 1.8.0 for registry stability.
 * Forced to v1beta to ensure Gemini 2.0 Flash resolution in this SDK version.
 */
import { genkit } from 'genkit';
import { googleAI, gemini } from '@genkit-ai/googleai';

/**
 * Genkit factory
 */
export function buildAi(apiKeyOverride?: string) {
  let apiKey = apiKeyOverride || process.env.GEMINI_API_KEY;

  if (apiKey) {
    apiKey = apiKey.trim().replace(/^["']|["']$/g, '');
  }

  return genkit({
    plugins: [
      googleAI({
        apiKey: apiKey || 'MISSING_KEY',
      }),
    ],
    model: gemini('gemini-1.5-flash-latest'), // Try the 'latest' alias
  });
}

/**
 * Default instance for shared use.
 * Note: If GEMINI_API_KEY is missing, this instance will fail when called.
 */
export const ai = buildAi();

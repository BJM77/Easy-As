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
    console.error('[Genkit] CRITICAL: GEMINI_API_KEY is not set in environment.');
    // Return a dummy instance that throws when used, or handle later
    // For now, let's keep the throw but move it inside the call chain if possible.
    // However, buildAi is called at top level below.
  }

  return genkit({
    plugins: [
      googleAI({
        apiKey: apiKey || 'MISSING_KEY', // Avoid crash here
        apiVersion: 'v1beta',
      }),
    ],
    model: gemini('gemini-2.0-flash'),
  });
}

/**
 * Default instance for shared use.
 * Note: If GEMINI_API_KEY is missing, this instance will fail when called.
 */
export const ai = buildAi();

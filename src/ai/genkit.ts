import '@/lib/handlebars-helpers';
import {genkit} from 'genkit';
import {googleAI, gemini} from '@genkit-ai/googleai';

/**
 * Reads the Gemini API key lazily.
 * Prefer GEMINI_API_KEY (secret), fallback to NEXT_PUBLIC_GEMINI_API_KEY.
 * TODO: remove NEXT_PUBLIC_GEMINI_API_KEY fallback once secret is confirmed.
 */
export const getGeminiApiKey = (): string | undefined => {
  const primaryKey = process.env.GEMINI_API_KEY?.trim();
  if (primaryKey) return primaryKey.replace(/^["']|["']$/g, '');
  
  // TODO: remove NEXT_PUBLIC_GEMINI_API_KEY fallback once secret is confirmed
  const fallbackKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY?.trim().replace(/^["']|["']$/g, '');
  if (fallbackKey) return fallbackKey;
  
  return undefined;
};

// Model constant - default to gemini-2.5-flash, overridable with GEMINI_MODEL env var
export const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const aiInstance = genkit({
  plugins: [
    googleAI({
      apiKey: getGeminiApiKey() || '',
      apiVersion: 'v1beta',
    }),
  ],
  model: gemini(DEFAULT_MODEL),
});

function checkApiKey() {
  if (!getGeminiApiKey()) {
    throw new Error('AI is not configured: GEMINI_API_KEY missing');
  }
}

// Proxy wrapper around genkit instance to ensure AI calls fail gracefully with clear error if GEMINI_API_KEY is missing
const aiProxy = new Proxy(aiInstance, {
  get(target, prop, receiver) {
    if (prop === 'generate') {
      return async (...args: any[]) => {
        checkApiKey();
        return (target as any).generate(...args);
      };
    }
    if (prop === 'definePrompt') {
      return (...args: any[]) => {
        const promptFn = (target as any).definePrompt(...args);
        return async (...promptArgs: any[]) => {
          checkApiKey();
          return promptFn(...promptArgs);
        };
      };
    }
    if (prop === 'defineFlow') {
      return (...args: any[]) => {
        const flowFn = (target as any).defineFlow(...args);
        return async (...flowArgs: any[]) => {
          checkApiKey();
          return flowFn(...flowArgs);
        };
      };
    }
    return Reflect.get(target, prop, receiver);
  }
});

export { aiProxy as ai };


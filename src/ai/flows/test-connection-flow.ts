'use server';
/**
 * @fileOverview Lightweight AI flow to verify API connectivity.
 */

import '@/lib/handlebars-helpers';
import { ai } from '@/ai/genkit';
import { gemini } from '@genkit-ai/googleai';
import { DEFAULT_MODEL } from '@/ai/genkit';
import { logAiUsage } from '@/lib/aiUsage';

/**
 * Pings the LLM with a simple request to verify the API key and library initialization.
 */
export async function testAiConnection() {
  try {
    const response = await ai.generate({
      model: gemini(DEFAULT_MODEL),
      system: "You are a system diagnostic tool.",
      prompt: "Respond with exactly the word 'ONLINE' if you are functioning correctly.",
    });

    // Minimal usage logging
    await logAiUsage('AI Connection Test', response.usage).catch(console.warn);

    return { 
      success: true, 
      model: DEFAULT_MODEL
    };
  } catch (error: any) {
    console.error("[AI TEST FLOW ERROR]", error);
    return { 
      success: false, 
      error: error.message || "Unknown error during inference."
    };
  }
}

/**
 * Superadmin-only health check endpoint for /api/ai-health
 */
export async function aiHealthCheck(): Promise<{ ok: boolean; model: string; error?: string }> {
  try {
    const response = await ai.generate({
      model: gemini(DEFAULT_MODEL),
      prompt: "Respond with exactly the word 'HEALTHY' if you are functioning correctly.",
    });

    // Minimal usage logging
    await logAiUsage('AI Health Check', response.usage).catch(console.warn);

    return { 
      ok: true, 
      model: DEFAULT_MODEL
    };
  } catch (error: any) {
    const errorMsg = error.message || "Unknown error during inference.";
    
    if (errorMsg.includes('401') || errorMsg.toLowerCase().includes('unauthorized') || 
        errorMsg.toLowerCase().includes('missing api key')) {
      return { 
        ok: false, 
        model: DEFAULT_MODEL,
        error: 'AI is not configured: GEMINI_API_KEY missing'
      };
    }

    return { 
      ok: false, 
      model: DEFAULT_MODEL,
      error: errorMsg 
    };
  }
}

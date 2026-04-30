'use server';
/**
 * @fileOverview AI flow to verify API connectivity via Genkit.
 * v55.0.0: Finalized stable connection logic for Gemini 2.5 Flash.
 */

import { ai } from '@/ai/genkit';
import { logAiUsage } from '@/lib/aiUsage';

/**
 * Pings the LLM with a simple request to verify the API key and library initialization.
 * Returns a structured success or error object for the UI.
 */
export async function testAiConnection() {
  const hasKey = !!process.env.GEMINI_API_KEY;

  if (!hasKey) {
    return { success: false, error: "Secret Manager key (GEMINI_API_KEY) is missing from the runtime environment." };
  }

  try {
    const response = await ai.generate({
      prompt: "Reply with: HANDSHAKE SUCCESSFUL",
    });

    const reply = (response.text || '').trim();
    if (reply.toUpperCase().includes('HANDSHAKE')) {
      return {
        success: true,
        status: 'online',
        message: "✅ HANDSHAKE SUCCESSFUL - Gemini 2.5 Flash is live and responsive."
      };
    }

    return { success: false, error: `Unexpected response: ${reply}` };

  } catch (error: any) {
    console.error("[AI TEST FLOW ERROR]", error);

    let details = error.message || "Unknown error";

    if (details.includes("404") || details.includes("not found")) {
        details = `Model Availability Error (404): ${details}. Ensure the Generative Language API is enabled for your service account.`;
    }

    return {
      success: false,
      error: details
    };
  }
}

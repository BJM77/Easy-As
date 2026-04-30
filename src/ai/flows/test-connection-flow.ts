'use server';
/**
 * @fileOverview AI flow to verify API connectivity via Genkit.
 * v54.0.0: Updated to provide accurate error reporting for Gemini 2.0 models.
 */

import { ai } from '@/ai/genkit';
import { logAiUsage } from '@/lib/aiUsage';

/**
 * Pings the LLM with a simple request to verify the API key and library initialization.
 * Returns a structured success or error object for the UI.
 */
export async function testAiConnection() {
  console.log("🔄 Testing Gemini AI connection via GenKit...");
  const key = process.env.GEMINI_API_KEY || '';
  console.log("[Debug] Server-side GEMINI_API_KEY present:", !!key);
  if (key) {
    console.log(`[Debug] Key starts with: ${key.substring(0, 8)}... ends with: ...${key.substring(key.length - 4)}`);
  }

  if (!key) {
    return { success: false, error: "Secret Manager key (GEMINI_API_KEY) is missing from the runtime environment." };
  }

  try {
    // Attempt with the default model
    const response = await ai.generate({
      prompt: "Reply with: HANDSHAKE SUCCESSFUL",
    });

    const reply = (response.text || '').trim();
    if (reply.toUpperCase().includes('HANDSHAKE')) {
      return {
        success: true,
        status: 'online',
        message: `✅ SUCCESS - Model: ${response.model}`
      };
    }

    return { success: false, error: `Unexpected response: ${reply}` };

  } catch (error: any) {
    console.error("[AI TEST FLOW ERROR]", error);

    let details = error.message || "Unknown error";

    // If it's a 404, Google often provides a very specific reason in the message
    if (details.includes("404") || details.includes("not found")) {
        details = `Model Availability Error (404): ${details}. This often means the API key is valid but the specific model is not enabled for your project or region.`;
    }

    return {
      success: false,
      error: details
    };
  }
}

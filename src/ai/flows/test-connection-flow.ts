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
  console.log("[Debug] Server-side GEMINI_API_KEY present:", !!process.env.GEMINI_API_KEY);

  try {    const response = await ai.generate({
      prompt: "You are performing an API handshake. Reply with exactly: 'HANDSHAKE SUCCESSFUL'",
    });

    const reply = (response.text || '').trim();
    // Case-insensitive check for robustness
    const isOnline = reply.toUpperCase().includes('HANDSHAKE SUCCESSFUL');

    // Minimal usage logging
    await logAiUsage('AI Connection Test', response.usage).catch(console.warn);

    if (isOnline) {
      return { 
        success: true, 
        status: 'online',
        message: "✅ HANDSHAKE SUCCESSFUL - API key valid, logic healthy" 
      };
    } else {
      return {
        success: false,
        status: 'UNEXPECTED_RESPONSE',
        error: `Unexpected AI response: "${reply}"`
      };
    }
  } catch (error: any) {
    console.error("[AI TEST FLOW ERROR]", error);
    
    // Provide helpful error classification based on the actual failure
    let userErrorMessage = error.message || "Unknown error during inference.";
    
    if (error.message?.includes("404")) {
      userErrorMessage = "Model not found. The model 'gemini-2.0-flash' may not be available for this API key or region in the current project.";
    } else if (error.message?.includes("API key")) {
      userErrorMessage = "Invalid API key. Please check your GEMINI_API_KEY configuration in Secret Manager or environment variables.";
    } else if (error.message?.includes("429")) {
      userErrorMessage = "Resource exhausted (429). Quota limit reached for this API key.";
    }
    
    return { 
      success: false, 
      error: userErrorMessage
    };
  }
}

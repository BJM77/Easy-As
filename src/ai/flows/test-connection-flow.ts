'use server';
/**
 * @fileOverview Lightweight AI flow to verify API connectivity.
 */

import { ai } from '@/ai/genkit';
import { gemini } from '@genkit-ai/googleai';
import { logAiUsage } from '@/lib/aiUsage';

/**
 * Pings the LLM with a simple request to verify the API key and library initialization.
 */
export async function testAiConnection() {
  try {
    const response = await ai.generate({
      model: gemini('gemini-3.6-flash'),
      system: "You are a system diagnostic tool.",
      prompt: "Respond with exactly the word 'ONLINE' if you are functioning correctly.",
    });

    const text = response.text || '';
    const isOnline = text.toUpperCase().includes('ONLINE');

    // Minimal usage logging
    await logAiUsage('AI Connection Test', response.usage).catch(console.warn);

    return { 
      success: true, 
      status: isOnline ? 'ONLINE' : 'UNEXPECTED_RESPONSE',
      message: text 
    };
  } catch (error: any) {
    console.error("[AI TEST FLOW ERROR]", error);
    return { 
      success: false, 
      error: error.message || "Unknown error during inference."
    };
  }
}

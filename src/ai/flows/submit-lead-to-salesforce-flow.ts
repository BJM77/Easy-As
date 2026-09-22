'use server';
/**
 * @fileOverview A flow that submits a lead to the Salesforce Web-to-Lead endpoint.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { Lead } from '@/lib/types';
import { logAiUsage } from '@/lib/aiUsage';


// Accept a fallback for required fields
const orPlaceholder = (
  value: string | number | undefined | null,
  defaultValue?: string
): string => {
  if (value === undefined || value === null || String(value).trim() === '') {
    return defaultValue ?? '**';
  }
  return String(value);
};

const SalesforceLeadInputSchema = z.object({
  // We pass the full lead object for context and future use
  lead: z.custom<Lead>(),
  // We also pass submitter info separately
  submitterName: z.string().optional(),
  submitterEmail: z.string().optional(),
});
export type SalesforceLeadInput = z.infer<typeof SalesforceLeadInputSchema>;

const SalesforceLeadOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  salesforceResponse: z.string().optional(),
});
export type SalesforceLeadOutput = z.infer<typeof SalesforceLeadOutputSchema>;

// This flow does not use an LLM, but we wrap it in a flow for consistency,
// monitoring, and potential future enhancements (e.g., using an AI to clean data before sending).
const submitLeadFlow = ai.defineFlow(
  {
    name: 'submitLeadToSalesforceFlow',
    inputSchema: SalesforceLeadInputSchema,
    outputSchema: SalesforceLeadOutputSchema,
  },
  async ({ lead, submitterName, submitterEmail }) => {
    const salesforceUrl = 'https://webto.salesforce.com/servlet/servlet.WebToLead?encoding=UTF-8&orgId=00D7F000001uzC2';

    const payload = new URLSearchParams();
    payload.append('oid', '00D7F000001uzC2');
    payload.append('retURL', 'https://teamglobalexp.com/thank-you.');
    payload.append('debug', '1');
    payload.append('debugEmail', 'benjamin.mackie@teamglobalexp.com');
    payload.append('lead_source', 'Phone');
    payload.append('00N2P000000O4xt', 'Reoccurring'); // Lead Type
    payload.append('member_status', 'Sent');

    // Custom driver/submitter fields from your example
    payload.append('00NOa000003tchF', lead.leadOwner || submitterName || 'Rick James'); // Driver Full Name / Lead Owner
    payload.append('00NOa00000CgQ2P', submitterEmail || 'rick@urika.com.au'); // Driver Email

    // Lead data mapping
    payload.append('company', orPlaceholder(lead.companyName, 'Unknown'));
    payload.append('first_name', orPlaceholder(lead.firstName, 'Lead'));
    payload.append('last_name', orPlaceholder(lead.lastName, lead.companyName));

    const sanitizedPhone = (lead.contactPhone || '').replace(/\D/g, '').slice(0, 20);
    payload.append('phone', sanitizedPhone || "0000000000");

    payload.append('email', orPlaceholder(lead.contactEmail, 'unknown@example.com'));
    payload.append('description', orPlaceholder(lead.notes, '').substring(0, 100));

    // Custom fields from your example
    payload.append('00N2P000000YXZu', orPlaceholder(lead.businessUnit, 'IPEC')); // Business Unit
    payload.append('state', orPlaceholder(lead.state, 'WA')); // State
    payload.append('00N2P000000O4yH', orPlaceholder(lead.depot, 'WA LCP')); // Depot
    payload.append('00N2P000000O4yb', orPlaceholder(lead.estimatedSpend, '0-50K')); // Estimated Spend
    payload.append('00NOa000004TZpj', '1'); // Consent Checkbox

    try {
      const response = await fetch(salesforceUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: payload.toString(),
      });

      const responseText = await response.text();

      if (response.ok || response.status === 200 || responseText.includes('success')) {
        return {
          success: true,
          message: 'Lead submitted to Salesforce successfully.',
          salesforceResponse: responseText,
        };
      } else {
        const errorMessage = `Salesforce submission failed with status: ${response.status}. Response: ${responseText}`;
        console.error(errorMessage);
        return {
          success: false,
          message: errorMessage,
          salesforceResponse: responseText,
        };
      }
    } catch (e: any) {
      const errorMessage = `A network error occurred during Salesforce submission: ${e.message}`;
      console.error(errorMessage);
      return {
        success: false,
        message: errorMessage,
      };
    }
  }
);

export async function submitLeadToSalesforce(input: SalesforceLeadInput): Promise<SalesforceLeadOutput> {
  // Since this is a system action and not a generative AI call, we log 0 token usage.
  await logAiUsage('Submit Lead to Salesforce', { totalTokens: 0, inputTokens: 0, outputTokens: 0 });
  return await submitLeadFlow(input);
}

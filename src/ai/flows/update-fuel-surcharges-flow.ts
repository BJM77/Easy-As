
'use server';
/**
 * @fileOverview A flow that scrapes the TGE fuel surcharge page to get live rates.
 *
 * - updateFuelSurcharges - Fetches the latest fuel surcharge percentages by scraping the website.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { logAiUsage } from '@/lib/aiUsage';
import * as cheerio from 'cheerio';

const FuelSurchargeUpdateSchema = z.object({
  pallet: z.number().describe('The fuel surcharge percentage for Palletised Express.'),
  road: z.number().describe('The fuel surcharge percentage for Express Parcels Road.'),
  air: z.number().describe('The total fuel surcharge percentage for Express Parcels Air.'),
  lastUpdated: z.string().describe('The ISO date string for when the update occurred.'),
});
export type FuelSurchargeUpdate = z.infer<typeof FuelSurchargeUpdateSchema>;

const FuelSurchargeResultSchema = z.object({
  success: z.boolean(),
  update: FuelSurchargeUpdateSchema.optional(),
  error: z.string().optional(),
});

const fuelSurchargeFlow = ai.defineFlow(
  {
    name: 'updateFuelSurchargesFlow',
    inputSchema: z.void(),
    outputSchema: FuelSurchargeResultSchema,
  },
  async () => {
    const url = "https://teamglobalexp.com/fuel-surcharge";

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        },
        cache: 'no-store',
        next: { revalidate: 0 }
      }).catch(e => {
          throw new Error("TGE Website is currently unavailable. Please try again later.");
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch TGE page: ${response.status} ${response.statusText}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      let pallet: number | null = null;
      let road: number | null = null;
      let air: number | null = null;

      // Look for data in tables
      $('table').each((_, table) => {
        if (pallet !== null) return;

        $(table).find('tr').each((_, row) => {
          const cells = $(row).find('td, th');
          if (cells.length >= 4) {
            const rowText = $(row).text().toLowerCase();
            // Match the row containing actual percentages
            if (rowText.includes("fuel surcharge") && !rowText.includes("by type")) {
              const pVal = parseFloat($(cells[1]).text().replace('%', '').trim());
              const rVal = parseFloat($(cells[2]).text().replace('%', '').trim());
              const aVal = parseFloat($(cells[3]).text().replace('%', '').trim());

              if (!isNaN(pVal) && !isNaN(rVal) && !isNaN(aVal)) {
                pallet = pVal;
                road = rVal;
                air = aVal;
              }
            }
          }
        });
      });

      if (pallet === null || road === null || air === null) {
        throw new Error("Could not locate the current fuel surcharge data table. The site structure may have changed.");
      }
      
      const update = { 
        pallet, 
        road, 
        air, 
        lastUpdated: new Date().toISOString() 
      };
      
      await logAiUsage('Fuel Surcharge Scraper', { totalTokens: 0, inputTokens: 0, outputTokens: 0 });

      return { success: true, update };

    } catch (error) {
      console.error("Error scraping fuel surcharges:", error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "An unknown network error occurred." 
      };
    }
  }
);

export async function updateFuelSurcharges() {
  const result = await fuelSurchargeFlow();
  return { 
    update: result.update || { pallet: 0, road: 0, air: 0, lastUpdated: new Date().toISOString() }, 
    success: result.success,
    error: result.error,
    usage: { totalTokens: 0, inputTokens: 0, outputTokens: 0 } 
  };
}

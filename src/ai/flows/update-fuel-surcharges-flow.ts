'use server';
/**
 * @fileOverview A flow that fetches TGE fuel surcharge rates.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { logAiUsage } from '@/lib/aiUsage';
import * as cheerio from 'cheerio';

const FuelSurchargeUpdateSchema = z.object({
  pallet: z.number(),
  road: z.number(),
  air: z.number(),
  lastUpdated: z.string(),
});

export async function updateFuelSurcharges() {
  const url = "https://teamglobalexp.com/fuel-surcharge";
  
  try {
    const response = await fetch(url, { cache: 'no-store' });
    const html = await response.text();
    const $ = cheerio.load(html);
    
    let pallet = 0;
    let road = 0;
    let air = 0;

    $('table tr').each((_, row) => {
      const rowText = $(row).text().toLowerCase();
      if (rowText.includes("fuel surcharge") && !rowText.includes("by type")) {
        const cells = $(row).find('td, th');
        if (cells.length >= 4) {
          pallet = parseFloat($(cells[1]).text().replace(/[%\s]/g, '')) || 0;
          road = parseFloat($(cells[2]).text().replace(/[%\s]/g, '')) || 0;
          air = parseFloat($(cells[3]).text().replace(/[%\s]/g, '')) || 0;
        }
      }
    });

    return {
      success: true,
      update: {
        pallet,
        road,
        air,
        lastUpdated: new Date().toISOString()
      },
      usage: { totalTokens: 0, inputTokens: 0, outputTokens: 0 }
    };
  } catch (error) {
    return { success: false, error: "Failed to fetch rates" };
  }
}
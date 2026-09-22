import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import type { LCPRdexRateEntry } from '@/lib/types';

function parseMonetaryValue(value: string | number | undefined): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const cleanedValue = value.replace(/\$|,/g, '');
    const num = parseFloat(cleanedValue);
    return isNaN(num) ? 0 : num; // Default to 0 if parsing fails
  }
  return 0; // Default for undefined or other types
}

export async function GET() {
  const apiPath = '/api/lcprdex';
  const fileName = 'lcprdex.json';
  let filePath = ''; 
  try {
    filePath = path.join(process.cwd(), 'src', 'public', fileName);
    const fileContents = await fs.readFile(filePath, 'utf8');
    const rawData: any[] = JSON.parse(fileContents);

    const data: LCPRdexRateEntry[] = rawData.map(entry => ({
      Logic: entry.Logic,
      LCPRDEXBasic: parseMonetaryValue(entry.LCPRDEXBasic),
      LCPRDEXKg: parseMonetaryValue(entry.LCPRDEXKg || entry.LCPRDEXKilo), 
    }));

    return NextResponse.json(data);
  } catch (error) {
    console.error(`[API ${apiPath}] Error:`, error);
    let message = `Failed to load ${fileName}`;
    if (error instanceof Error) {
      if ((error as any).code === 'ENOENT') {
        message = `File not found: ${filePath || 'src/public/' + fileName}. Please ensure the file exists.`;
      } else {
        message = error.message;
      }
    }
    return NextResponse.json({ error: `Failed to load LCP RDEX rates data from server`, details: message }, { status: 500 });
  }
}

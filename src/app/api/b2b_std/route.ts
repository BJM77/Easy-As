
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import type { B2BStdRateEntry } from '@/lib/types';

function parseMonetaryValue(value: string | number | undefined): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const cleanedValue = value.replace(/\$|,/g, '');
    const num = parseFloat(cleanedValue);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

export async function GET() {
  const apiPath = '/api/b2b_std';
  const fileName = 'b2b_std.json';
  try {
    const filePath = path.join(process.cwd(), 'src', 'public', fileName);
    const fileContents = await fs.readFile(filePath, 'utf8');
    const rawData: any[] = JSON.parse(fileContents);

    const data: B2BStdRateEntry[] = rawData.map(entry => {
      const newEntry: any = { Logic: entry.Logic };
      for (let i = 1; i <= 6; i++) {
        newEntry[`Basic${i}`] = parseMonetaryValue(entry[`Basic${i}`]);
        newEntry[`Kilo${i}`] = parseMonetaryValue(entry[`Kilo${i}`]);
        newEntry[`Min${i}`] = parseMonetaryValue(entry[`Min${i}`]);
      }
      return newEntry as B2BStdRateEntry;
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error(`[API ${apiPath}] Error:`, error);
    let message = `Failed to load ${fileName}`;
    if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      message = `File not found: src/public/${fileName}. Please ensure the file exists.`;
    } else if (error instanceof Error) {
      message = error.message;
    }
    return NextResponse.json({ error: `Failed to load B2B Std rates data from server`, details: message }, { status: 500 });
  }
}

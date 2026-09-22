
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import type { B2BRdexEntry } from '@/lib/types';

function parseMonetaryValue(value: string | number | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleanedValue = value.replace(/\$|,/g, '');
    const num = parseFloat(cleanedValue);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

export async function GET() {
  const apiPath = '/api/b2brdex';
  const fileName = 'b2brdex.json';
  try {
    const filePath = path.join(process.cwd(), 'src', 'public', fileName);
    const fileContents = await fs.readFile(filePath, 'utf8');
    const rawData: any[] = JSON.parse(fileContents);

    const data: B2BRdexEntry[] = rawData.map(entry => {
      const newEntry: any = { Logic: entry.Logic, Service: entry.Service, Origin: entry.Origin, Destination: entry.Destination };
      for (let i = 1; i <= 6; i++) {
        newEntry[`B${i}`] = parseMonetaryValue(entry[`B${i}`]);
        newEntry[`K${i}`] = parseMonetaryValue(entry[`K${i}`]);
        newEntry[`M${i}`] = parseMonetaryValue(entry[`M${i}`]);
      }
      return newEntry as B2BRdexEntry;
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error(`[API ${apiPath}] Error:`, error);
    let message = `Failed to load ${fileName}`;
    if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      message = `File not found: src/public/${fileName}.`;
    } else if (error instanceof Error) {
      message = error.message;
    }
    return NextResponse.json({ error: `Failed to load B2B RDEX rates`, details: message }, { status: 500 });
  }
}

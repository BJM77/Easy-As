
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import type { B2CRateEntry } from '@/lib/types';

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
    const apiPath = '/api/b2c';
    const fileName = 'b2c.json';
    try {
        const filePath = path.join(process.cwd(), 'src', 'public', fileName);
        const fileContents = await fs.readFile(filePath, 'utf8');
        const rawData: any[] = JSON.parse(fileContents);

        const data: B2CRateEntry[] = rawData.map(entry => ({
            ...entry,
            b2c1: parseMonetaryValue(entry.b2c1),
            b2c3: parseMonetaryValue(entry.b2c3),
            b2c5: parseMonetaryValue(entry.b2c5),
            kg: parseMonetaryValue(entry.kg),
            b2cp1: parseMonetaryValue(entry.b2cp1),
            b2cp3: parseMonetaryValue(entry.b2cp3),
            b2cp5: parseMonetaryValue(entry.b2cp5),
            pkg: parseMonetaryValue(entry.pkg),
        }));
        
        return NextResponse.json(data);
    } catch (error) {
        console.error(`[API ${apiPath}] Error:`, error);
        let message = `Failed to load ${fileName}`;
         if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
             message = `File not found: src/public/${fileName}.`;
         } else if (error instanceof Error) {
             message = error.message;
         }
        return NextResponse.json({ error: `Failed to load B2C rates data from server`, details: message }, { status: 500 });
    }
}


import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import type { LCPGoRateEntry } from '@/lib/types';

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
    const apiPath = '/api/lcpgo';
    const fileName = 'lcpgo.json';
    try {
        const filePath = path.join(process.cwd(), 'src', 'public', fileName);
        const fileContents = await fs.readFile(filePath, 'utf8');
        const rawData: any[] = JSON.parse(fileContents);

        const data: LCPGoRateEntry[] = rawData.map(entry => ({
            ...entry,
            Go1: parseMonetaryValue(entry.Go1),
            Go3: parseMonetaryValue(entry.Go3),
            Go5: parseMonetaryValue(entry.Go5),
            Go10: parseMonetaryValue(entry.Go10),
            GoKilo: parseMonetaryValue(entry.GoKilo),
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
        return NextResponse.json({ error: `Failed to load LCP GO rates data from server`, details: message }, { status: 500 });
    }
}

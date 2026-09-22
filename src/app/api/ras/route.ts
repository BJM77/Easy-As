
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import type { RASRateEntry } from '@/lib/types';

export async function GET() {
  const apiPath = '/api/ras';
  const fileName = 'ras.json';
  try {
    const filePath = path.join(process.cwd(), 'src', 'public', fileName);
    const fileContents = await fs.readFile(filePath, 'utf8');
    const data: RASRateEntry[] = JSON.parse(fileContents);
    return NextResponse.json(data);
  } catch (error) {
    console.error(`[API ${apiPath}] Error:`, error);
    let message = `Failed to load ${fileName}`;
    if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      message = `File not found: src/public/${fileName}.`;
    } else if (error instanceof Error) {
        message = error.message;
    }
    return NextResponse.json({ error: `Failed to load Remote Area Surcharge data from server.`, details: message }, { status: 500 });
  }
}

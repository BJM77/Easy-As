
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET() {
  const apiPath = '/api/pe2';
  const fileName = 'pe2.json';
  try {
    const filePath = path.join(process.cwd(), 'src', 'public', fileName);
    const fileContents = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(fileContents);
    return NextResponse.json(data);
  } catch (error) {
    console.error(`[API ${apiPath}] Error:`, error);
    let message = `Failed to load ${fileName}`;
    if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      message = `File not found: src/public/${fileName}.`;
    } else if (error instanceof Error) {
        message = error.message;
    }
    return NextResponse.json({ error: `Failed to load PE2 rates.`, details: message }, { status: 500 });
  }
}

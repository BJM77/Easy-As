
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET() {
  const fileName = 'TGE Rates.zip';
  const apiPath = '/api/load-dev-rates';
  
  try {
    const filePath = path.join(process.cwd(), 'src', 'public', fileName);
    
    // Check if file exists before attempting to read
    await fs.access(filePath);
    
    const fileBuffer = await fs.readFile(filePath);
    const base64Data = fileBuffer.toString('base64');

    return NextResponse.json({ zipData: base64Data });
    
  } catch (error) {
    // If the file doesn't exist, return a specific, actionable error message
    if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        const message = `File not found: ${path.join('src', 'public', fileName)}. This is a developer-only feature that requires this file to be present.`;
        console.warn(`[API ${apiPath}] Info:`, message);
        return NextResponse.json({ error: "Dev rates file not found.", details: message }, { status: 404 });
    }
    
    // Handle other potential errors
    console.error(`[API ${apiPath}] Error:`, error);
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    return NextResponse.json({ error: `Failed to load dev rates from server`, details: message }, { status: 500 });
  }
}

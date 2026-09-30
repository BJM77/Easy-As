
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import type { LocationLookupData } from '@/lib/types';

export async function GET(request: Request) {
  const apiPath = '/api/locations';
  
  // Basic Auth Check
  const cookieHeader = request.headers.get('cookie') || '';
  if (!cookieHeader.includes('__session') && !cookieHeader.includes('firebase-auth-token')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const fileName = 'locations.json';
  try {
    const filePath = path.join(process.cwd(), 'src', 'public', fileName);
    const fileContents = await fs.readFile(filePath, 'utf8');
    const data: LocationLookupData[] = JSON.parse(fileContents);
    return NextResponse.json(data);
  } catch (error) {
    console.error(`[API ${apiPath}] Error:`, error);
    let message = `Failed to load ${fileName}`;
    if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
       message = `File not found: src/public/${fileName}.`;
    } else if (error instanceof Error) {
        message = error.message;
    }
    return NextResponse.json({ error: `Failed to load location data from server.`, details: message }, { status: 500 });
  }
}

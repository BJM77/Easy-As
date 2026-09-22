
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const settingsFilePath = path.join(process.cwd(), 'src', 'public', 'settings.json');

export async function GET() {
  try {
    const fileContents = await fs.readFile(settingsFilePath, 'utf8');
    const settings = JSON.parse(fileContents);
    return NextResponse.json(settings, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.warn('settings.json not found, returning empty object.');
      return NextResponse.json({});
    }
    console.error('Failed to read settings.json:', error);
    return NextResponse.json({ error: 'Failed to load server settings.' }, { status: 500 });
  }
}

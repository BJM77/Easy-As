
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import type { PostcodeData } from '@/lib/types';

const postcodesFilePath = path.join(process.cwd(), 'src', 'public', 'postcodes.json');

export async function GET() {
  try {
    const fileContents = await fs.readFile(postcodesFilePath, 'utf8');
    const data: PostcodeData[] = JSON.parse(fileContents);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error reading or parsing postcodes.json:", error);
    if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
       return NextResponse.json({ error: "Postcode data file not found on server." }, { status: 500 });
    }
    return NextResponse.json({ error: "Failed to load postcode data from server." }, { status: 500 });
  }
}

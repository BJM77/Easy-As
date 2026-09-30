import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '@/lib/api-auth';

export async function POST(request: Request) {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, '', sessionCookieOptions(request, 0));
  return response;
}

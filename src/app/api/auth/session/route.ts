import { NextResponse } from 'next/server';
import { getAdminAuth, getUserFromToken } from '@/lib/firebase-admin';
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_MS, sessionCookieOptions } from '@/lib/api-auth';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const idToken = body && typeof body.idToken === 'string' ? body.idToken.trim() : '';
    if (!idToken) {
      return NextResponse.json({ error: 'Missing id token' }, { status: 400 });
    }

    const user = await getUserFromToken(idToken);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const auth = await getAdminAuth();
    const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_MS });

    const response = NextResponse.json({ ok: true });
    response.cookies.set(
      SESSION_COOKIE_NAME,
      sessionCookie,
      sessionCookieOptions(request, Math.floor(SESSION_MAX_AGE_MS / 1000)),
    );
    return response;
  } catch (error: any) {
    console.error('[auth/session] failed:', error);
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 },
    );
  }
}

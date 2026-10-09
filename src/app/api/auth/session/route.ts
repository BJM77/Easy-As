import { NextResponse } from 'next/server';
import { getAdminAuth, getUserFromToken } from '@/lib/firebase-admin';
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_MS, sessionCookieOptions } from '@/lib/api-auth';

export async function POST(request: Request) {
  let step = 'parse';
  try {
    const body = await request.json().catch(() => null);
    const idToken = body && typeof body.idToken === 'string' ? body.idToken.trim() : '';
    if (!idToken) {
      return NextResponse.json({ error: 'Missing id token' }, { status: 400 });
    }

    step = 'verify';
    const user = await getUserFromToken(idToken);
    if (!user) console.error('[auth/session] getUserFromToken returned null');
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', step, detail: 'getUserFromToken returned null' }, { status: 401 });
    }

    step = 'getAuth';
    const auth = await getAdminAuth();

    step = 'createSessionCookie';
    const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_MS });

    const response = NextResponse.json({ ok: true });
    response.cookies.set(
      SESSION_COOKIE_NAME,
      sessionCookie,
      sessionCookieOptions(request, Math.floor(SESSION_MAX_AGE_MS / 1000)),
    );
    return response;
  } catch (error: any) {
    console.error('[auth/session] failed at', step, error);
    return NextResponse.json(
      { error: 'Unauthorized', step, detail: error?.message || String(error) },
      { status: 401 },
    );
  }
}

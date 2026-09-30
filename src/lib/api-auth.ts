import { NextResponse } from 'next/server';
import { getAdminAuth, getUserFromToken } from '@/lib/firebase-admin';

/** HttpOnly cookie the edge proxy already treats as logged-in. */
export const SESSION_COOKIE_NAME = '__session';

/** About 5 days. Firebase session cookies allow 5 minutes to 14 days. */
export const SESSION_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000;

export function sessionCookieSecure(request: Request): boolean {
  if (process.env.NODE_ENV === 'production') return true;
  const forwarded = request.headers.get('x-forwarded-proto');
  if (forwarded) return forwarded.split(',')[0].trim() === 'https';
  try {
    return new URL(request.url).protocol === 'https:';
  } catch {
    return false;
  }
}

export function sessionCookieOptions(request: Request, maxAgeSeconds: number) {
  return {
    httpOnly: true as const,
    secure: sessionCookieSecure(request),
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

function readRequestCookie(request: Request, name: string): string | undefined {
  const raw = request.headers.get('cookie');
  if (!raw) return undefined;
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (key !== name) continue;
    const value = part.slice(idx + 1).trim();
    if (!value) return undefined;
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return undefined;
}

/**
 * Accepts either a Bearer Firebase ID token (existing admin routes)
 * or the HttpOnly __session cookie created by POST /api/auth/session.
 */
export async function requireApiUser(request: Request): Promise<{ uid: string } | null> {
  const authHeader = request.headers.get('authorization') || '';
  const bearer = /^Bearer\s+/i.test(authHeader) ? authHeader.replace(/^Bearer\s+/i, '').trim() : '';
  if (bearer) {
    const user = await getUserFromToken(bearer);
    return user?.uid ? { uid: user.uid } : null;
  }

  const session = readRequestCookie(request, SESSION_COOKIE_NAME);
  if (!session) return null;

  const auth = await getAdminAuth();
  const decoded = await auth.verifySessionCookie(session, true);
  return decoded?.uid ? { uid: decoded.uid } : null;
}

export async function rejectIfUnauthenticated(request: Request) {
  try {
    const user = await requireApiUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return null;
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

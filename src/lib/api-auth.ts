import { NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/firebase-admin';
import type { UserProfile } from '@/lib/types';

export interface AuthenticatedUser extends UserProfile {
  uid: string;
}

export const SESSION_COOKIE_NAME = 'ezm_session';
export const SESSION_MAX_AGE_MS = 60 * 60 * 24 * 7 * 1000; // 7 days

export function sessionCookieOptions(request?: Request, maxAgeSeconds: number = SESSION_MAX_AGE_MS / 1000) {
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

/**
 * Centralized API authentication helper.
 * Extracts Bearer token from Authorization header, verifies it with Firebase Admin,
 * and returns the authenticated user object or a pre-formatted 401/403 NextResponse error.
 */
export async function authenticateApiRequest(request: Request): Promise<
  { user: AuthenticatedUser; error: null } | { user: null; error: NextResponse }
> {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  const token = authHeader?.split('Bearer ')[1]?.trim();

  if (!token) {
    return {
      user: null,
      error: NextResponse.json(
        { error: 'UNAUTHENTICATED', message: 'Missing Authorization header.' },
        { status: 401 }
      ),
    };
  }

  try {
    const user = await getUserFromToken(token);
    if (!user) {
      return {
        user: null,
        error: NextResponse.json(
          { error: 'UNAUTHORIZED', message: 'User token verification returned null.' },
          { status: 401 }
        ),
      };
    }
    return { user: user as AuthenticatedUser, error: null };
  } catch (err: any) {
    return {
      user: null,
      error: NextResponse.json(
        { error: 'INVALID_TOKEN', message: err?.message || 'Token verification failed.' },
        { status: 401 }
      ),
    };
  }
}

/**
 * Convenience helper for API routes requiring authentication.
 * Returns null if request is authenticated, or NextResponse with status 401/403 if unauthenticated.
 */
export async function rejectIfUnauthenticated(request: Request): Promise<NextResponse | null> {
  const { error } = await authenticateApiRequest(request);
  return error;
}

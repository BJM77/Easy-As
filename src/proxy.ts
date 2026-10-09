import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Add the routes that require authentication
const protectedRoutes = [
  '/dashboard',
  '/calculator',
  '/rate-card',
  '/info',
  '/status',
  '/org',
  '/vip',
  '/location-lookup',
  '/ai-guru',
  '/live',
  '/problem-log',
  '/admin'
];

/**
 * Edge proxy cannot import firebase-admin. Presence of the HttpOnly __session
 * cookie (set by POST /api/auth/session) is the logged-in check. The cookie
 * value is a Firebase session JWT; API routes verify it with the Admin SDK.
 * Public routes (/, /login, /register) and static assets are not in this list.
 */
function hasSessionCookie(request: NextRequest): boolean {
  const value = request.cookies.get('__session')?.value;
  if (!value) return false;
  const parts = value.split('.');
  return parts.length === 3 && parts.every((part) => part.length > 0);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = protectedRoutes.some(route =>
    pathname === route || pathname.startsWith(`${route}/`)
  );

  if (isProtected && !hasSessionCookie(request)) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

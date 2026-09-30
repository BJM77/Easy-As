import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Add the routes that require authentication
const protectedRoutes = [
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

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Check if it's a protected route (or starts with one)
  const isProtected = protectedRoutes.some(route => 
    pathname === route || pathname.startsWith(`${route}/`)
  );

  if (isProtected) {
    // We check for some auth indicator here. 
    // Since Firebase client auth sets cookies optionally, we check for a known auth cookie or token.
    // However, a simple robust way if Firebase auth doesn't set cookies is to use standard Firebase Auth.
    // If the app relies solely on client-side Firebase Auth, we might need to handle this in a client layout.
    // But let's assume we can at least check if there's *any* auth token/session.
    
    // For now, let's look for a generic session cookie. 
    const session = request.cookies.get('__session') || request.cookies.get('firebase-auth-token');
    
    if (!session) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
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

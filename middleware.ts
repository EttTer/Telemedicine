import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // The actual authentication logic using @supabase/ssr will be implemented here later.
  // For now, this is a placeholder structure for the route protection.

  // 1. Protect Practice / Admin routes
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/consultations') || pathname.startsWith('/admin')) {
    // Check Supabase session
    // if (!session) return NextResponse.redirect(new URL('/login', request.url))
  }

  // 2. Protect Patient routes
  if (pathname.startsWith('/consultation/') && !pathname.includes('/api/')) {
    // Extract token from URL
    // Validate token exists in DB and is not expired
    // if (!validToken) return NextResponse.redirect(new URL('/invalid-link', request.url))
  }

  // 3. Prevent indexing
  const response = NextResponse.next()
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
  
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}

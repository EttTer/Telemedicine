import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname
  const protectedPage = ['/dashboard', '/consultations', '/admin'].some(
    prefix => path === prefix || path.startsWith(`${prefix}/`)
  )
  if (protectedPage && !user) {
    const redirect = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie))
    response = redirect
  }
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

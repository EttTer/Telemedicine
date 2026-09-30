import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const origin = new URL(request.url).origin
  if (request.headers.get('origin') !== origin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { error } = await createClient().auth.signOut()
  if (error) return NextResponse.json({ error: 'Odhlášení se nezdařilo.' }, { status: 500 })
  return NextResponse.redirect(new URL('/login', request.url), 303)
}

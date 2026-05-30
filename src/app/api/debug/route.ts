import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    // 1. Check auth session
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not logged in', authError })
    }

    // 2. Check env vars
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !serviceKey) {
      return NextResponse.json({ error: 'Missing env vars', url: !!url, serviceKey: !!serviceKey })
    }

    // 3. Try admin client lookup
    const admin = createAdminClient(url, serviceKey)

    const { data: userData, error: userError } = await admin
      .from('staff')
      .select('*')
      .eq('id', user.id)
      .single()

    const { data: allUsers, error: allUsersError } = await admin
      .from('staff')
      .select('id, practice_id, role, first_name, last_name')

    return NextResponse.json({
      authUserId: user.id,
      authUserEmail: user.email,
      userRow: userData,
      userError: userError?.message,
      allUsers,
      allUsersError: allUsersError?.message,
    })
  } catch (err: any) {
    return NextResponse.json({ fatalError: err.message })
  }
}

import 'server-only'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function getStaffContext(options: { allowMfaSetup?: boolean } = {}) {
  const session = await createClient()
  const { data: { user }, error: authError } = await session.auth.getUser()
  if (authError || !user) return { status: 401 as const, staff: null, admin: null }
  if (!options.allowMfaSetup) {
    const { data, error } = await session.auth.mfa.getAuthenticatorAssuranceLevel()
    if (error || data?.currentLevel !== 'aal2') return { status: 428 as const, staff: null, admin: null }
  }

  // The privileged query is restricted to the verified caller's own profile.
  const admin = createAdminClient()
  const { data: staff, error } = await admin.from('staff')
    .select('id, practice_id, role, first_name, last_name')
    .eq('id', user.id).single()
  if (error || !staff?.practice_id || !['admin', 'doctor', 'nurse'].includes(staff.role)) {
    return { status: 403 as const, staff: null, admin: null }
  }
  return { status: 200 as const, staff, admin }
}

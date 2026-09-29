import 'server-only'
import { createHash } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/server'

// Read-only invitation validation; exchanging it for a patient session is a later milestone.
export async function getPatientConsultation(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null
  const admin = createAdminClient()
  const { data: invitation, error } = await admin.from('consultation_tokens')
    .select('consultation_id')
    .eq('token_hash', createHash('sha256').update(token).digest('hex'))
    .eq('is_used', false)
    .gt('expires_at', new Date().toISOString())
    .single()
  if (error || !invitation) return null
  const { data: consultation, error: consultationError } = await admin.from('consultations')
    .select('id, status, practices(name, contact_phone)')
    .eq('id', invitation.consultation_id)
    .in('status', ['scheduled', 'waiting', 'in_progress'])
    .single()
  return consultationError ? null : consultation
}

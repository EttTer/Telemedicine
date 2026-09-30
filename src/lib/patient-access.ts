import 'server-only'
import { createHash } from 'node:crypto'
import { getPatientSecret, hashSecret, secretPattern } from '@/lib/workflow'
import { createAdminClient } from '@/lib/supabase/server'

// A used invitation works only in the browser that holds its valid patient session.
export async function getPatientConsultation(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null
  const admin = createAdminClient()
  const secret = getPatientSecret(token)
  if (secret && secretPattern.test(secret)) {
    const { data: session } = await admin.from('patient_sessions').select('consultation_id')
      .eq('invitation_hash', hashSecret(token)).eq('session_hash', hashSecret(secret))
      .is('revoked_at', null).gt('expires_at', new Date().toISOString()).single()
    if (session) {
      const { data } = await admin.from('consultations').select('id, status, practices(name, contact_phone)')
        .eq('id', session.consultation_id).single()
      return data
    }
  }
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

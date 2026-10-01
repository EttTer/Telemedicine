import 'server-only'
import { createHash } from 'node:crypto'
import { getPatientSecret, hashSecret, secretPattern } from '@/lib/workflow'
import { createAdminClient } from '@/lib/supabase/server'

// A used invitation works only in the browser that holds its valid patient session.
export async function getPatientConsultation(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null
  const admin = createAdminClient()
  const secret = await getPatientSecret(token)
  if (secret && secretPattern.test(secret)) {
    const { data: session } = await admin.from('patient_sessions').select('consultation_id')
      .eq('invitation_hash', hashSecret(token)).eq('session_hash', hashSecret(secret))
      .is('revoked_at', null).gt('expires_at', new Date().toISOString()).single()
    if (session) {
      const { data } = await admin.from('consultations').select('id, status, practice_id, doctor_id, identity_verification_method, practices(name, contact_phone)')
        .eq('id', session.consultation_id).single()
      return data ? enrich(data) : null
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
    .select('id, status, practice_id, doctor_id, identity_verification_method, practices(name, contact_phone)')
    .eq('id', invitation.consultation_id)
    .in('status', ['scheduled', 'waiting', 'in_progress'])
    .single()
  return consultationError || !consultation ? null : enrich(consultation)
  async function enrich(c: any) {
    const { data: profile } = await admin.from('practice_compliance').select('legal_name,ico,address,privacy_contact,retention_notice,legal_basis_notice,vendor_notice,practitioner_identity_method').eq('practice_id',c.practice_id).maybeSingle()
    const practitioner = c.doctor_id ? (await admin.from('staff').select('title_before,first_name,last_name,title_after').eq('id',c.doctor_id).eq('practice_id',c.practice_id).maybeSingle()).data : null
    const { practice_id, doctor_id, ...publicContext } = c
    return {...publicContext, profile:profile || {}, practitioner}
  }
}

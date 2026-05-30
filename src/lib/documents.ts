import { createAdminClient } from './supabase/server'
import { logAuditEvent } from './audit'

export async function grantUploadPermission(consultationId: string, doctorId: string, durationMinutes: number = 30) {
  const supabase = createAdminClient()
  
  const expiresAt = new Date()
  expiresAt.setMinutes(expiresAt.getMinutes() + durationMinutes)

  const { data, error } = await supabase
    .from('document_upload_requests')
    .insert([
      {
        consultation_id: consultationId,
        requested_by: doctorId,
        is_active: true,
        expires_at: expiresAt.toISOString(),
      }
    ])
    .select()
    .single()

  if (error) throw error

  await logAuditEvent({
    consultationId,
    actorId: doctorId,
    actorRole: 'doctor', // We assume doctor here for simplicity, could be nurse
    action: 'upload_permission_granted',
    metadata: { requestId: data.id, expiresAt: data.expires_at }
  })

  return data
}

export async function revokeUploadPermission(requestId: string, doctorId: string) {
  const supabase = createAdminClient()
  
  const { data, error } = await supabase
    .from('document_upload_requests')
    .update({ 
      is_active: false,
      revoked_at: new Date().toISOString()
    })
    .eq('id', requestId)
    .select()
    .single()

  if (error) throw error

  await logAuditEvent({
    consultationId: data.consultation_id,
    actorId: doctorId,
    actorRole: 'doctor',
    action: 'upload_permission_revoked',
    metadata: { requestId }
  })

  return data
}

export async function checkUploadPermission(consultationId: string) {
  const supabase = createAdminClient()
  
  const { data, error } = await supabase
    .from('document_upload_requests')
    .select('*')
    .eq('consultation_id', consultationId)
    .eq('is_active', true)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
    throw error
  }

  return data || null
}

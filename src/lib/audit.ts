import { createAdminClient } from './supabase/server'

type AuditEvent = {
  practiceId?: string
  consultationId?: string
  actorId?: string
  actorRole: 'system' | 'patient' | 'admin' | 'doctor' | 'nurse'
  action: string
  metadata?: Record<string, any>
  ipAddress?: string
  userAgent?: string
}

export async function logAuditEvent(event: AuditEvent) {
  const supabase = createAdminClient()
  
  const { error } = await supabase
    .from('audit_logs')
    .insert([
      {
        practice_id: event.practiceId,
        consultation_id: event.consultationId,
        actor_id: event.actorId,
        actor_role: event.actorRole,
        action: event.action,
        metadata: event.metadata,
        ip_address: event.ipAddress,
        user_agent: event.userAgent,
      }
    ])

  if (error) {
    console.error('Failed to write audit log:', error)
    // In a production app we might want to alert if audit logging fails
  }
}

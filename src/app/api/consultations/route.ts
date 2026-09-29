import { NextResponse } from 'next/server'
import { getStaffContext } from '@/lib/staff'
import { logAuditEvent } from '@/lib/audit'
import { z } from 'zod'
import crypto from 'crypto'

const consultationInput = z.object({
  consultation_type: z.string().trim().min(1).max(200),
  patient_first_name: z.string().trim().max(100).optional(),
  patient_last_name: z.string().trim().max(100).optional(),
  identity_verification_method: z.string().trim().min(1).max(200),
  note_to_patient: z.string().trim().max(2000).optional(),
}).strict()

export async function POST(request: Request) {
  try {
    const context = await getStaffContext()
    if (!context.staff) {
      return NextResponse.json({ error: 'Přístup není povolen.' }, { status: context.status })
    }
    const parsed = consultationInput.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Neplatné údaje konzultace.' }, { status: 400 })
    const body = parsed.data
    const userData = context.staff
    const user = { id: userData.id }
    const supabaseAdmin = context.admin

    // 1. Create the consultation record
    const { data: consultation, error: consultationError } = await supabaseAdmin
      .from('consultations')
      .insert([
        {
          practice_id: userData.practice_id,
          created_by: user.id,
          doctor_id: userData.role === 'doctor' ? user.id : null,
          scheduled_for: new Date().toISOString(),
          consultation_type: body.consultation_type || 'Obecná konzultace',
          patient_first_name: body.patient_first_name || null,
          patient_last_name: body.patient_last_name || null,
          identity_verification_method: body.identity_verification_method || 'Potvrzení lékařem',
          note_to_patient: body.note_to_patient || null,
          status: 'scheduled',
        },
      ])
      .select()
      .single()

    if (consultationError) {
      console.error('Error creating consultation:', consultationError)
      throw consultationError
    }

    // 2. Generate a cryptographically secure one-time token
    const token = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24) // 24-hour expiry

    const { error: tokenError } = await supabaseAdmin
      .from('consultation_tokens')
      .insert([
        {
          consultation_id: consultation.id,
          token_hash: tokenHash,
          expires_at: expiresAt.toISOString(),
          is_used: false,
        },
      ])

    if (tokenError) {
      console.error('Error creating token:', tokenError)
      throw tokenError
    }

    // 3. Write immutable audit log entry
    await logAuditEvent({
      practiceId: userData.practice_id,
      consultationId: consultation.id,
      actorId: user.id,
      actorRole: userData.role as any,
      action: 'consultation_created',
      metadata: {
        type: body.consultation_type,
        verificationMethod: body.identity_verification_method,
      },
    })

    // Return only what the client needs — the raw token is returned once and never stored in plaintext
    return NextResponse.json({ id: consultation.id, token }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Consultation creation error:', error)
    return NextResponse.json({ error: 'Interní chyba serveru' }, { status: 500 })
  }
}

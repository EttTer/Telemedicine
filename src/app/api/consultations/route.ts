import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { logAuditEvent } from '@/lib/audit'
import crypto from 'crypto'

// Admin client uses service role key and bypasses RLS entirely.
// Used ONLY to read the logged-in user's own profile row, which would
// otherwise cause RLS self-reference recursion.
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch the user's practice_id using the admin client to avoid RLS recursion
    const { data: userData, error: userError } = await supabaseAdmin
      .from('staff')
      .select('practice_id, role')
      .eq('id', user.id)
      .single()

    if (userError) {
      console.error('Error fetching user profile:', userError)
    }

    if (!userData) {
      console.error('User profile not found for auth.uid:', user.id)
      return NextResponse.json(
        { error: 'Profil uživatele nebyl nalezen. Zkontrolujte, zda byl váš účet propojen s ordinací.' },
        { status: 400 }
      )
    }

    const body = await request.json()

    // 1. Create the consultation record
    const { data: consultation, error: consultationError } = await supabaseAdmin
      .from('consultations')
      .insert([
        {
          practice_id: userData.practice_id,
          created_by: user.id,
          doctor_id: user.id,
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
    return NextResponse.json({ id: consultation.id, token })
  } catch (error) {
    console.error('Consultation creation error:', error)
    return NextResponse.json({ error: 'Interní chyba serveru' }, { status: 500 })
  }
}

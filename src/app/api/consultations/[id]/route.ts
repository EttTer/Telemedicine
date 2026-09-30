import { NextResponse } from 'next/server'
import { getStaffContext } from '@/lib/staff'
import { z } from 'zod'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const context = await getStaffContext()
    if (!context.staff) return NextResponse.json({ error: 'Unauthorized' }, { status: context.status })
    if (!z.string().uuid().safeParse(params.id).success) {
      return NextResponse.json({ error: 'Invalid consultation ID' }, { status: 400 })
    }
    const { data: consultation, error } = await context.admin.from('consultations')
      .select('id, practice_id, doctor_id, scheduled_for, consultation_type, patient_first_name, patient_last_name, identity_verification_method, note_to_patient, status, created_by, created_at, patients(first_name,last_name,date_of_birth,contact_info,reason_for_visit), waiting_room_sessions(status,joined_at,updated_at)')
      .eq('id', params.id)
      .eq('practice_id', context.staff.practice_id)
      .single()
    if (error || !consultation) return NextResponse.json({ error: 'Consultation not found' }, { status: 404 })
    return NextResponse.json(consultation, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

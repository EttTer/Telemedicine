export type Role = 'admin' | 'doctor' | 'nurse' | 'patient' | 'system'

export type Practice = {
  id: string
  name: string
  contact_email?: string
  contact_phone?: string
}

export type User = {
  id: string
  practice_id: string
  role: Role
  first_name: string
  last_name: string
  title_before?: string
  title_after?: string
}

export type ConsultationStatus = 'scheduled' | 'waiting' | 'in_progress' | 'completed' | 'cancelled'

export type Consultation = {
  id: string
  practice_id: string
  doctor_id?: string
  scheduled_for: string
  consultation_type: string
  patient_first_name?: string
  patient_last_name?: string
  identity_verification_method: string
  note_to_patient?: string
  status: ConsultationStatus
  created_by: string
  created_at: string
}

export type Patient = {
  id: string
  consultation_id: string
  first_name: string
  last_name: string
  date_of_birth: string
  contact_info?: string
  reason_for_visit?: string
}

export type UploadRequest = {
  id: string
  consultation_id: string
  is_active: boolean
  expires_at: string
}

-- Synthetic local fixture only. Never run this file in the hosted project.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
create table if not exists practices (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_email text,
  contact_phone text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Drop old "users" table if it exists and replace with "staff"
drop table if exists users cascade;

create table if not exists staff (
  id uuid primary key references auth.users on delete cascade,
  practice_id uuid references practices(id) not null,
  role text not null check (role in ('admin', 'doctor', 'nurse')),
  first_name text not null,
  last_name text not null,
  title_before text,
  title_after text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table if not exists consultations (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid references practices(id) not null,
  doctor_id uuid references staff(id),
  scheduled_for timestamptz not null,
  consultation_type text not null,
  patient_first_name text,
  patient_last_name text,
  identity_verification_method text not null,
  note_to_patient text,
  status text not null default 'scheduled' check (status in ('scheduled', 'waiting', 'in_progress', 'completed', 'cancelled')),
  created_by uuid references staff(id) not null,
  created_at timestamptz default now() not null
);

create table if not exists consultation_tokens (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid references consultations(id) on delete cascade not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  is_used boolean default false not null,
  created_at timestamptz default now() not null
);

create table if not exists patients (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid references consultations(id) on delete cascade not null unique,
  first_name text not null,
  last_name text not null,
  date_of_birth date not null,
  contact_info text,
  reason_for_visit text,
  created_at timestamptz default now() not null
);

create table if not exists identity_verifications (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid references consultations(id) on delete cascade not null unique,
  method text not null,
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  verified_by uuid references staff(id),
  verified_at timestamptz,
  created_at timestamptz default now() not null
);

create table if not exists recording_consents (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid references consultations(id) on delete cascade not null unique,
  patient_id uuid references patients(id) on delete cascade,
  consent_given boolean not null,
  created_at timestamptz default now() not null
);

create table if not exists waiting_room_sessions (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid references consultations(id) on delete cascade not null unique,
  patient_id uuid references patients(id) on delete cascade,
  joined_at timestamptz default now() not null,
  status text not null default 'waiting' check (status in ('waiting', 'admitted', 'left', 'removed')),
  updated_at timestamptz default now() not null
);

create table if not exists document_upload_requests (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid references consultations(id) on delete cascade not null,
  requested_by uuid references staff(id) not null,
  is_active boolean default true not null,
  expires_at timestamptz not null,
  created_at timestamptz default now() not null,
  revoked_at timestamptz
);

create table if not exists uploaded_documents (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid references consultations(id) on delete cascade not null,
  patient_id uuid references patients(id),
  upload_request_id uuid references document_upload_requests(id),
  file_name text not null,
  file_type text not null,
  file_size integer not null,
  storage_path text not null,
  context text not null check (context in ('waiting_room', 'video_room')),
  uploaded_at timestamptz default now() not null
);

create table if not exists video_sessions (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid references consultations(id) on delete cascade not null unique,
  provider_room_id text,
  provider_room_url text,
  started_at timestamptz,
  ended_at timestamptz,
  ended_by uuid references staff(id),
  created_at timestamptz default now() not null
);

create table if not exists consultation_summaries (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid references consultations(id) on delete cascade not null unique,
  doctor_id uuid references staff(id) not null,
  summary_text text,
  technical_notes text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid references practices(id),
  consultation_id uuid references consultations(id),
  actor_id uuid,
  actor_role text not null check (actor_role in ('system', 'patient', 'admin', 'doctor', 'nurse')),
  action text not null,
  metadata jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz default now() not null
);


CREATE TABLE public.whereby_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id uuid NOT NULL UNIQUE REFERENCES consultations(id) ON DELETE CASCADE,
  room_url text NOT NULL, host_room_url text NOT NULL,
  expiry timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
ALTER TABLE public.practices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recording_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waiting_room_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_upload_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploaded_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whereby_meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view practice members" ON staff FOR SELECT USING (
  practice_id IN (SELECT practice_id FROM staff WHERE id = auth.uid())
);

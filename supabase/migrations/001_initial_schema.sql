-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Practices
create table practices (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  contact_email text,
  contact_phone text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Users (Staff)
-- Links to auth.users in Supabase
create table users (
  id uuid primary key references auth.users on delete cascade,
  practice_id uuid references practices(id) not null,
  role text not null check (role in ('admin', 'doctor', 'nurse')),
  first_name text not null,
  last_name text not null,
  title_before text,
  title_after text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Consultations
create table consultations (
  id uuid primary key default uuid_generate_v4(),
  practice_id uuid references practices(id) not null,
  doctor_id uuid references users(id),
  scheduled_for timestamp with time zone not null,
  consultation_type text not null,
  patient_first_name text,
  patient_last_name text,
  identity_verification_method text not null,
  note_to_patient text,
  status text not null default 'scheduled' check (status in ('scheduled', 'waiting', 'in_progress', 'completed', 'cancelled')),
  created_by uuid references users(id) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Consultation Tokens (One-time links)
create table consultation_tokens (
  id uuid primary key default uuid_generate_v4(),
  consultation_id uuid references consultations(id) on delete cascade not null,
  token_hash text not null unique,
  expires_at timestamp with time zone not null,
  is_used boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Patients (Transient identity data per consultation)
create table patients (
  id uuid primary key default uuid_generate_v4(),
  consultation_id uuid references consultations(id) on delete cascade not null unique,
  first_name text not null,
  last_name text not null,
  date_of_birth date not null,
  contact_info text,
  reason_for_visit text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Identity Verifications
create table identity_verifications (
  id uuid primary key default uuid_generate_v4(),
  consultation_id uuid references consultations(id) on delete cascade not null unique,
  method text not null,
  status text not null check (status in ('pending', 'verified', 'rejected')),
  verified_by uuid references users(id),
  verified_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. Recording Consents
create table recording_consents (
  id uuid primary key default uuid_generate_v4(),
  consultation_id uuid references consultations(id) on delete cascade not null unique,
  patient_id uuid references patients(id) on delete cascade not null,
  consent_given boolean not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 8. Waiting Room Sessions
create table waiting_room_sessions (
  id uuid primary key default uuid_generate_v4(),
  consultation_id uuid references consultations(id) on delete cascade not null unique,
  patient_id uuid references patients(id) on delete cascade not null,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  status text not null default 'waiting' check (status in ('waiting', 'admitted', 'left', 'removed')),
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 9. Document Upload Requests
create table document_upload_requests (
  id uuid primary key default uuid_generate_v4(),
  consultation_id uuid references consultations(id) on delete cascade not null,
  requested_by uuid references users(id) not null,
  is_active boolean default true not null,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  revoked_at timestamp with time zone
);

-- 10. Uploaded Documents
create table uploaded_documents (
  id uuid primary key default uuid_generate_v4(),
  consultation_id uuid references consultations(id) on delete cascade not null,
  patient_id uuid references patients(id) not null,
  upload_request_id uuid references document_upload_requests(id),
  file_name text not null,
  file_type text not null,
  file_size integer not null,
  storage_path text not null,
  context text not null check (context in ('waiting_room', 'video_room')),
  uploaded_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 11. Video Sessions
create table video_sessions (
  id uuid primary key default uuid_generate_v4(),
  consultation_id uuid references consultations(id) on delete cascade not null unique,
  provider_room_id text,
  provider_room_url text,
  started_at timestamp with time zone,
  ended_at timestamp with time zone,
  ended_by uuid references users(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 12. Consultation Summaries
create table consultation_summaries (
  id uuid primary key default uuid_generate_v4(),
  consultation_id uuid references consultations(id) on delete cascade not null unique,
  doctor_id uuid references users(id) not null,
  summary_text text,
  technical_notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 13. Audit Logs (Immutable)
create table audit_logs (
  id uuid primary key default uuid_generate_v4(),
  practice_id uuid references practices(id),
  consultation_id uuid references consultations(id),
  actor_id uuid, -- Can be user(id) or patient(id) or null (system)
  actor_role text not null check (actor_role in ('system', 'patient', 'admin', 'doctor', 'nurse')),
  action text not null,
  metadata jsonb,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

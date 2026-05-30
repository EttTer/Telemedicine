-- ============================================================
-- DROP existing policies (safe to run even if they don't exist)
-- ============================================================
drop policy if exists "Staff can view their practice" on practices;
drop policy if exists "Staff can view practice members" on staff;
drop policy if exists "Staff can view their practice users" on users;
drop policy if exists "Staff can view practice consultations" on consultations;
drop policy if exists "Staff can insert consultations" on consultations;
drop policy if exists "Anyone authenticated can insert audit logs" on audit_logs;
drop policy if exists "Admins can view audit logs" on audit_logs;
drop policy if exists "No one can update audit logs" on audit_logs;
drop policy if exists "No one can delete audit logs" on audit_logs;
drop policy if exists "Audit logs are viewable by practice admins" on audit_logs;
drop policy if exists "Staff can view their practice users" on users;

-- ============================================================
-- Create tables (IF NOT EXISTS is safe to re-run)
-- ============================================================

create extension if not exists "uuid-ossp";

create table if not exists practices (
  id uuid primary key default uuid_generate_v4(),
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
  id uuid primary key default uuid_generate_v4(),
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
  id uuid primary key default uuid_generate_v4(),
  consultation_id uuid references consultations(id) on delete cascade not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  is_used boolean default false not null,
  created_at timestamptz default now() not null
);

create table if not exists patients (
  id uuid primary key default uuid_generate_v4(),
  consultation_id uuid references consultations(id) on delete cascade not null unique,
  first_name text not null,
  last_name text not null,
  date_of_birth date not null,
  contact_info text,
  reason_for_visit text,
  created_at timestamptz default now() not null
);

create table if not exists identity_verifications (
  id uuid primary key default uuid_generate_v4(),
  consultation_id uuid references consultations(id) on delete cascade not null unique,
  method text not null,
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  verified_by uuid references staff(id),
  verified_at timestamptz,
  created_at timestamptz default now() not null
);

create table if not exists recording_consents (
  id uuid primary key default uuid_generate_v4(),
  consultation_id uuid references consultations(id) on delete cascade not null unique,
  patient_id uuid references patients(id) on delete cascade,
  consent_given boolean not null,
  created_at timestamptz default now() not null
);

create table if not exists waiting_room_sessions (
  id uuid primary key default uuid_generate_v4(),
  consultation_id uuid references consultations(id) on delete cascade not null unique,
  patient_id uuid references patients(id) on delete cascade,
  joined_at timestamptz default now() not null,
  status text not null default 'waiting' check (status in ('waiting', 'admitted', 'left', 'removed')),
  updated_at timestamptz default now() not null
);

create table if not exists document_upload_requests (
  id uuid primary key default uuid_generate_v4(),
  consultation_id uuid references consultations(id) on delete cascade not null,
  requested_by uuid references staff(id) not null,
  is_active boolean default true not null,
  expires_at timestamptz not null,
  created_at timestamptz default now() not null,
  revoked_at timestamptz
);

create table if not exists uploaded_documents (
  id uuid primary key default uuid_generate_v4(),
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
  id uuid primary key default uuid_generate_v4(),
  consultation_id uuid references consultations(id) on delete cascade not null unique,
  provider_room_id text,
  provider_room_url text,
  started_at timestamptz,
  ended_at timestamptz,
  ended_by uuid references staff(id),
  created_at timestamptz default now() not null
);

create table if not exists consultation_summaries (
  id uuid primary key default uuid_generate_v4(),
  consultation_id uuid references consultations(id) on delete cascade not null unique,
  doctor_id uuid references staff(id) not null,
  summary_text text,
  technical_notes text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table if not exists audit_logs (
  id uuid primary key default uuid_generate_v4(),
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

-- ============================================================
-- Enable RLS
-- ============================================================
alter table practices enable row level security;
alter table staff enable row level security;
alter table consultations enable row level security;
alter table consultation_tokens enable row level security;
alter table patients enable row level security;
alter table identity_verifications enable row level security;
alter table recording_consents enable row level security;
alter table waiting_room_sessions enable row level security;
alter table document_upload_requests enable row level security;
alter table uploaded_documents enable row level security;
alter table video_sessions enable row level security;
alter table consultation_summaries enable row level security;
alter table audit_logs enable row level security;

-- ============================================================
-- RLS Policies
-- ============================================================
create policy "Staff can view their practice"
  on practices for select
  using (id in (select practice_id from staff where id = auth.uid()));

create policy "Staff can view practice members"
  on staff for select
  using (practice_id in (select practice_id from staff where id = auth.uid()));

create policy "Staff can view practice consultations"
  on consultations for select
  using (practice_id in (select practice_id from staff where id = auth.uid()));

create policy "Staff can insert consultations"
  on consultations for insert
  with check (practice_id in (select practice_id from staff where id = auth.uid()));

create policy "Anyone authenticated can insert audit logs"
  on audit_logs for insert with check (true);

create policy "Admins can view audit logs"
  on audit_logs for select
  using (practice_id in (select practice_id from staff where id = auth.uid() and role = 'admin'));

create policy "No one can update audit logs"
  on audit_logs for update using (false);

create policy "No one can delete audit logs"
  on audit_logs for delete using (false);

-- ============================================================
-- Seed: Demo ordinace
-- ============================================================
insert into practices (id, name, contact_email, contact_phone)
values (
  '11111111-1111-1111-1111-111111111111',
  'Poliklinika Modřany – MUDr. Novák',
  'ordinace@poliklinikamodrany.cz',
  '+420 123 456 789'
) on conflict (id) do nothing;

-- ============================================================
-- After running this script, insert your staff record:
-- (replace the UUID with your own from auth.users)
-- ============================================================
-- insert into staff (id, practice_id, role, first_name, last_name)
-- values (
--   '6c55af28-b600-495b-98da-ae3626478449',
--   '11111111-1111-1111-1111-111111111111',
--   'doctor', 'Karel', 'Doktor'
-- );

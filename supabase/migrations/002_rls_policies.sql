-- Enable RLS on all tables
alter table practices enable row level security;
alter table users enable row level security;
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

-- We will implement the actual RLS policies later.
-- For MVP development, we can create a permissive policy for testing if needed,
-- but the spec requires Row Level Security, so we must be careful.

-- Basic policy for staff (based on auth.users and the users table)
-- This is a placeholder for the full RLS implementation.
create policy "Staff can view their practice"
  on practices for select
  using (
    id in (
      select practice_id from users where id = auth.uid()
    )
  );

create policy "Staff can view their practice users"
  on users for select
  using (
    practice_id in (
      select practice_id from users where id = auth.uid()
    )
  );

create policy "Staff can view their practice consultations"
  on consultations for select
  using (
    practice_id in (
      select practice_id from users where id = auth.uid()
    )
  );

create policy "Staff can view their practice patients"
  on patients for select
  using (
    consultation_id in (
      select id from consultations where practice_id in (
        select practice_id from users where id = auth.uid()
      )
    )
  );

create policy "Audit logs are viewable by practice admins"
  on audit_logs for select
  using (
    practice_id in (
      select practice_id from users where id = auth.uid() and role = 'admin'
    )
  );

-- No update/delete policies for audit_logs
create policy "No one can update audit logs"
  on audit_logs for update
  using (false);

create policy "No one can delete audit logs"
  on audit_logs for delete
  using (false);

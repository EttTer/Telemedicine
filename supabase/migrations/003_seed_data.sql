-- Insert dummy practice
insert into practices (id, name, contact_email, contact_phone)
values (
  '11111111-1111-1111-1111-111111111111',
  'Poliklinika Modřany - MUDr. Novák',
  'ordinace@poliklinikamodrany.cz',
  '+420 123 456 789'
) on conflict do nothing;

-- We will assume there are Supabase auth users created via the dashboard or API, 
-- but we can't reliably seed auth.users in a raw SQL script without hardcoding passwords.
-- For local dev, we will provide a script to create users later using the Supabase API.

-- Insert dummy consultation for testing the patient flow
insert into consultations (
  id,
  practice_id,
  scheduled_for,
  consultation_type,
  patient_first_name,
  patient_last_name,
  identity_verification_method,
  status,
  created_by
)
values (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  timezone('utc'::text, now() + interval '1 hour'),
  'Pravidelná kontrola',
  'Jan',
  'Novák',
  'SMS kód',
  'scheduled',
  '11111111-1111-1111-1111-111111111111' -- Mocked created_by
) on conflict do nothing;

-- Insert dummy token
insert into consultation_tokens (
  id,
  consultation_id,
  token_hash,
  expires_at,
  is_used
)
values (
  '33333333-3333-3333-3333-333333333333',
  '22222222-2222-2222-2222-222222222222',
  'dummy_token_hash_for_testing',
  timezone('utc'::text, now() + interval '1 day'),
  false
) on conflict do nothing;

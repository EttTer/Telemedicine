-- Repair the existing project after the 2026-09-29 metadata review.
-- No patient/staff rows are changed. Run this file as one transaction.
-- Browser writes remain denied; validated server routes perform mutations.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Stop rather than silently preserve an unknown permissive policy.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY['practices', 'staff', 'consultations', 'consultation_tokens', 'patients', 'identity_verifications', 'recording_consents', 'waiting_room_sessions', 'document_upload_requests', 'uploaded_documents', 'video_sessions', 'consultation_summaries', 'audit_logs', 'whereby_meetings'])
      AND NOT (tablename = 'staff' AND policyname = 'Staff can view practice members')
  ) THEN
    RAISE EXCEPTION 'Unexpected policies detected. Review current policies before applying this one-time repair.';
  END IF;
END $$;

ALTER TABLE public.practices ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.practices FROM PUBLIC, anon, authenticated;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.staff FROM PUBLIC, anon, authenticated;
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.consultations FROM PUBLIC, anon, authenticated;
ALTER TABLE public.consultation_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.consultation_tokens FROM PUBLIC, anon, authenticated;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.patients FROM PUBLIC, anon, authenticated;
ALTER TABLE public.identity_verifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.identity_verifications FROM PUBLIC, anon, authenticated;
ALTER TABLE public.recording_consents ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.recording_consents FROM PUBLIC, anon, authenticated;
ALTER TABLE public.waiting_room_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.waiting_room_sessions FROM PUBLIC, anon, authenticated;
ALTER TABLE public.document_upload_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.document_upload_requests FROM PUBLIC, anon, authenticated;
ALTER TABLE public.uploaded_documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.uploaded_documents FROM PUBLIC, anon, authenticated;
ALTER TABLE public.video_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.video_sessions FROM PUBLIC, anon, authenticated;
ALTER TABLE public.consultation_summaries ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.consultation_summaries FROM PUBLIC, anon, authenticated;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.audit_logs FROM PUBLIC, anon, authenticated;
ALTER TABLE public.whereby_meetings ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.whereby_meetings FROM PUBLIC, anon, authenticated;

-- Also remove any column-level grants, which table-level REVOKE does not remove.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ANY (ARRAY['practices', 'staff', 'consultations', 'consultation_tokens', 'patients', 'identity_verifications', 'recording_consents', 'waiting_room_sessions', 'document_upload_requests', 'uploaded_documents', 'video_sessions', 'consultation_summaries', 'audit_logs', 'whereby_meetings'])
  LOOP
    EXECUTE format('REVOKE SELECT (%I), INSERT (%I), UPDATE (%I), REFERENCES (%I) ON TABLE public.%I FROM PUBLIC, anon, authenticated',
      r.column_name, r.column_name, r.column_name, r.column_name, r.table_name);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Staff can view practice members" ON public.staff;

-- A worker may read only their own profile; no self-referencing query and no
-- SECURITY DEFINER function. Team administration stays behind server authorization.
CREATE POLICY staff_read_self ON public.staff
  FOR SELECT TO authenticated USING (id = (SELECT auth.uid()));

CREATE POLICY practices_read_own ON public.practices
  FOR SELECT TO authenticated USING (
    id IN (SELECT practice_id FROM public.staff WHERE id = (SELECT auth.uid()))
  );

CREATE POLICY consultations_read_own_practice ON public.consultations
  FOR SELECT TO authenticated USING (
    practice_id IN (SELECT practice_id FROM public.staff WHERE id = (SELECT auth.uid()))
  );

CREATE POLICY patients_read_own_practice ON public.patients
  FOR SELECT TO authenticated USING (
    consultation_id IN (SELECT id FROM public.consultations)
  );

CREATE POLICY identity_verifications_read_own_practice ON public.identity_verifications
  FOR SELECT TO authenticated USING (
    consultation_id IN (SELECT id FROM public.consultations)
  );

CREATE POLICY recording_consents_read_own_practice ON public.recording_consents
  FOR SELECT TO authenticated USING (
    consultation_id IN (SELECT id FROM public.consultations)
  );

CREATE POLICY waiting_room_sessions_read_own_practice ON public.waiting_room_sessions
  FOR SELECT TO authenticated USING (
    consultation_id IN (SELECT id FROM public.consultations)
  );

CREATE POLICY document_upload_requests_read_own_practice ON public.document_upload_requests
  FOR SELECT TO authenticated USING (
    consultation_id IN (SELECT id FROM public.consultations)
  );

CREATE POLICY uploaded_documents_read_own_practice ON public.uploaded_documents
  FOR SELECT TO authenticated USING (
    consultation_id IN (SELECT id FROM public.consultations)
  );

CREATE POLICY consultation_summaries_read_own_practice ON public.consultation_summaries
  FOR SELECT TO authenticated USING (
    consultation_id IN (SELECT id FROM public.consultations)
  );

CREATE POLICY audit_logs_read_own_admin ON public.audit_logs
  FOR SELECT TO authenticated USING (
    practice_id IN (
      SELECT practice_id FROM public.staff
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

GRANT SELECT ON TABLE public.staff, public.practices, public.consultations, public.patients, public.identity_verifications, public.recording_consents, public.waiting_room_sessions, public.document_upload_requests, public.uploaded_documents, public.consultation_summaries, public.audit_logs TO authenticated;

-- consultation_tokens, whereby_meetings and video_sessions have NO client grants.
-- Existing service_role privileges are preserved. It must remain server-only.

-- Check grants under the actual role inheritance, not only explicit grants.
DO $$
DECLARE t text; r text; privilege text;
BEGIN
  FOREACH t IN ARRAY ARRAY['practices', 'staff', 'consultations', 'consultation_tokens', 'patients', 'identity_verifications', 'recording_consents', 'waiting_room_sessions', 'document_upload_requests', 'uploaded_documents', 'video_sessions', 'consultation_summaries', 'audit_logs', 'whereby_meetings'] LOOP
    IF has_table_privilege('anon', 'public.' || t, 'SELECT') THEN
      RAISE EXCEPTION 'Unexpected inherited anonymous access to %', t;
    END IF;
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      FOREACH privilege IN ARRAY ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
        IF has_table_privilege(r, 'public.' || t, privilege) THEN
          RAISE EXCEPTION 'Unexpected inherited % privilege for % on %', privilege, r, t;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
  FOREACH t IN ARRAY ARRAY['consultation_tokens', 'whereby_meetings', 'video_sessions'] LOOP
    IF has_table_privilege('authenticated', 'public.' || t, 'SELECT') THEN
      RAISE EXCEPTION 'Sensitive table remains client-readable: %', t;
    END IF;
  END LOOP;
END $$;
COMMIT;

SELECT 'RLS repair applied; application sign-in still needs verification' AS result,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public'
    AND tablename = ANY (ARRAY['practices', 'staff', 'consultations', 'consultation_tokens', 'patients', 'identity_verifications', 'recording_consents', 'waiting_room_sessions', 'document_upload_requests', 'uploaded_documents', 'video_sessions', 'consultation_summaries', 'audit_logs', 'whereby_meetings'])) AS policy_count;

-- Password-only staff sign-in, explicitly requested by the operator.
-- Remove only the extra assurance-level restriction. Keep RLS, ownership
-- policies, grants, private storage and service-role-only RPCs unchanged.
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT schemaname, tablename FROM pg_policies
    WHERE schemaname = 'public' AND policyname = 'staff_mfa_required'
  LOOP
    EXECUTE format('DROP POLICY staff_mfa_required ON %I.%I', p.schemaname, p.tablename);
  END LOOP;
END $$;

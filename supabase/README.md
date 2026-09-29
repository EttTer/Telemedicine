# Existing Supabase project: restoration

Do not run the legacy migration files sequentially on the existing project.
They contain incompatible users/staff schemas and a destructive DROP TABLE CASCADE.
No database changes are part of this branch.

1. Run `inspect_existing_schema.sql` in SQL Editor (read only, no patient rows).
2. Review tables, foreign keys and RLS policies before preparing a forward migration.
3. The application now expects `public.staff` linked to `auth.users`.
4. Test any migration against a separate staging project first, with synthetic data.
5. Before production migration, verify backup and restoration procedures.

The staff self-referencing RLS policy in the legacy scripts still needs replacement.
Dashboard queries use RLS and require the repaired policies; do not disable RLS as a workaround.

Set Supabase keys and WHEREBY_API_KEY through the deployment environment, not Git or chat.

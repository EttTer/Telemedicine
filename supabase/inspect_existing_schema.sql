-- READ ONLY. Run in the existing project's SQL Editor.
-- Outputs structure and policies, never patient rows or API keys.
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;

select tablename, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public'
order by tablename, policyname;

select conrelid::regclass::text as table_name, conname,
       pg_get_constraintdef(oid) as definition
from pg_constraint
where connamespace = 'public'::regnamespace
order by table_name, conname;

select relname as table_name, relrowsecurity, relforcerowsecurity
from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r'
order by relname;

# Supabase Setup for Telemedicine App

This folder contains the database schema and Row Level Security (RLS) policies for the platform.

## Setup Instructions

1. **Create a new Supabase project** at [supabase.com](https://supabase.com).
2. **Run Migrations**:
   Go to the SQL Editor in your Supabase dashboard and run the files in the following order:
   - `001_initial_schema.sql` — Creates tables, enums, and foreign keys.
   - `002_rls_policies.sql` — Enables RLS and sets basic policies.
   - `003_seed_data.sql` — (Optional) Inserts mock data for testing.
3. **Configure Authentication**:
   - Go to Authentication -> Providers.
   - Ensure Email provider is enabled.
   - Optionally disable "Confirm email" for local testing.
4. **Environment Variables**:
   - Copy the Project URL and `anon` public key to your `.env.local` file:
     ```
     NEXT_PUBLIC_SUPABASE_URL=your-project-url
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
     ```
   - For backend admin tasks (like creating the Daily.co rooms or updating audit logs), add the `service_role` key:
     ```
     SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
     ```

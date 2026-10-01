# Supabase restoration

## Applied repair

`20260930073825_restore_practice_read_access.sql` was applied to the existing project on 2026-09-30 through the Supabase migration API. Its filename matches the returned migration history version. Do not run it again manually.

The repair preserves data and table structure. It replaces the recursive staff policy with self-profile access, scopes consultation and related reads to the caller's practice, and limits audit reads to practice admins. Client writes are denied. Server routes remain responsible for validating all mutations. Tokens, Whereby host URLs and video-session records remain server-only.

The old `001_*`, `002_*` and `003_*` scripts are historical and inconsistent. Do not replay them on the existing project or run a blanket database reset. The new repair is for the inspected existing schema; it is not a clean-install schema.

## Verification

- `npm run test:db`: 240 assertions using PostgreSQL via PGlite and synthetic data for two practices. Covers original recursion, own-practice reads, cross-practice exclusion, doctor/nurse/admin access, missing staff, anonymous access, denied mutations, column grants, secret tables, preserved server access and row counts.
- Hosted read-only check: one existing staff profile checked against its expected consultation count; unknown-user access denied; 11 policies present; anonymous consultation reads and authenticated token/host-link reads blocked.
- Security advisor now has three informational no-policy notices for intentionally server-only tables. Do not add public policies just to remove these notices.
- Leaked-password protection remains disabled and should be configured before pilot use: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

PGlite tests do not cover the Supabase Auth service, PostgREST, Storage or a real browser session. These still need application-level verification. The live database has only one staff profile, so the two-practice denial scenario was tested locally rather than by creating users in the hosted project.

## Whereby structure

The existing `whereby_meetings` table contains `id`, `consultation_id` (unique), `room_url`, `host_room_url`, `expiry`, and `created_at`. The provider meeting ID needed for API deletion must be persisted during the video-lifecycle implementation (for example in the existing `video_sessions.provider_room_id`). Never return host_room_url to patients.

## Local tests

Run `npm ci`, then `npm run test:db`. `supabase/tests/restoration_fixture.sql` is a disposable synthetic fixture. Never execute the fixture on the hosted project. No real project keys or data are needed.

## Consultation workflow — 30 September 2026

Applied `20260930115642_consultation_workflow.sql` to the existing project. This adds
`patient_sessions` and `video_room_claims`, both server-only with RLS and no browser grants.
`tm_staff_action` and `tm_patient_action` are invoker RPC functions executable only by
service_role. Consultation row locks serialize reissue/check-in/room admission. Creation
of a consultation, invitation hash and audit event is atomic. Existing records were not rewritten.

Test locally using `npm run test:workflow`; it creates synthetic data in disposable PGlite,
not the hosted database. Applied migration version matches hosted migration history.
Security advisor: five informational no-policy findings are intentional for server-only tables.
Existing warning remains: compromised-password protection is disabled.
Remediation: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

Before live use, configure Whereby Embedded as described in the root README and test a full
call on two devices, including denying media permissions and retrying failed termination.
No real Whereby call has been verified by the automated tests.


## Compliance workflow — 1 October 2026

Applied `20261001100825_compliance_workflow.sql` to the hosted project. The migration preserves existing data and adds instruction evidence,
practice disclosure fields, immutable saved versions/final snapshots and audit immutability.
Existing notes are imported as baseline versions only. It does not fabricate verification or
consent for old consultations. RPC wrappers remain invoker and service-role-only. MFA is
required through restrictive authenticated policies on every public table, in addition to
server-side checks. Existing patient cookie/session flow does not require staff MFA.

The app is still a test deployment. MFA enrollment/recovery, compromised-password protection,
session limits, actual video settings, backup of database AND Storage, tested restoration,
retention and operational/legal review require verification with the account operator.
`npm run test:compliance` exercises the full synthetic clinical flow and new safeguards.

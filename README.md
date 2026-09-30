# Czech Telemedicine Platform

Browser-based consultation workflow for outpatient practices. Test deployment:
https://easytelemedicine.netlify.app

## Current status

Implemented: staff sign-in and practice isolation, atomic consultation creation,
one-time invitation exchange for an HttpOnly patient session, replacement invitations,
saved patient intake and instruction acknowledgement, polling waiting room, Whereby
room creation/admission and explicit termination. The guest never receives the host URL.

Not ready for real patient use. Document upload and clinical summaries are unfinished.
Dependency security upgrades (including Next.js), provider configuration, full two-device
video acceptance testing and operational/privacy review remain required.

## Configuration

Use `.env.example`. In Netlify, configure Production variables:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Builds and Functions.
- `SUPABASE_SERVICE_ROLE_KEY`: Functions only. Never prefix it with NEXT_PUBLIC.
- `WHEREBY_API_KEY`: Functions only, from **Whereby Embedded**, not a Whereby Meetings personal room.

Allow `https://easytelemedicine.netlify.app` in Whereby Embedded's allowed domains.
The application does not request recording or transcription. Disable automatic recording
in the provider dashboard; verify the actual provider settings before a pilot. Minimal
embedded UI is not a server-side guarantee that a host cannot record through other means.

## Workflow

1. Staff creates a consultation; copy its 24-hour invitation or open the detail.
2. Patient opens the invitation in a separate browser and submits intake. The invitation
   is consumed atomically and replaced by a browser session expiring with the invitation.
3. Patient acknowledges the instructions and keeps the waiting page open. The practice
   dashboard/detail refresh every 5 seconds; no heartbeat for 60 seconds shows loss of connection.
4. A doctor or practice admin opens the video page and explicitly starts the call.
   A nurse can create invitations/read consultation details but cannot host calls.
5. Patient clicks to join; the host admits them in the locked Whereby room and verifies identity.
6. Use **Ukončit konzultaci pro všechny**. The provider room is deleted before the database
   marks the consultation complete. If deletion fails, retry; closing a tab does not end the call.

Replacement invitations invalidate every previous invitation/session and pending room claim
for that consultation. Existing intake remains attached to the consultation until the patient
updates it. Reissue is unavailable during or after a call. Raw invitation links are shown once,
not persisted in plaintext. Access requires HTTPS cookies in deployed builds.

## Database

Follow `supabase/README.md`. Both restoration migrations listed there were applied to the
existing project. Do not replay the old conflicting `001_*`, `002_*`, `003_*` scripts or reset
the hosted database. New workflow functions use SECURITY INVOKER and only service_role may
execute them; the server verifies staff identity or the patient session before returning data.

## Development and validation

`npm ci`, then `npm run dev`. Commands:

- `npm test`: request authorization, validation, cookies, provider failure cleanup.
- `npm run test:db`: 240 original RLS isolation assertions on synthetic PostgreSQL data.
- `npm run test:workflow`: 49 workflow assertions on disposable PostgreSQL/PGlite, including
  token reuse, session expiry, cross-practice denial, duplicate room claims and atomic rollback.
- `npm run build`: production compilation, typecheck and lint. Build validation can use a
  dummy Supabase URL/public key; this does not validate live credentials or live video.

Known operational limits: server crashes after external room creation may leave an orphan
room until the provider expiry/cleanup, and there is no background reconciliation job yet.
The 2-hour room expiry is a provider expiry, not a precise automatic consultation timeout.
Summary editing, uploads, SMS identity verification, automated invitations and history views
are not part of this checkpoint.

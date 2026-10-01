# Czech Telemedicine Platform

Browser-based consultation workflow for outpatient practices. Test deployment:
https://easytelemedicine.netlify.app

## Current status

Implemented: staff sign-in and practice isolation, atomic consultation creation,
one-time invitation exchange for an HttpOnly patient session, replacement invitations,
saved patient intake and instruction acknowledgement, polling waiting room, Whereby
room creation/admission and explicit termination. The guest never receives the host URL.

Notes, attachments, scheduling, record history, instruction evidence and password sign-in are implemented.
This is still a test deployment. Provider configuration, agreements, verified privacy information,
backup/restore validation, current technical standard review, security testing and clinical operating
procedures remain required before real patient use. App features alone do not certify compliance.

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
SMS identity verification and automated invitation delivery are not configured.


## Scheduling, records and attachments

- New consultations require a date and time in Europe/Prague. The dashboard shows one
  selected day; ongoing calls and the waiting room remain visible across days. History
  lives at `/consultations/history`, with completed/cancelled records, date filter and pagination.
- Invitations expire 24 hours after the later of creation and the scheduled appointment.
  Rescheduling extends still-valid invitations and sessions; expired invitations must be reissued.
- Clinical notes persist in `consultation_summaries` during and after the call. Autosave uses
  revisions to prevent overwriting edits from another window. Ending a call from its room/detail
  first flushes pending notes. Network failures retain the draft and block completion until saved.
- Staff can enable/revoke document requests before or during the appointment. Registered,
  instructed patients upload PDF/JPEG/PNG from the waiting room or call, max 3 MiB each and
  10 files per consultation. The server validates signatures, session and active request again
  after Storage upload; a revoked request never commits document metadata.
- Private `consultation-documents` and `consultation-exports` buckets have no browser policies.
  Downloads require authenticated staff in the owning practice. ZIP export includes UTF-8 text
  and all attachments, delivered from private Storage with a 60-second signed download URL
  to avoid Netlify's response-size limit. One current export per consultation is retained;
  future exports replace it. Source documents and clinical notes remain authoritative.
- Text copying/export prepares manual import into clinical documentation; no AIS integration
  or automatic clinical summary generation is configured.
- Legacy active records lacking a provider meeting ID can be completed manually. Actual
  provider meetings must be deleted successfully before completing the record.
- `APP_ORIGIN` is a public, build-time value for CSRF verification. Netlify builds infer it
  from URL; set it explicitly for a custom domain. The build also permits the exact primary project domain and its DEPLOY_PRIME_URL/DEPLOY_URL, so publishing a preview on the primary domain does not break requests. No request or forwarded host is trusted.
- Apply the `clinical_workspace` migration after the two restoration migrations. Existing
  consultations are retained; old records are not automatically closed or assigned new dates.
- `npm run test:clinical` exercises record revisions, persistence after ending, upload grants,
  cross-practice isolation, file limits, scheduling and closing legacy calls in disposable PGlite.
  UI autosave tests also cover in-flight edits, failed saves, conflicts and flushing before close.


## Evidence, finalization and staff authentication

- `/information` is linked from the homepage. Each validated patient invitation also has
  `/information` under its own route, displaying only its practice profile. Fill the profile
  using verified legal and operational information. An admin can edit it; in a practice without
  an admin, a doctor can fill it. No roles or account permissions are changed by this feature.
- Staff sign in with email and password and proceed directly to `/dashboard`.
  The operator has temporarily disabled MFA. Server routes still validate the session,
  staff role and practice membership; Data API RLS still restricts reads to the own practice.
  `/security` redirects old bookmarks to the dashboard; no SMS service is enabled.
  Reassess stronger authentication before patient production use.
- The patient confirms care on this remote channel and chooses a recording preference.
  These are recorded separately from GDPR legal grounds. Instruction version, exact presented
  text, provider information, selected verification method and server timestamp are preserved.
  The app does not offer recording/transcription. Provider recording settings still require review.
- Identity confirmation records method, actual actor and server time separately from free-text
  notes. Older text markers are explicitly labeled as legacy; migration does not fabricate
  who verified identity or when.
- Notes auto-save after five seconds without typing, rather than between individual
  keystrokes. Explicit saves, navigation and ending a call flush pending edits immediately.
  Background saves do not drain subsequent keystrokes while a network request is in flight.
- Every saved note revision is preserved from this migration onward. Existing notes are
  retained as the current baseline only; earlier history cannot be reconstructed.
- Completed calls with nonempty notes, confirmed identity and basic provider identification
  can finalize an immutable snapshot. Edits afterward require a reason, create a new revision
  and retain the earlier snapshot. Finalized exports use the snapshot's original provider,
  identity, author and clinical content even if the practice profile later changes.
- Read/copy/export requests, attachment downloads, patient acknowledgement, verification,
  finalization, corrections and password login are audited without putting notes, contact data,
  tokens, video host URLs or credentials into audit metadata. A copied/exported
  file still requires controlled handling outside this app. Polling creates read audit events.
- `npm run test:compliance` runs the full synthetic clinical workflow plus password-session practice isolation,
  immutable evidence, finalization requirements and preservation of corrections.
- The application does not replace a provider's authorized AIS. Import and authorize the
  final record and attachments there. Define retention for working records, source attachments,
  current exports and access logs separately. No automatic deletion or retention promises have
  been configured. Never delete clinical evidence through ad hoc SQL.

## Remaining operational work

Before real patient use, the operator must supply verified practice/physician contact information,
GDPR notices and purposes/legal bases, processor agreements and any transfer safeguards, a
retention/archiving policy, daily database and attachment backup with tested restore, secure
staff devices and recovery procedure, incident procedures, current-standard validation and
independent security/penetration testing. Confirm actual Whereby encryption/recording settings
and deployment TLS settings; code review cannot confirm those remote settings. Determine any
applicable cybersecurity-law duties and healthcare permissions with the provider. Do not claim
that these app changes alone establish legal compliance.

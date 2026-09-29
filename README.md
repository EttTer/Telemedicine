# Czech Telemedicine Platform

A secure, browser-based telemedicine waiting-room platform for outpatient medical practices in the Czech Republic.

## Current status

Work in progress; not ready for patient use. Consultation creation and staff sign-in
have backend code. Patient check-in, waiting room, video UI, uploads and summaries
remain unfinished. Whereby is the chosen provider; the server adapter is prepared
but is not yet connected to the consultation lifecycle.

## Restoration checkpoint

- Scoped consultation reads to the authenticated staff member's practice.
- Removed the diagnostic endpoint that exposed staff across practices.
- Unified application staff lookup and added session refresh and sign-out.
- Added a server-only Whereby adapter; removed the unused Daily dependency.
- Existing Supabase schema must be inspected before migration (see supabase/README.md).
- Patient session exchange, invitation reissue, RLS repair, atomic consultation creation,
  dependency security upgrades and full end-to-end tests are still required.

## Technology Stack

- **Frontend**: Next.js (App Router), React, Tailwind CSS
- **Backend/Auth/Database**: Supabase (PostgreSQL)
- **Video Provider**: Whereby (Embedded API)

## Setup Instructions

1. **Clone the repository**
2. **Install dependencies**: `npm install`
3. **Copy environment variables**: `cp .env.example .env.local`
4. **Inspect the existing Supabase project**:
   - Follow `supabase/README.md`; do not replay the legacy migrations.
   - Configure the environment with the existing project URL and keys.
5. **Set up Whereby Embedded**:
   - Configure `WHEREBY_API_KEY` on the server.
   - Adapter reference: https://docs.whereby.com/whereby-product-features/using-the-rest-api
   - Real rooms have not been tested yet. Recording policy must be verified before pilot use.
6. **Run locally**: `npm run dev`

> [!CAUTION]
> **Production Warning:** Before using this application with real patients, the system requires:
> - Legal review
> - GDPR/DPIA review
> - Security review and penetration testing
> - Verification of video provider compliance
> - Data processing agreements with all processors
> - Review of hosting location and data transfer
> - Medical workflow validation by a healthcare provider

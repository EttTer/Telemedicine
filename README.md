# Czech Telemedicine Platform

A secure, browser-based telemedicine waiting-room platform for outpatient medical practices in the Czech Republic.

## Features

- **Practice Management**: Admin/Doctor/Nurse roles with Row Level Security.
- **Consultation Links**: Unique, secure, one-time links for patients.
- **Patient Check-in**: Identity verification, telemedicine instructions, and recording consent.
- **Virtual Waiting Room**: Real-time status updates, camera/mic testing.
- **Controlled Document Upload**: Patients can only upload documents when explicitly requested by staff.
- **Embedded Video Room**: Secure video consultations (no recording enabled in MVP).
- **Consultation Summary**: Exportable record of the consultation including times, participants, verification status, and notes.
- **Audit Logging**: Immutable trail of critical actions.

## Technology Stack

- **Frontend**: Next.js (App Router), React, Tailwind CSS
- **Backend/Auth/Database**: Supabase (PostgreSQL)
- **Video Provider**: Daily.co (Embedded API)

## Setup Instructions

1. **Clone the repository**
2. **Install dependencies**: `npm install`
3. **Copy environment variables**: `cp .env.example .env.local`
4. **Set up Supabase**:
   - Create a new project on [Supabase](https://supabase.com).
   - Run the SQL migrations in `supabase/migrations/` sequentially in the SQL Editor.
   - Configure Authentication providers (Email) if needed.
   - Update `.env.local` with your Supabase URL and keys.
5. **Set up Video Provider (Daily.co)**:
   - Create a [Daily.co](https://daily.co/) account.
   - Generate an API key.
   - Update `.env.local` with your Daily.co domain and API key.
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

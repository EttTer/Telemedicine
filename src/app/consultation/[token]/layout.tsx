import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Stethoscope } from 'lucide-react'

// Use admin client so unauthenticated patients can access their consultation
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function PatientLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { token: string }
}) {
  // For MVP the consultation ID is used directly as the token in the URL.
  // In production we would look up consultation_tokens by token_hash instead.
  const { data: consultation } = await supabaseAdmin
    .from('consultations')
    .select('id, status, patient_first_name, practices(name, contact_phone)')
    .eq('id', params.token)
    .single()

  if (!consultation) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="mx-auto w-16 h-16 bg-danger-50 text-danger-500 rounded-full flex items-center justify-center mb-4">
            <Stethoscope className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Odkaz již není platný</h1>
          <p className="text-neutral-600">
            Tento odkaz na konzultaci vypršel nebo neexistuje. Kontaktujte prosím svou ordinaci pro vygenerování nového odkazu.
          </p>
        </div>
      </div>
    )
  }

  const practiceName = (consultation.practices as any)?.name || 'Ordinace'
  const practicePhone = (consultation.practices as any)?.contact_phone

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <header className="bg-white border-b border-neutral-200 py-4 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center space-x-2 text-primary-600">
            <Stethoscope className="h-6 w-6" />
            <span className="font-bold text-lg">{practiceName}</span>
          </div>
          {practicePhone && (
            <div className="text-sm text-neutral-500">
              Tel: {practicePhone}
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col">
        {children}
      </main>

      <footer className="py-6 text-center text-xs text-neutral-400">
        Bezpečná telemedicínská platforma
      </footer>
    </div>
  )
}

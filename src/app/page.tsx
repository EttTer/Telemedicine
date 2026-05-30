import Link from 'next/link'
import { Stethoscope, Shield, Video } from 'lucide-react'

export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-3xl space-y-8">
        <div className="flex justify-center mb-8">
          <div className="h-20 w-20 bg-primary-100 rounded-2xl flex items-center justify-center">
            <Stethoscope className="h-10 w-10 text-primary-600" />
          </div>
        </div>
        
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-neutral-900">
          Bezpečná telemedicínská čekárna
        </h1>
        
        <p className="text-xl text-neutral-600 max-w-2xl mx-auto">
          Moderní platforma pro online konzultace mezi lékařem a pacientem, plně v souladu s českou legislativou.
        </p>

        <div className="grid sm:grid-cols-3 gap-6 pt-8 max-w-4xl mx-auto text-left">
          <div className="card p-6 border-t-4 border-t-primary-500">
            <Shield className="h-8 w-8 text-primary-500 mb-4" />
            <h3 className="font-semibold text-lg mb-2">Šifrovaná komunikace</h3>
            <p className="text-sm text-neutral-600">
              End-to-end zabezpečené videohovory bez nahrávání, pro maximální ochranu soukromí.
            </p>
          </div>
          
          <div className="card p-6 border-t-4 border-t-accent-500">
            <Video className="h-8 w-8 text-accent-500 mb-4" />
            <h3 className="font-semibold text-lg mb-2">Virtuální čekárna</h3>
            <p className="text-sm text-neutral-600">
              Pacient čeká v klidném prostředí do chvíle, než jej lékař vyzve k hovoru.
            </p>
          </div>
          
          <div className="card p-6 border-t-4 border-t-primary-500">
            <Stethoscope className="h-8 w-8 text-primary-500 mb-4" />
            <h3 className="font-semibold text-lg mb-2">Řízené nahrávání souborů</h3>
            <p className="text-sm text-neutral-600">
              Dokumenty lze nahrát pouze na výslovnou žádost ordinace.
            </p>
          </div>
        </div>

        <div className="pt-10 flex gap-4 justify-center">
          <Link 
            href="/login" 
            className="btn btn-primary px-8 py-3 text-lg"
          >
            Přihlášení pro ordinace
          </Link>
          <a 
            href="#about" 
            className="btn btn-secondary px-8 py-3 text-lg"
          >
            Více informací
          </a>
        </div>
      </div>
    </main>
  )
}

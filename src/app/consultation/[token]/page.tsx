import Link from 'next/link'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Video, ShieldCheck } from 'lucide-react'

export default function ConsultationEntryPage({ params }: { params: { token: string } }) {
  return (
    <div className="flex-1 flex flex-col justify-center items-center py-12">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mb-4">
            <Video className="w-8 h-8 text-primary-500" />
          </div>
          <CardTitle className="text-2xl font-bold">Vítejte v telemedicínské čekárně</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-6 pt-4">
          <p className="text-neutral-600">
            Jste zváni k online konzultaci. Před vstupem do virtuální čekárny prosím projděte krátkým registračním procesem.
          </p>
          
          <div className="bg-neutral-50 rounded-lg p-4 text-left border border-neutral-100 flex items-start space-x-3">
            <ShieldCheck className="w-5 h-5 text-success-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-neutral-900">Zabezpečené spojení</p>
              <p className="text-xs text-neutral-500 mt-1">Vaše komunikace s lékařem je šifrována. Videohovor není v rámci této verze systému nahráván.</p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center pt-2 pb-8">
          <Link href={`/consultation/${params.token}/checkin`} className="w-full sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto px-8">
              Začít registraci
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}

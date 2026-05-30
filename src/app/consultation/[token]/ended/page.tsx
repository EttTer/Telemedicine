import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { CheckCircle2 } from 'lucide-react'

export default function CallEndedPage() {
  return (
    <div className="flex-1 flex flex-col justify-center items-center py-12">
      <Card className="w-full max-w-lg border-t-4 border-t-success-500">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 bg-success-50 rounded-2xl flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8 text-success-500" />
          </div>
          <CardTitle className="text-2xl font-bold">Konzultace byla ukončena</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4 pt-4">
          <p className="text-neutral-600">
            Děkujeme za využití naší telemedicínské platformy. Můžete nyní toto okno bezpečně zavřít.
          </p>
          <p className="text-sm text-neutral-400">
            Lékařská zpráva z této konzultace vám bude doručena standardním způsobem dohodnutým s ordinací.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

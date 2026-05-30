'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/Card'
import { Label } from '@/components/ui/Label'
import { FileText, Download, Copy, Check, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function ConsultationSummaryPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [isCopied, setIsCopied] = useState(false)
  const [summaryText, setSummaryText] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Mock data for the MVP presentation
  const mockSummaryData = {
    patientName: 'Jan Novák',
    dob: '15. 4. 1980',
    date: new Date().toLocaleDateString('cs-CZ'),
    timeStart: '14:30',
    timeEnd: '14:45',
    duration: '15 min',
    verification: 'Ověření lékařem na začátku hovoru',
    recordingConsent: 'Nesouhlasí',
    recordingStatus: 'Nenahráváno (zablokováno systémem)',
    documents: ['Lekarska_zprava_2023.pdf'],
  }

  const generateReportText = () => {
    return `ZÁZNAM O TELEMEDICÍNSKÉ KONZULTACI
-----------------------------------
Pacient: ${mockSummaryData.patientName} (nar. ${mockSummaryData.dob})
Datum: ${mockSummaryData.date}
Čas: ${mockSummaryData.timeStart} - ${mockSummaryData.timeEnd} (délka: ${mockSummaryData.duration})

Ověření totožnosti: ${mockSummaryData.verification}
Souhlas s nahráváním: ${mockSummaryData.recordingConsent}
Stav nahrávání: ${mockSummaryData.recordingStatus}

Nahrané dokumenty:
${mockSummaryData.documents.length > 0 ? mockSummaryData.documents.map(d => `- ${d}`).join('\n') : 'Žádné'}

LÉKAŘSKÝ ZÁZNAM:
${summaryText || '[Není vyplněno]'}
-----------------------------------
`
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(generateReportText())
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  const handleSave = async () => {
    setIsLoading(true)
    // Save to DB
    await new Promise(resolve => setTimeout(resolve, 800))
    router.push('/dashboard')
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className="px-2">
            <ArrowLeft className="w-4 h-4 mr-2" /> Přehled
          </Button>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Shrnutí konzultace</h1>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Záznam lékaře</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="notes">Volný text pro lékařskou zprávu</Label>
                <textarea
                  id="notes"
                  rows={12}
                  className="w-full rounded-md border border-neutral-200 p-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Zadejte poznámky ze schůzky, které chcete uložit do dekurzu..."
                  value={summaryText}
                  onChange={(e) => setSummaryText(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Systémová data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="text-neutral-500 font-medium">Pacient</p>
                <p className="font-semibold text-neutral-900">{mockSummaryData.patientName}</p>
                <p className="text-neutral-600">nar. {mockSummaryData.dob}</p>
              </div>
              <div>
                <p className="text-neutral-500 font-medium">Doba spojení</p>
                <p className="text-neutral-900">{mockSummaryData.timeStart} – {mockSummaryData.timeEnd}</p>
              </div>
              <div>
                <p className="text-neutral-500 font-medium">Ověření totožnosti</p>
                <p className="text-neutral-900">{mockSummaryData.verification}</p>
              </div>
              <div>
                <p className="text-neutral-500 font-medium">Souhlas s nahráváním</p>
                <p className="text-neutral-900">{mockSummaryData.recordingConsent}</p>
              </div>
              {mockSummaryData.documents.length > 0 && (
                <div>
                  <p className="text-neutral-500 font-medium mb-1">Přijaté dokumenty</p>
                  <ul className="space-y-1">
                    {mockSummaryData.documents.map((doc, i) => (
                      <li key={i} className="flex items-center text-primary-600 cursor-pointer hover:underline">
                        <FileText className="w-3 h-3 mr-1.5" />
                        {doc}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-primary-50 border-primary-100">
            <CardContent className="p-4 space-y-3">
              <Button 
                variant="primary" 
                className="w-full justify-start"
                onClick={handleCopy}
              >
                {isCopied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                Kopírovat do schránky
              </Button>
              <Button variant="secondary" className="w-full justify-start border-primary-200">
                <Download className="w-4 h-4 mr-2" />
                Stáhnout jako PDF
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <Button size="lg" onClick={handleSave} isLoading={isLoading}>
          Uložit a uzavřít
        </Button>
      </div>
    </div>
  )
}

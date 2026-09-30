'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ArrowRight, AlertTriangle, Info } from 'lucide-react'

export default function InstructionsPage({ params }: { params: { token: string } }) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!agreed) return
    setIsLoading(true)

    try {
      setError('')
      const response = await fetch(`/api/patient/${params.token}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', acknowledged: true }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      router.push(`/consultation/${params.token}/waiting`)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Vstup do čekárny se nezdařil.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex-1 max-w-xl w-full mx-auto py-8">
      <div className="mb-8 flex items-center space-x-2 text-sm text-neutral-400">
        <span className="text-neutral-400">1. Údaje</span>
        <ArrowRight className="w-3 h-3" />
        <span className="font-medium text-primary-600">2. Poučení</span>
        <ArrowRight className="w-3 h-3" />
        <span>3. Čekárna</span>
      </div>

      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Poučení pacienta</CardTitle>
            <CardDescription>Přečtěte si prosím pozorně následující informace.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            <div className="bg-warning-50 border border-warning-200 rounded-lg p-4 flex items-start space-x-3 text-warning-800">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold mb-1">Není určeno pro akutní stavy</p>
                <p>Telemedicínská konzultace nenahrazuje záchrannou zdravotnickou službu. V případě ohrožení života okamžitě volejte 155 nebo 112.</p>
              </div>
            </div>

            <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 flex items-start space-x-3 text-primary-800">
              <Info className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold mb-1">Zabezpečení a soukromí</p>
                <ul className="list-disc pl-4 space-y-1 mt-2">
                  <li>Zajistěte, že se nacházíte v soukromém prostředí, kde vás nikdo neruší.</li>
                  <li>Nahrávání dokumentů v této testovací verzi není dostupné.</li>
                </ul>
              </div>
            </div>

            <p className="text-sm text-neutral-600">Aplikace nepořizuje záznam hovoru. Identitu potvrdíte s lékařem na začátku konzultace.</p>
            {error && <p role="alert" className="text-danger-700">{error}</p>}

            <div className="pt-4 border-t border-neutral-100">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  className="mt-1 h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                />
                <span className="text-sm text-neutral-700 leading-snug">
                  Potvrzuji, že jsem si přečetl/a poučení, rozumím mu a nacházím se v soukromém prostředí vhodném pro zdravotní konzultaci.
                </span>
              </label>
            </div>

          </CardContent>
          <CardFooter className="bg-neutral-50/50 pt-6">
            <Button 
              type="submit" 
              className="w-full" 
              disabled={!agreed}
              isLoading={isLoading}
            >
              Vstoupit do čekárny
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}

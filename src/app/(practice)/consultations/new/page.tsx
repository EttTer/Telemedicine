'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card'

export default function NewConsultationPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    patient_first_name: '',
    patient_last_name: '',
    consultation_type: 'Pravidelná kontrola',
    identity_verification_method: 'SMS kód',
    note_to_patient: '',
  })

  const [error, setError] = useState<string | null>(null)

  // We are using a simplified direct-to-db approach for MVP via API
  // In a real app we'd submit this form to a Server Action or API Route
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/consultations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create consultation')
      }
      
      const { id } = await response.json()
      router.push(`/consultations/${id}`)
    } catch (err: any) {
      console.error(err)
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Nová konzultace</h1>
        <p className="text-neutral-500">Vytvořte jedinečný odkaz pro pacienta.</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Nová konzultace</CardTitle>
            <CardDescription>Vygenerujte bezpečný odkaz pro připojení pacienta do čekárny.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {error && (
              <div className="bg-danger-50 border border-danger-200 text-danger-700 px-4 py-3 rounded-md text-sm font-medium">
                Chyba: {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Jméno (volitelné)</Label>
                <Input 
                  id="firstName" 
                  value={formData.patient_first_name}
                  onChange={e => setFormData(p => ({ ...p, patient_first_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Příjmení (volitelné)</Label>
                <Input 
                  id="lastName" 
                  value={formData.patient_last_name}
                  onChange={e => setFormData(p => ({ ...p, patient_last_name: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Typ konzultace *</Label>
              <select 
                id="type"
                required
                className="flex h-10 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                value={formData.consultation_type}
                onChange={e => setFormData(p => ({ ...p, consultation_type: e.target.value }))}
              >
                <option value="Pravidelná kontrola">Pravidelná kontrola</option>
                <option value="Konzultace výsledků">Konzultace výsledků</option>
                <option value="Akutní obtíže">Akutní obtíže</option>
                <option value="Předpis léků">Předpis léků</option>
                <option value="Jiné">Jiné</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="verification">Metoda ověření totožnosti *</Label>
              <select 
                id="verification"
                required
                className="flex h-10 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                value={formData.identity_verification_method}
                onChange={e => setFormData(p => ({ ...p, identity_verification_method: e.target.value }))}
              >
                <option value="Známo z předchozí návštěvy">Známo z předchozí návštěvy</option>
                <option value="SMS kód">Zaslaný SMS kód</option>
                <option value="Ověření lékařem v hovoru">Ověření lékařem na začátku hovoru</option>
              </select>
              <p className="text-xs text-neutral-500">
                Lékař musí vždy potvrdit totožnost před zahájením hovoru.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">Poznámka pro pacienta (zobrazí se v čekárně)</Label>
              <textarea 
                id="note"
                className="flex min-h-[80px] w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                value={formData.note_to_patient}
                onChange={e => setFormData(p => ({ ...p, note_to_patient: e.target.value }))}
                placeholder="Např. připravte si prosím poslední lékařskou zprávu..."
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-between border-t border-neutral-100 bg-neutral-50/50 pt-6">
            <Button type="button" variant="ghost" onClick={() => router.back()}>Zrušit</Button>
            <Button type="submit" isLoading={isLoading}>Vygenerovat odkaz</Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}

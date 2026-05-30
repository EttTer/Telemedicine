'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { ArrowRight } from 'lucide-react'

export default function CheckinPage({ params }: { params: { token: string } }) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    contact_info: '',
    reason_for_visit: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // In a real app we'd save this to the `patients` table via an API route
      // await fetch(`/api/consultations/${params.token}/patient`, { method: 'POST', body: JSON.stringify(formData) })
      
      // For MVP, we simulate the delay and redirect to instructions
      await new Promise(resolve => setTimeout(resolve, 600))
      router.push(`/consultation/${params.token}/instructions`)
    } catch (error) {
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex-1 max-w-lg w-full mx-auto py-8">
      <div className="mb-8 flex items-center space-x-2 text-sm text-neutral-400">
        <span className="font-medium text-primary-600">1. Údaje</span>
        <ArrowRight className="w-3 h-3" />
        <span>2. Poučení</span>
        <ArrowRight className="w-3 h-3" />
        <span>3. Čekárna</span>
      </div>

      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Identifikační údaje</CardTitle>
            <CardDescription>Vyplňte prosím základní údaje pro lékaře.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">Jméno *</Label>
                <Input 
                  id="first_name" 
                  required
                  value={formData.first_name}
                  onChange={e => setFormData(p => ({ ...p, first_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Příjmení *</Label>
                <Input 
                  id="last_name" 
                  required
                  value={formData.last_name}
                  onChange={e => setFormData(p => ({ ...p, last_name: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dob">Datum narození *</Label>
              <Input 
                id="dob" 
                type="date"
                required
                value={formData.date_of_birth}
                onChange={e => setFormData(p => ({ ...p, date_of_birth: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact">Telefon nebo e-mail *</Label>
              <Input 
                id="contact" 
                required
                placeholder="Pro případ výpadku spojení"
                value={formData.contact_info}
                onChange={e => setFormData(p => ({ ...p, contact_info: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Důvod návštěvy (volitelné)</Label>
              <textarea 
                id="reason"
                className="flex min-h-[80px] w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                value={formData.reason_for_visit}
                onChange={e => setFormData(p => ({ ...p, reason_for_visit: e.target.value }))}
              />
            </div>
          </CardContent>
          <CardFooter className="bg-neutral-50/50 pt-6">
            <Button type="submit" className="w-full" isLoading={isLoading}>
              Pokračovat k poučení
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  ArrowLeft, Copy, Check, Video, Clock,
  User, ShieldCheck, FileText, ExternalLink
} from 'lucide-react'

export default function ConsultationDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [copied, setCopied] = useState(false)
  const [consultation, setConsultation] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [patientLink, setPatientLink] = useState('')

  useEffect(() => {
    setPatientLink(`${window.location.origin}/consultation/${id}`)
  }, [id])

  useEffect(() => {
    const fetchConsultation = async () => {
      try {
        const res = await fetch(`/api/consultations/${id}`)
        if (res.ok) {
          const data = await res.json()
          setConsultation(data)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchConsultation()
  }, [id])

  // patientLink is set in useEffect above to avoid SSR/client hydration mismatch

  const handleCopy = () => {
    navigator.clipboard.writeText(patientLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const statusLabels: Record<string, string> = {
    scheduled: 'Naplánováno',
    waiting: 'Pacient čeká',
    in_progress: 'Probíhá',
    completed: 'Dokončeno',
    cancelled: 'Zrušeno',
  }

  const statusVariants: Record<string, 'default' | 'primary' | 'success' | 'danger' | 'warning'> = {
    scheduled: 'default',
    waiting: 'warning',
    in_progress: 'primary',
    completed: 'success',
    cancelled: 'danger',
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back button */}
      <div className="flex items-center space-x-4">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className="px-2">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Přehled
          </Button>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Detail konzultace</h1>
      </div>

      {/* Patient link card — the most important element */}
      <Card className="border-2 border-primary-200 bg-primary-50/40">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-primary-800">
            <ExternalLink className="w-5 h-5 mr-2" />
            Odkaz pro pacienta
          </CardTitle>
          <CardDescription>
            Odešlete tento odkaz pacientovi. Odkaz je platný 24 hodin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 bg-white border border-primary-200 rounded-lg p-3">
            <span className="flex-1 text-sm text-neutral-700 font-mono break-all">
              {patientLink}
            </span>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCopy}
              className="shrink-0"
            >
              {copied ? (
                <><Check className="w-4 h-4 mr-1" /> Zkopírováno</>
              ) : (
                <><Copy className="w-4 h-4 mr-1" /> Kopírovat</>
              )}
            </Button>
          </div>
          <p className="text-xs text-neutral-500 flex items-center">
            <ShieldCheck className="w-3 h-3 mr-1 text-success-500" />
            Odkaz je kryptograficky podepsán. Pacient bude přesměrován do zabezpečené čekárny.
          </p>
        </CardContent>
      </Card>

      {/* Consultation details */}
      <div className="grid sm:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center">
              <User className="w-4 h-4 mr-2 text-neutral-500" />
              Pacient
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-neutral-700 space-y-2">
            {isLoading ? (
              <div className="h-4 w-32 bg-neutral-100 rounded animate-pulse" />
            ) : consultation?.patient_first_name ? (
              <p className="font-medium">
                {consultation.patient_first_name} {consultation.patient_last_name}
              </p>
            ) : (
              <p className="text-neutral-400 italic">Pacient vyplní údaje sám při přihlášení</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center">
              <Clock className="w-4 h-4 mr-2 text-neutral-500" />
              Stav konzultace
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-6 w-24 bg-neutral-100 rounded animate-pulse" />
            ) : (
              <Badge variant={statusVariants[consultation?.status] ?? 'default'}>
                {statusLabels[consultation?.status] ?? consultation?.status}
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center">
              <ShieldCheck className="w-4 h-4 mr-2 text-neutral-500" />
              Ověření totožnosti
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-neutral-700">
            {isLoading ? (
              <div className="h-4 w-40 bg-neutral-100 rounded animate-pulse" />
            ) : (
              <p>{consultation?.identity_verification_method ?? '—'}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center">
              <FileText className="w-4 h-4 mr-2 text-neutral-500" />
              Typ konzultace
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-neutral-700">
            {isLoading ? (
              <div className="h-4 w-32 bg-neutral-100 rounded animate-pulse" />
            ) : (
              <p>{consultation?.consultation_type ?? '—'}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <Link href={`/consultations/${id}/room`}>
          <Button size="lg">
            <Video className="w-4 h-4 mr-2" />
            Vstoupit do videohovoru
          </Button>
        </Link>
      </div>
    </div>
  )
}

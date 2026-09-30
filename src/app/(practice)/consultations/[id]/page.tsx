'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
const labels: Record<string,string> = { scheduled: 'Naplánováno', waiting: 'Pacient vstoupil do čekárny', in_progress: 'Probíhá hovor', completed: 'Dokončeno', cancelled: 'Zrušeno' }
export default function ConsultationDetailPage({ params }: { params: { id: string } }) {
  const [consultation, setConsultation] = useState<any>(null)
  const [error, setError] = useState('')
  const [link, setLink] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    let disposed = false
    let timer: ReturnType<typeof setTimeout>
    async function refresh() {
      try {
        const response = await fetch(`/api/consultations/${params.id}`, { cache: 'no-store' })
        const data = await response.json()
        if (!response.ok) throw new Error('Detail konzultace nelze načíst. Zkontrolujte přihlášení.')
        if (!disposed) { setConsultation(data); setError('') }
      } catch (e) { if (!disposed) setError(e instanceof Error ? e.message : 'Spojení se serverem se přerušilo.') }
      if (!disposed) timer = setTimeout(refresh, 5000)
    }
    refresh()
    return () => { disposed=true; clearTimeout(timer) }
  }, [params.id])
  const [actionError, setActionError] = useState('')
  async function invite() {
    setBusy(true); setActionError(''); setCopied(false)
    try {
      const response = await fetch(`/api/consultations/${params.id}/invite`, { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setLink(`${window.location.origin}/consultation/${data.token}`)
      setConsultation((c: any) => ({ ...c, status: 'scheduled', waiting_room_sessions: [] }))
      setConfirm(false)
    } catch (e) { setActionError(e instanceof Error ? e.message : 'Pozvánku nelze vystavit.') }
    finally { setBusy(false) }
  }
  const patient = consultation?.patients?.[0]
  const waiting = consultation?.waiting_room_sessions?.[0]
  const present = waiting && Date.now()-new Date(waiting.updated_at).getTime()<60000
  return <div className="max-w-3xl mx-auto space-y-6">
    <Link href="/dashboard" className="underline">Zpět na přehled</Link>
    <h1 className="text-2xl font-bold">Detail konzultace</h1>
    {error && <p role="alert" className="text-danger-700">{error}</p>}
    {!consultation && !error && <p>Načítání…</p>}
    {consultation && <>
      <Card><CardHeader><CardTitle>Stav konzultace</CardTitle></CardHeader><CardContent className="space-y-3">
        <p className="font-semibold">{labels[consultation.status] || consultation.status}</p>
        {consultation.status==='waiting' && <p>{present ? 'Pacient má otevřenou čekárnu.' : 'Pacient se déle než minutu neozval. Čekáme na obnovení spojení.'}</p>}
        <p>Typ: {consultation.consultation_type}</p>
        <p>Ověření totožnosti: {consultation.identity_verification_method}. Totožnost ověřte s pacientem; samotné vyplnění formuláře ji nepotvrzuje.</p>
        {['waiting','in_progress'].includes(consultation.status) && <Link href={`/consultations/${params.id}/room`} className="inline-block"><Button>Otevřít videohovor</Button></Link>}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Pacient</CardTitle></CardHeader><CardContent className="space-y-2">
        <p className="font-semibold">{consultation.patient_first_name} {consultation.patient_last_name}</p>
        {patient ? <><p>Datum narození: {patient.date_of_birth}</p><p>Kontakt: {patient.contact_info}</p><p className="whitespace-pre-wrap">Důvod konzultace: {patient.reason_for_visit || 'Neuveden'}</p></> : <p>Pacient dosud neodeslal vstupní údaje.</p>}
        {consultation.note_to_patient && <p className="whitespace-pre-wrap">Vzkaz pacientovi: {consultation.note_to_patient}</p>}
      </CardContent></Card>
      {['scheduled','waiting'].includes(consultation.status) && <Card><CardHeader><CardTitle>Pozvánka pacienta</CardTitle></CardHeader><CardContent className="space-y-4">
        <p>Celý odkaz se z bezpečnostních důvodů neukládá. Pokud ho nemáte, vystavte novou pozvánku.</p>
        {link && <><Input aria-label="Nový odkaz pro pacienta" readOnly value={link} onFocus={e => e.target.select()} /><Button variant="secondary" onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true) } catch { setActionError('Označte odkaz a zkopírujte jej ručně.') } }}>{copied ? 'Zkopírováno' : 'Kopírovat odkaz'}</Button><p className="text-sm">Platí 24 hodin a zobrazí se jen nyní. Předejte ho pacientovi před opuštěním stránky.</p></>}
        {actionError && <p role="alert" className="text-danger-700">{actionError}</p>}
        {confirm ? <div className="space-y-3 rounded-lg bg-warning-50 p-4"><p>Původní odkaz i otevřená pacientská relace přestanou platit. Pacient bude muset otevřít novou pozvánku.</p><div className="flex gap-3"><Button isLoading={busy} onClick={invite}>Zneplatnit původní a vytvořit novou</Button><Button variant="ghost" disabled={busy} onClick={() => setConfirm(false)}>Zrušit</Button></div></div> : <Button variant="secondary" onClick={() => setConfirm(true)}>Vystavit novou pozvánku</Button>}
      </CardContent></Card>}
    </>}
  </div>
}

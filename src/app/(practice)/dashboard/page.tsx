import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'
import { Video, Clock, Users, FileText } from 'lucide-react'

export const revalidate = 0 // Disable cache for dashboard

export default async function DashboardPage() {
  const supabase = createClient()
  
  // Get active consultations for this practice
  const { data: consultations } = await supabase
    .from('consultations')
    .select(`
      id,
      patient_first_name,
      patient_last_name,
      scheduled_for,
      status,
      consultation_type,
      waiting_room_sessions(status, joined_at),
      identity_verifications(status, method)
    `)
    .in('status', ['scheduled', 'waiting', 'in_progress'])
    .order('scheduled_for', { ascending: true })

  const waitingPatients = consultations?.filter(c => c.status === 'waiting' || c.waiting_room_sessions?.[0]?.status === 'waiting') || []
  const upcomingConsultations = consultations?.filter(c => c.status === 'scheduled' && c.waiting_room_sessions?.[0]?.status !== 'waiting') || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Přehled konzultací</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6 flex flex-col justify-center">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <p className="text-sm font-medium text-neutral-500">Čekající pacienti</p>
              <Users className="h-4 w-4 text-warning-500" />
            </div>
            <div className="text-3xl font-bold">{waitingPatients.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 flex flex-col justify-center">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <p className="text-sm font-medium text-neutral-500">Dnes naplánováno</p>
              <CalendarIcon className="h-4 w-4 text-primary-500" />
            </div>
            <div className="text-3xl font-bold">{upcomingConsultations.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Waiting Room List */}
        <Card className="col-span-1 border-t-4 border-t-warning-400">
          <CardHeader>
            <CardTitle className="flex items-center">
              <span className="relative flex h-3 w-3 mr-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-warning-500"></span>
              </span>
              Virtuální čekárna
            </CardTitle>
          </CardHeader>
          <CardContent>
            {waitingPatients.length === 0 ? (
              <div className="text-center py-8 text-neutral-500">
                Nikdo nečeká v čekárně.
              </div>
            ) : (
              <div className="space-y-4">
                {waitingPatients.map((consultation) => (
                  <div key={consultation.id} className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg border border-neutral-100">
                    <div>
                      <p className="font-medium text-neutral-900">
                        {consultation.patient_first_name} {consultation.patient_last_name}
                      </p>
                      <p className="text-sm text-neutral-500">{consultation.consultation_type}</p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Badge variant="warning">Čeká</Badge>
                      <Link href={`/consultations/${consultation.id}`}>
                        <Button size="sm" variant="secondary">Detail</Button>
                      </Link>
                      <Link href={`/consultations/${consultation.id}/room`}>
                        <Button size="sm" variant="primary">
                          <Video className="w-4 h-4 mr-2" />
                          Přijmout
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming List */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Plánované konzultace</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingConsultations.length === 0 ? (
              <div className="text-center py-8 text-neutral-500">
                Žádné nadcházející konzultace.
              </div>
            ) : (
              <div className="space-y-4">
                {upcomingConsultations.map((consultation) => {
                  const scheduledFor = new Date(consultation.scheduled_for)
                  return (
                    <div key={consultation.id} className="flex items-center justify-between p-4 border-b border-neutral-100 last:border-0">
                      <div className="flex items-center">
                        <div className="bg-primary-50 text-primary-700 rounded-md p-2 mr-4 text-center min-w-[60px]">
                          <div className="text-xs font-semibold">{scheduledFor.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })}</div>
                          <div className="font-bold">{scheduledFor.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                        <div>
                          <p className="font-medium text-neutral-900">
                            {consultation.patient_first_name || 'Nový'} {consultation.patient_last_name || 'pacient'}
                          </p>
                          <p className="text-sm text-neutral-500 flex items-center mt-1">
                            {consultation.consultation_type}
                          </p>
                        </div>
                      </div>
                      <Link href={`/consultations/${consultation.id}`}>
                        <Button size="sm" variant="ghost">Otevřít</Button>
                      </Link>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function CalendarIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  )
}

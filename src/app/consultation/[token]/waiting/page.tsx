import { PatientWaitingRoom } from '@/components/PatientWaitingRoom'
export default function WaitingPage({ params }: { params: { token: string } }) {
  return <PatientWaitingRoom token={params.token} />
}

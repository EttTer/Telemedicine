import { PatientWaitingRoom } from '@/components/PatientWaitingRoom'
export default function RoomPage({ params }: { params: { token: string } }) {
  return <PatientWaitingRoom token={params.token} />
}

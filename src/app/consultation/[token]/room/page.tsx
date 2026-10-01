import { PatientWaitingRoom } from '@/components/PatientWaitingRoom'
export default async function RoomPage({ params: pendingParams }: { params: Promise<{ token: string }> }) {
  const params = await pendingParams;
  return <PatientWaitingRoom token={params.token} />
}

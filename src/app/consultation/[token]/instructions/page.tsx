import { getPatientConsultation } from '@/lib/patient-access';
import { PatientInstructions } from '@/components/PatientInstructions';
import { notFound } from 'next/navigation';
export const dynamic='force-dynamic';
export default async function InstructionsPage({params}:{params:Promise<{token:string}>}) {
 const {token}=await params;const context=await getPatientConsultation(token);if(!context)notFound();
 return <PatientInstructions token={token} context={context}/>;
}

import Link from "next/link";
import { ClinicalRecord } from "@/components/ClinicalRecord";
export default async function Summary({ params: pendingParams }: { params: Promise<{ id: string }> }) {
  const params = await pendingParams;
  return (
    <div className="space-y-6">
      <Link href={`/consultations/${params.id}`} className="underline">
        Detail konzultace
      </Link>
      <h1 className="text-2xl font-bold">Záznam konzultace</h1>
      <ClinicalRecord id={params.id} />
    </div>
  );
}

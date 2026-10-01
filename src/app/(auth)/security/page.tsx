import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/staff";
import { MfaSetup } from "@/components/MfaSetup";
export const dynamic = "force-dynamic";
export default async function Security() {
  const c = await getStaffContext({ allowMfaSetup: true });
  if (!c.staff) { if (c.status === 401) redirect("/login"); return <main className="p-8">Účet nemá přístup do ordinace.</main>; }
  return <MfaSetup />;
}

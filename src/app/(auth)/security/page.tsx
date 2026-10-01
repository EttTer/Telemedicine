import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/staff";
export const dynamic = "force-dynamic";
// Keep old bookmarks usable after removing the second-factor screen.
export default async function Security() {
  const c = await getStaffContext();
  if (!c.staff) redirect("/login");
  redirect("/dashboard");
}

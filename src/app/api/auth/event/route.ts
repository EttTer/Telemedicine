import { getStaffContext } from "@/lib/staff";
import { json, sameOrigin } from "@/lib/workflow";
import { accessLog } from "@/lib/access-log";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Nepovolený původ." }, 403);
  if ((await request.json().catch(() => null))?.action !== "mfa_login") return json({ error: "Neplatná akce." }, 400);
  const c = await getStaffContext(); if (!c.staff) return json({ error: "Ověřte přihlášení druhým faktorem." }, c.status);
  try { await accessLog(c, "staff_login_mfa"); return json({ ok: true }); } catch { return json({ error: "Přihlášení nelze zaevidovat." }, 503); }
}

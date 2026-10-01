import { getStaffContext } from "@/lib/staff";
import { accessLog } from "@/lib/access-log";
import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/workflow";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try { const context=await getStaffContext({allowMfaSetup:true}); if(context.staff) await accessLog(context,"staff_logout_requested"); } catch { /* Logout must remain possible during an audit outage. */ }
  const { error } = await (await createClient()).auth.signOut();
  if (error)
    return NextResponse.json(
      { error: "Odhlášení se nezdařilo." },
      { status: 500 },
    );
  return NextResponse.redirect(
    new URL("/login", request.headers.get("origin")!),
    303,
  );
}

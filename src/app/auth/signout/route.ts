import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/workflow";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { error } = await createClient().auth.signOut();
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

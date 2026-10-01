import { z } from "zod";
import { staffRecord } from "@/lib/clinical";
import { json, sameOrigin } from "@/lib/workflow";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const r = await staffRecord(params.id);
    if (r.response) return r.response;
    return json({
      ...r.data,
      documents: r.data.documents.map(({ storage_path, ...d }: any) => d),
    });
  } catch {
    return json({ error: "Záznam nelze načíst." }, 500);
  }
}
const input = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("save"),
      summary: z.string().max(50000),
      revision: z.number().int().min(0),
    })
    .strict(),
  z.object({ action: z.enum(["request", "revoke", "cancel"]) }).strict(),
  z
    .object({
      action: z.literal("reschedule"),
      scheduled_for: z.string().datetime({ offset: true }),
    })
    .strict(),
]);
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  if (!sameOrigin(request))
    return json({ error: "Nepovolený původ požadavku." }, 403);
  try {
    const parsed = input.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return json({ error: "Neplatné údaje." }, 400);
    const { action, ...data } = parsed.data;
    const r = await staffRecord(params.id, action, data);
    return r.response || json(r.data);
  } catch {
    return json({ error: "Záznam se nepodařilo uložit." }, 500);
  }
}

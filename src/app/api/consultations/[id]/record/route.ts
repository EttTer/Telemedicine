import { z } from "zod";
import { accessLog } from "@/lib/access-log";
import { staffRecord } from "@/lib/clinical";
import { json, sameOrigin } from "@/lib/workflow";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params: pendingParams }: { params: Promise<{ id: string }> },
) {
  const params = await pendingParams;
  try {
    const query = new URL(request.url).searchParams;
    const historical = query.get("revision");
    if (historical !== null && !/^\d{1,9}$/.test(historical)) return json({error:"Neplatná verze."},400);
    const r = await staffRecord(params.id, historical === null ? "read" : "read_version", historical === null ? {} : {revision:Number(historical)});
    if (r.response) return r.response;
    if (historical !== null) return json(r.data);
    if (query.get("purpose") === "copy") await accessLog(r.context!, "record_copy_requested", params.id, {revision:r.data.revision});
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
  z.object({action:z.literal("verify_identity"),verified:z.boolean(),method:z.string().trim().min(5).max(200)}).strict(),
  z.object({action:z.literal("finalize"),revision:z.number().int().min(0)}).strict(),
  z.object({action:z.literal("reopen"),revision:z.number().int().min(0),reason:z.string().trim().min(3).max(1000)}).strict(),
  z.object({action:z.literal("label_document"),document_id:z.string().uuid(),label:z.string().trim().max(200).refine(v=>!/[\x00-\x1f\x7f]/.test(v))}).strict(),
  z
    .object({
      action: z.literal("reschedule"),
      scheduled_for: z.string().datetime({ offset: true }),
    })
    .strict(),
]);
export async function POST(
  request: Request,
  { params: pendingParams }: { params: Promise<{ id: string }> },
) {
  const params = await pendingParams;
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

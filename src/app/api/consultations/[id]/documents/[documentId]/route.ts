import { documentBucket, staffRecord, safeFileName } from "@/lib/clinical";
import { json } from "@/lib/workflow";
import { accessLog } from "@/lib/access-log";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params: pendingParams }: { params: Promise<{ id: string; documentId: string }> },
) {
  const params = await pendingParams;
  try {
    const r = await staffRecord(params.id);
    if (r.response) return r.response;
    const doc = r.data.documents.find((d: any) => d.id === params.documentId);
    if (!doc) return json({ error: "Příloha nenalezena." }, 404);
    if (!["application/pdf", "image/jpeg", "image/png"].includes(doc.file_type))
      return json({ error: "Typ přílohy není podporovaný." }, 400);
    const file = await r
      .admin!.storage.from(documentBucket)
      .download(doc.storage_path);
    if (file.error || !file.data)
      return json({ error: "Přílohu se nepodařilo stáhnout." }, 502);
    const preview = new URL(request.url).searchParams.get("preview") === "1";
    await accessLog(r.context!, preview ? "document_preview" : "document_download", params.id, {document_id:params.documentId});
    return new Response(await file.data.arrayBuffer(), {
      headers: {
        "Content-Type": doc.file_type,
        "Content-Disposition": `${preview ? "inline" : "attachment"}; filename="priloha"; filename*=UTF-8''${encodeURIComponent(safeFileName(doc.file_name))}`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox; default-src 'none'; frame-ancestors 'self'",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return json({ error: "Příloha není dostupná." }, 500);
  }
}

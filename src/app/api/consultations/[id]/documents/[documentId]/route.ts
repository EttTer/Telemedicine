import { documentBucket, staffRecord, safeFileName } from "@/lib/clinical";
import { json } from "@/lib/workflow";
import { accessLog } from "@/lib/access-log";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params: pendingParams }: { params: Promise<{ id: string; documentId: string }> },
) {
  const params = await pendingParams;
  try {
    const r = await staffRecord(params.id);
    if (r.response) return r.response;
    const doc = r.data.documents.find((d: any) => d.id === params.documentId);
    if (!doc) return json({ error: "Příloha nenalezena." }, 404);
    const file = await r
      .admin!.storage.from(documentBucket)
      .download(doc.storage_path);
    if (file.error || !file.data)
      return json({ error: "Přílohu se nepodařilo stáhnout." }, 502);
    await accessLog(r.context!, "document_download", params.id, {document_id:params.documentId});
    return new Response(await file.data.arrayBuffer(), {
      headers: {
        "Content-Type": doc.file_type,
        "Content-Disposition": `attachment; filename="priloha"; filename*=UTF-8''${encodeURIComponent(safeFileName(doc.file_name))}`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return json({ error: "Příloha není dostupná." }, 500);
  }
}

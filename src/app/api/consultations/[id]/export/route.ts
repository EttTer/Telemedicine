import { documentBucket, staffRecord, safeFileName } from "@/lib/clinical";
import { recordText } from "@/lib/record-text";
import { zipFiles } from "@/lib/zip";
import { json } from "@/lib/workflow";
import { accessLog } from "@/lib/access-log";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(
  request: Request,
  { params: pendingParams }: { params: Promise<{ id: string }> },
) {
  const params = await pendingParams;
  try {
    const r = await staffRecord(params.id);
    if (r.response) return r.response;
    await accessLog(r.context!, "record_export_requested", params.id, {format:new URL(request.url).searchParams.get("format") || "zip", revision:r.data.revision});
    const text = recordText(r.data);
    if (new URL(request.url).searchParams.get("format") === "text")
      return new Response(text, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": 'attachment; filename="zaznam.txt"',
          "Cache-Control": "no-store",
        },
      });
    const files = [{ name: "zaznam.txt", data: Buffer.from("\uFEFF" + text) }];
    for (const [i, d] of r.data.documents.entries()) {
      const file = await r
        .admin!.storage.from(documentBucket)
        .download(d.storage_path);
      if (file.error || !file.data)
        return json(
          {
            error:
              "Některou přílohu nelze stáhnout. Balíček nebyl vytvořen; stáhněte dostupné přílohy jednotlivě.",
          },
          502,
        );
      files.push({
        name: `prilohy/${i + 1}_${safeFileName(d.file_name)}`,
        data: Buffer.from(await file.data.arrayBuffer()),
      });
    }
    const path = `${params.id}/konzultace.zip`;
    const uploaded = await r
      .admin!.storage.from("consultation-exports")
      .upload(path, zipFiles(files), {
        contentType: "application/zip",
        upsert: true,
      });
    if (uploaded.error)
      return json({ error: "Balíček se nepodařilo připravit." }, 502);
    const signed = await r
      .admin!.storage.from("consultation-exports")
      .createSignedUrl(path, 60, { download: "konzultace.zip" });
    if (signed.error)
      return json({ error: "Odkaz ke stažení nelze vytvořit." }, 502);
    return json({ url: signed.data.signedUrl });
  } catch {
    return json({ error: "Export se nepodařil." }, 500);
  }
}

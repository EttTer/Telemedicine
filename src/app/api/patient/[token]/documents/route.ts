import { randomUUID } from "node:crypto";
import {
  documentBucket,
  patientDocuments,
  safeFileName,
  validFile,
} from "@/lib/clinical";
import { json, rpcError, sameOrigin } from "@/lib/workflow";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params: pendingParams }: { params: Promise<{ token: string }> },
) {
  const params = await pendingParams;
  try {
    const c = await patientDocuments(params.token);
    if (!c) return json({ error: "Otevřete platnou pozvánku." }, 401);
    const r = await c.rpc("status");
    return r.error ? rpcError(r.error) : json(r.data);
  } catch {
    return json({ error: "Přílohy nelze načíst." }, 500);
  }
}
export async function POST(
  request: Request,
  { params: pendingParams }: { params: Promise<{ token: string }> },
) {
  const params = await pendingParams;
  if (!sameOrigin(request))
    return json({ error: "Nepovolený původ požadavku." }, 403);
  let path: string | undefined;
  const c = await patientDocuments(params.token);
  if (!c) return json({ error: "Otevřete platnou pozvánku." }, 401);
  try {
    // Netlify synchronous request body limit: keep multipart below 4 MB.
    if (Number(request.headers.get("content-length") || 0) > 4 * 1024 * 1024)
      return json({ error: "Příloha může mít nejvýše 3 MB." }, 413);
    const check = await c.rpc("check");
    if (check.error) return rpcError(check.error);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size < 1 || file.size > 3 * 1024 * 1024)
      return json({ error: "Vyberte soubor do 3 MB." }, 400);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!validFile(bytes, file.type))
      return json(
        {
          error:
            "Povoleny jsou pouze soubory PDF, JPG a PNG odpovídající zvolenému typu.",
        },
        400,
      );
    path = `${check.data.consultation_id}/${randomUUID()}`;
    const uploaded = await c.admin.storage
      .from(documentBucket)
      .upload(path, bytes, { contentType: file.type, upsert: false });
    if (uploaded.error) throw new Error("storage");
    const committed = await c.rpc("commit", {
      request_id: check.data.request_id,
      file_name: safeFileName(file.name),
      file_type: file.type,
      file_size: file.size,
      storage_path: path,
    });
    if (committed.error) {
      await c.admin.storage.from(documentBucket).remove([path]);
      path = undefined;
      return rpcError(committed.error);
    }
    return json(committed.data);
  } catch {
    if (path)
      await c.admin.storage
        .from(documentBucket)
        .remove([path])
        .catch(() => undefined);
    return json(
      { error: "Přílohu se nepodařilo uložit. Zkuste to znovu." },
      500,
    );
  }
}

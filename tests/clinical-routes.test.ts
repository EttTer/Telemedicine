import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  cookie: "b".repeat(64),
  rpc: vi.fn(),
  context: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  download: vi.fn(),
}));
const storage = {
  from: () => ({ upload: m.upload, remove: m.remove, download: m.download }),
};
vi.mock("next/headers", () => ({
  cookies: () => ({ get: () => (m.cookie ? { value: m.cookie } : undefined) }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    rpc: m.rpc,
    storage: { from: () => ({ upload: m.upload, remove: m.remove }) },
  }),
}));
vi.mock("@/lib/staff", () => ({ getStaffContext: m.context }));
import {
  GET as readRecord,
  POST as recordPost,
} from "@/app/api/consultations/[id]/record/route";
import { GET as download } from "@/app/api/consultations/[id]/documents/[documentId]/route";
import { POST as upload } from "@/app/api/patient/[token]/documents/route";
const id = "11111111-1111-4111-8111-111111111111",
  token = "a".repeat(64);
const req = (body: any, origin = "https://app.example") =>
  new Request("https://app.example/api/test", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const multipart = (bytes: string, type = "application/pdf", size?: number) => {
  const form = new FormData();
  form.append(
    "file",
    new File([size ? new Uint8Array(size) : bytes], "test.pdf", { type }),
  );
  return new Request("https://app.example/api/test", {
    method: "POST",
    headers: { origin: "https://app.example" },
    body: form,
  });
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("APP_ORIGIN", "https://app.example");
  m.cookie = "b".repeat(64);
  m.context.mockResolvedValue({
    staff: { id, practice_id: "A", role: "doctor" },
    admin: { rpc: m.rpc, storage },
  });
  m.upload.mockResolvedValue({ error: null });
  m.remove.mockResolvedValue({ error: null });
});
describe("clinical API authorization and uploads", () => {
  it("rejects unauthenticated staff and malformed IDs before RPC", async () => {
    m.context.mockResolvedValue({ staff: null, status: 401 });
    expect(
      (await readRecord(new Request("https://app.example"), { params: { id } }))
        .status,
    ).toBe(401);
    expect(
      (
        await readRecord(new Request("https://app.example"), {
          params: { id: "bad" },
        })
      ).status,
    ).toBe(400);
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it("delegates scope to verified staff identity and hides storage paths", async () => {
    m.rpc.mockResolvedValue({
      data: {
        documents: [
          { id: "d", file_name: "a.pdf", storage_path: "secret/path" },
        ],
      },
      error: null,
    });
    const r = await readRecord(new Request("https://app.example"), {
      params: { id },
    });
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(m.rpc.mock.calls[0][1].p_staff).toBe(id);
    expect(JSON.stringify(await r.json())).not.toContain("secret/path");
  });
  it("rejects foreign origin, injected fields, and conflicting saved versions", async () => {
    expect(
      (
        await recordPost(
          req(
            { action: "save", summary: "x", revision: 0 },
            "https://evil.example",
          ),
          { params: { id } },
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await recordPost(
          req({ action: "save", summary: "x", revision: 0, p_staff: "evil" }),
          { params: { id } },
        )
      ).status,
    ).toBe(400);
    m.rpc.mockResolvedValue({ error: { message: "record_conflict" } });
    expect(
      (
        await recordPost(req({ action: "save", summary: "x", revision: 0 }), {
          params: { id },
        })
      ).status,
    ).toBe(409);
  });
  it("does not download files belonging to another consultation", async () => {
    m.rpc.mockResolvedValue({
      data: { documents: [{ id: "own", storage_path: "own/path" }] },
      error: null,
    });
    expect(
      (
        await download(new Request("https://app.example"), {
          params: { id, documentId: "foreign" },
        })
      ).status,
    ).toBe(404);
    expect(m.download).not.toHaveBeenCalled();
  });
  it("requires patient session and active request before storage access", async () => {
    m.cookie = "";
    expect(
      (await upload(multipart("%PDF-1.4"), { params: { token } })).status,
    ).toBe(401);
    m.cookie = "b".repeat(64);
    m.rpc.mockResolvedValue({ error: { message: "upload_disabled" } });
    expect(
      (await upload(multipart("%PDF-1.4"), { params: { token } })).status,
    ).toBe(409);
    expect(m.upload).not.toHaveBeenCalled();
  });
  it("rejects oversized or disguised files", async () => {
    m.rpc.mockResolvedValue({
      data: { consultation_id: id, request_id: "request" },
      error: null,
    });
    expect(
      (await upload(multipart("<html>"), { params: { token } })).status,
    ).toBe(400);
    expect(
      (
        await upload(multipart("", "application/pdf", 3145729), {
          params: { token },
        })
      ).status,
    ).toBe(400);
    expect(m.upload).not.toHaveBeenCalled();
  });
  it("stores metadata only after successful storage upload", async () => {
    m.rpc.mockImplementation(async (_n, p) =>
      p.p_action === "check"
        ? { data: { consultation_id: id, request_id: "request" }, error: null }
        : { data: { id: "doc" }, error: null },
    );
    expect(
      (await upload(multipart("%PDF-1.4"), { params: { token } })).status,
    ).toBe(200);
    expect(m.rpc.mock.calls[1][1].p_data.storage_path).toMatch(
      new RegExp("^" + id + "/"),
    );
    expect(m.upload.mock.calls[0][2].upsert).toBe(false);
    expect(m.remove).not.toHaveBeenCalled();
  });
  it("removes stored object if request is revoked before transactional commit", async () => {
    m.rpc.mockImplementation(async (_n, p) =>
      p.p_action === "check"
        ? { data: { consultation_id: id, request_id: "request" }, error: null }
        : { error: { message: "upload_disabled" } },
    );
    expect(
      (await upload(multipart("%PDF-1.4"), { params: { token } })).status,
    ).toBe(409);
    expect(m.remove).toHaveBeenCalledWith([m.upload.mock.calls[0][0]]);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: () => ({ get: () => undefined }) }));
import { sameOrigin, consultationInput } from "@/lib/workflow";
import { localToUTC, dayRange } from "@/lib/schedule";
import { validFile, safeFileName } from "@/lib/clinical";
import { zipFiles } from "@/lib/zip";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
afterEach(() => vi.unstubAllEnvs());
describe("deployment and scheduled consultations", () => {
  it("accepts configured public origin behind Netlify internal URL and denies forgeries", () => {
    vi.stubEnv("APP_ORIGIN", "https://easytelemedicine.netlify.app");
    vi.stubEnv("NODE_ENV", "production");
    const r = (origin?: string) =>
      new Request("http://internal.netlify.local/api/patient", {
        method: "POST",
        headers: {
          ...(origin ? { origin } : {}),
          "x-forwarded-host": "evil.example",
        },
      });
    expect(sameOrigin(r("https://easytelemedicine.netlify.app"))).toBe(true);
    for (const o of [
      undefined,
      "null",
      "https://evil.example",
      "http://easytelemedicine.netlify.app",
      "https://easytelemedicine.netlify.app.evil.example",
      "https://easytelemedicine.netlify.app:8443",
    ])
      expect(sameOrigin(r(o))).toBe(false);
  });
  it("fails closed without production public configuration", () => {
    vi.stubEnv("APP_ORIGIN", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(
      sameOrigin(
        new Request("https://a.example", {
          headers: { origin: "https://a.example" },
        }),
      ),
    ).toBe(false);
  });
  it("converts Czech winter/summer time and rejects nonexistent calendar/time", () => {
    expect(localToUTC("2026-01-10T10:00")).toBe("2026-01-10T09:00:00.000Z");
    expect(localToUTC("2026-07-10T10:00")).toBe("2026-07-10T08:00:00.000Z");
    expect(() => localToUTC("2026-03-29T02:30")).toThrow();
    expect(() => localToUTC("2026-02-30T10:00")).toThrow();
  });
  it("uses 23/25-hour day boundaries over clock changes", () => {
    for (const [day, hours] of [
      ["2026-03-29", 23],
      ["2026-10-25", 25],
    ] as const) {
      const [a, b] = dayRange(day);
      expect((Date.parse(b) - Date.parse(a)) / 3600000).toBe(hours);
    }
  });
  it("requires a real, recent or future scheduled date", () => {
    const base = {
      consultation_type: "Test",
      identity_verification_method: "Test",
    };
    expect(consultationInput.safeParse(base).success).toBe(false);
    expect(
      consultationInput.safeParse({
        ...base,
        scheduled_for: "2000-01-01T00:00:00Z",
      }).success,
    ).toBe(false);
    expect(
      consultationInput.safeParse({
        ...base,
        scheduled_for: new Date(Date.now() + 86400000).toISOString(),
      }).success,
    ).toBe(true);
  });
  it("checks upload bytes and sanitizes paths", () => {
    expect(validFile(Buffer.from("%PDF-1.4"), "application/pdf")).toBe(true);
    expect(validFile(Buffer.from("<script>"), "application/pdf")).toBe(false);
    expect(validFile(Buffer.from("<svg>"), "image/svg+xml")).toBe(false);
    expect(safeFileName("../nález.pdf")).toBe(".._nález.pdf");
  });
  it("exports an independently readable ZIP with Czech names and identical attachment bytes", () => {
    const dir = mkdtempSync(join(tmpdir(), "tm-zip-"));
    try {
      const path = join(dir, "test.zip");
      writeFileSync(
        path,
        zipFiles([
          { name: "záznam.txt", data: Buffer.from("Český záznam") },
          { name: "prilohy/1_nález.pdf", data: Buffer.from("%PDF-1.4") },
        ]),
      );
      const result = execFileSync("python", [
        "-c",
        "import sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; assert z.read('záznam.txt').decode()=='Český záznam'; assert z.read('prilohy/1_nález.pdf')==b'%PDF-1.4'",
        path,
      ]);
      expect(result.length).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("publishing Netlify builds on the primary domain", () => {
  it("builds a precise allowlist for the main domain, preview and immutable deploy", () => {
    const output = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        "import config from './next.config.mjs'; process.stdout.write(JSON.stringify(config.env))",
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          APP_ORIGIN: "",
          URL: "https://easytelemedicine.netlify.app",
          DEPLOY_PRIME_URL:
            "https://deploy-preview-3--easytelemedicine.netlify.app",
          DEPLOY_URL: "https://build123--easytelemedicine.netlify.app",
        },
      },
    );
    const env = JSON.parse(output.toString());
    expect(env.APP_ORIGIN).toBe("https://easytelemedicine.netlify.app");
    vi.stubEnv("APP_ORIGIN", env.APP_ORIGIN);
    vi.stubEnv("APP_TRUSTED_ORIGINS", env.APP_TRUSTED_ORIGINS);
    vi.stubEnv("NODE_ENV", "production");
    const request = (origin: string) =>
      new Request("http://internal.netlify.local/api/consultations", {
        headers: { origin, "x-forwarded-host": "evil.example" },
      });
    for (const origin of [
      "https://easytelemedicine.netlify.app",
      "https://deploy-preview-3--easytelemedicine.netlify.app",
      "https://build123--easytelemedicine.netlify.app",
    ])
      expect(sameOrigin(request(origin))).toBe(true);
    for (const origin of [
      "https://evil.example",
      "https://deploy-preview-4--easytelemedicine.netlify.app",
      "https://easytelemedicine.netlify.app.evil.example",
      "null",
    ])
      expect(sameOrigin(request(origin))).toBe(false);
  });
  it("retains the known project domain even when APP_ORIGIN was set to a preview", () => {
    const output = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        "import config from './next.config.mjs'; process.stdout.write(config.env.APP_TRUSTED_ORIGINS)",
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          APP_ORIGIN: "https://deploy-preview-3--easytelemedicine.netlify.app",
          URL: "https://easytelemedicine.netlify.app",
        },
      },
    );
    vi.stubEnv(
      "APP_ORIGIN",
      "https://deploy-preview-3--easytelemedicine.netlify.app",
    );
    vi.stubEnv("APP_TRUSTED_ORIGINS", output.toString());
    expect(
      sameOrigin(
        new Request("http://internal.netlify.local/api/consultations", {
          headers: { origin: "https://easytelemedicine.netlify.app" },
        }),
      ),
    ).toBe(true);
  });
});

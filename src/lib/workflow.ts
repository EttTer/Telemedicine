import "server-only";
import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";

export const secretPattern = /^[a-f0-9]{64}$/;
export const hashSecret = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const newSecret = () => randomBytes(32).toString("hex");
export const patientCookieName = (token: string) =>
  `tm_patient_${hashSecret(token).slice(0, 24)}`;
export const getPatientSecret = (token: string) =>
  cookies().get(patientCookieName(token))?.value;
export const json = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });

// All browser mutations must originate from this deployment, including patient cookies.
export function sameOrigin(request: Request) {
  const trusted = [
    process.env.APP_ORIGIN,
    ...(process.env.APP_TRUSTED_ORIGINS || "").split(","),
  ].filter(Boolean);
  if (!trusted.length && process.env.NODE_ENV !== "production") {
    trusted.push(new URL(request.url).origin);
  }
  const origin = request.headers.get("origin");
  return !!origin && origin !== "null" && trusted.includes(origin);
}
export function rpcError(error: { code?: string; message?: string }) {
  if (error.code === "42501")
    return json(
      {
        error:
          "Přístup vypršel nebo není povolen. Otevřete platnou pozvánku, případně se znovu přihlaste.",
      },
      403,
    );
  const messages: Record<string, string> = {
    patient_not_waiting:
      "Pacient ještě nevstoupil do čekárny nebo není připojený.",
    room_busy: "Hovor se právě připravuje. Zkuste to za chvíli.",
    invalid_state: "Tuto akci v aktuálním stavu konzultace nelze provést.",
    record_conflict:
      "Záznam mezitím změnil jiný uživatel nebo jiné okno. Načtěte uložený záznam; rozepsaný text si nejprve zkopírujte.",
    upload_disabled: "Ordinace nyní nepovoluje nahrávání příloh.",
    upload_limit: "Limit je 10 příloh na konzultaci.",
    stale_claim: "Příprava hovoru vypršela. Zkuste ji spustit znovu.",
  };
  if (error.message && messages[error.message])
    return json({ error: messages[error.message] }, 409);
  return json({ error: "Operace se nezdařila. Zkuste ji znovu." }, 500);
}
export const consultationInput = z
  .object({
    scheduled_for: z
      .string()
      .datetime({ offset: true })
      .refine(
        (v) =>
          new Date(v).getTime() >= Date.now() - 60000 &&
          new Date(v).getTime() <= Date.now() + 366 * 86400000,
      ),
    consultation_type: z.string().trim().min(1).max(200),
    patient_first_name: z.string().trim().max(100).optional(),
    patient_last_name: z.string().trim().max(100).optional(),
    identity_verification_method: z.string().trim().min(1).max(200),
    note_to_patient: z.string().trim().max(2000).optional(),
  })
  .strict();
export const patientInput = z
  .object({
    first_name: z.string().trim().min(1).max(100),
    last_name: z.string().trim().min(1).max(100),
    date_of_birth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((value) => {
        const date = new Date(value);
        return (
          Number.isFinite(date.getTime()) &&
          date.toISOString().slice(0, 10) === value &&
          value >= "1900-01-01" &&
          date <= new Date()
        );
      }),
    contact_info: z.string().trim().min(3).max(250),
    reason_for_visit: z.string().trim().max(2000).optional(),
  })
  .strict();

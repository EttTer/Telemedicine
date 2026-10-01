import "server-only";
import { z } from "zod";
import { getStaffContext } from "@/lib/staff";
import {
  getPatientSecret,
  hashSecret,
  json,
  rpcError,
  secretPattern,
} from "@/lib/workflow";
import { createAdminClient } from "@/lib/supabase/server";
export const documentBucket = "consultation-documents";
export async function staffRecord(id: string, action = "read", data = {}) {
  if (!z.string().uuid().safeParse(id).success)
    return { response: json({ error: "Neplatné ID." }, 400) };
  const context = await getStaffContext();
  if (!context.staff)
    return {
      response: json({ error: "Přihlaste se do ordinace." }, context.status),
    };
  const result = await context.admin.rpc("tm_record_action", {
    p_staff: context.staff.id,
    p_id: id,
    p_action: action,
    p_data: data,
  });
  if (result.error) return { response: rpcError(result.error) };
  return { admin: context.admin, data: result.data };
}
export function patientDocuments(token: string) {
  const secret = getPatientSecret(token);
  if (!secretPattern.test(token) || !secret || !secretPattern.test(secret))
    return null;
  const admin = createAdminClient();
  const rpc = (action: string, data = {}) =>
    admin.rpc("tm_patient_documents", {
      p_token_hash: hashSecret(token),
      p_session_hash: hashSecret(secret),
      p_action: action,
      p_data: data,
    });
  return { admin, rpc };
}
export function validFile(bytes: Uint8Array, type: string) {
  if (type === "application/pdf")
    return Buffer.from(bytes.subarray(0, 5)).toString() === "%PDF-";
  if (type === "image/jpeg")
    return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (type === "image/png")
    return Buffer.from(bytes.subarray(0, 8)).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );
  return false;
}
export function safeFileName(name: string) {
  return name.replace(/[\\/\x00-\x1f\x7f]/g, "_").slice(0, 180) || "priloha";
}

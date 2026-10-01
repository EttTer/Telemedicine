import { formatPrague } from "@/lib/schedule";
export const identityConfirmation = "Totožnost pacienta byla ověřena.";
export function identityVerified(summary: string) {
  return summary.split("\n").some((line) => line.trim() === identityConfirmation);
}
export function withIdentityConfirmation(summary: string, verified: boolean) {
  const notes = summary.split("\n").filter((line) => line.trim() !== identityConfirmation).join("\n").trimEnd();
  return verified ? [notes, identityConfirmation].filter(Boolean).join("\n") : notes;
}
function callDuration(video: any) {
  const start = Date.parse(video?.started_at), end = Date.parse(video?.ended_at);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return "Nezaznamenáno";
  const seconds = Math.floor((end - start) / 1000);
  return `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}
export function recordText(record: any) {
  const c = record.consultation,
    p = record.patient,
    v = record.video;
  return `ZÁZNAM TELEMEDICÍNSKÉ KONZULTACE
Pacient: ${[c.patient_first_name, c.patient_last_name].filter(Boolean).join(" ") || "Neuveden"}
Datum narození: ${p?.date_of_birth || "Neuvedeno"}
Termín: ${formatPrague(c.scheduled_for)}
Typ: ${c.consultation_type}
Stav: ${{ completed: "Dokončeno", cancelled: "Zrušeno", in_progress: "Probíhá", waiting: "Čekárna", scheduled: "Plánováno" }[c.status as string] || c.status}
Začátek hovoru: ${v?.started_at ? formatPrague(v.started_at) : "Nezaznamenán"}
Konec hovoru: ${v?.ended_at ? formatPrague(v.ended_at) : "Nezaznamenán"}
Trvání hovoru: ${callDuration(v)}
Ověření totožnosti: ${identityVerified(record.summary || "") ? "Totožnost pacienta byla ověřena." : "Nepotvrzeno."}
Metoda ověření totožnosti: ${c.identity_verification_method || "Neuvedena"}
Důvod konzultace: ${p?.reason_for_visit || "Neuveden"}

LÉKAŘSKÝ ZÁZNAM
${withIdentityConfirmation(record.summary || "", false)}

PŘÍLOHY
${record.documents.map((d: any) => "- " + d.file_name).join("\n") || "Žádné"}
`;
}

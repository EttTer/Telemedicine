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
  const provider=record.provider || {}, author=record.author || {}, identity=record.identity, ack=record.acknowledgement;
  const verified = identity?.status === "verified";
  const identityState = verified ? "Totožnost pacienta byla ověřena." : identity ? "Ověření nebylo potvrzeno." : identityVerified(record.summary || "") ? "Starší textové potvrzení: Totožnost pacienta byla ověřena. Čas a autor nebyly evidovány." : "Nepotvrzeno.";
  return `ZÁZNAM TELEMEDICÍNSKÉ KONZULTACE
Pacient: ${[c.patient_first_name, c.patient_last_name].filter(Boolean).join(" ") || "Neuveden"}
Datum narození: ${p?.date_of_birth || "Neuvedeno"}
Termín: ${formatPrague(c.scheduled_for)}
Důvod konzultace: ${p?.reason_for_visit || "Neuveden"}

LÉKAŘSKÝ ZÁZNAM
${withIdentityConfirmation(record.summary || "", false)}

PŘÍLOHY
${record.documents.map((d: any) => "- " + (d.label ? `${d.label} (${d.file_name})` : d.file_name)).join("\n") || "Žádné"}

ÚDAJE O KONZULTACI A AUTORIZACI
Poskytovatel: ${provider.legal_name || provider.name || "Neuveden"}
IČO: ${provider.ico || "Neuvedeno"}
Adresa poskytovatele: ${provider.address || "Neuvedena"}
Autor zápisu: ${author.name || "Neuveden"}
Čas posledního uložení: ${record.updated_at ? formatPrague(record.updated_at) : "Nezaznamenán"}
Verze zápisu: ${record.revision ?? "Neuvedena"}
Stav podkladu: ${record.finalization ? "Dokončený podklad" : "Pracovní podklad"}
Dokončil/a: ${record.finalization?.by_name || "Dosud nedokončeno"}
Čas dokončení: ${record.finalization?.finalized_at ? formatPrague(record.finalization.finalized_at) : "Dosud nedokončeno"}
Důvod opravy: ${record.amendment_reason || "Není uveden"}
Typ: ${c.consultation_type}
Stav: ${{ completed: "Dokončeno", cancelled: "Zrušeno", in_progress: "Probíhá", waiting: "Čekárna", scheduled: "Plánováno" }[c.status as string] || c.status}
Začátek hovoru: ${v?.started_at ? formatPrague(v.started_at) : "Nezaznamenán"}
Konec hovoru: ${v?.ended_at ? formatPrague(v.ended_at) : "Nezaznamenán"}
Trvání hovoru: ${callDuration(v)} (interval zahájení–ukončení v aplikaci)
Ověření totožnosti: ${identityState}
Metoda ověření totožnosti: ${identity?.method || c.identity_verification_method || "Neuvedena"}
Ověření zaznamenal/a: ${identity?.verified_by_name || "Nezaznamenáno"}
Čas ověření: ${identity?.verified_at ? formatPrague(identity.verified_at) : "Nezaznamenán"}
Souhlas s konzultací na dálku: ${ack?.care_consent ? "Potvrzen při vstupu" : "V aplikaci není evidován"}
Poučení: ${ack?.version || "Neevidováno"} · ${ack?.acknowledged_at ? formatPrague(ack.acknowledged_at) : "Čas neevidován"}
Vyjádření k audio/videozáznamu: ${ack?.recording_preference === "declined" ? "Pacient nesouhlasí s pořizováním záznamu" : ack?.recording_preference === "not_requested" ? "Pacient záznam nepožaduje; konzultace bez něj" : "V aplikaci není evidováno"}
`;
}

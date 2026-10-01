import { formatPrague } from "@/lib/schedule";
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
Důvod konzultace: ${p?.reason_for_visit || "Neuveden"}

LÉKAŘSKÝ ZÁZNAM
${record.summary || ""}

PŘÍLOHY
${record.documents.map((d: any) => "- " + d.file_name).join("\n") || "Žádné"}
`;
}

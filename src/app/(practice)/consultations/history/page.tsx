import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/staff";
import { accessLog } from "@/lib/access-log";
import { createClient } from "@/lib/supabase/server";
import { DaySelector } from "@/components/DaySelector";
import { dayRange, formatPrague, validDay } from "@/lib/schedule";
export const revalidate = 0;
export default async function History({
  searchParams: pendingSearch,
}: {
  searchParams: Promise<{ day?: string; page?: string }>;
}) {
  const context=await getStaffContext();
  if (!context.staff) redirect(context.status===428?"/security":"/login");
  const searchParams = await pendingSearch;
  const day =
    searchParams.day && validDay(searchParams.day) ? searchParams.day : "";
  const page = Math.max(
    0,
    Math.min(10000, parseInt(searchParams.page || "0", 10) || 0),
  );
  const db = await createClient();
  let q = db
    .from("consultations")
    .select(
      "id,patient_first_name,patient_last_name,scheduled_for,consultation_type,status,consultation_summaries(updated_at,summary_text),uploaded_documents(id)",
      { count: "exact" },
    )
    .in("status", ["completed", "cancelled"]);
  if (day) {
    const [from, to] = dayRange(day);
    q = q.gte("scheduled_for", from).lt("scheduled_for", to);
  }
  const { data, error, count } = await q
    .order("scheduled_for", { ascending: false })
    .order("created_at", { ascending: false })
    .range(page * 20, page * 20 + 19);
  await accessLog(context,"consultation_history_read",undefined,{day,page,consultations:(data||[]).map(c=>c.id)});
  const url = (n: number) =>
    `/consultations/history?page=${n}${day ? "&day=" + day : ""}`;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Historie konzultací</h1>
      <DaySelector day={day} path="/consultations/history" allowAll />
      <p>
        Dokončené a zrušené konzultace, nejnovější nahoře. Záznam i přílohy
        otevřete v detailu.
      </p>
      {error && (
        <p role="alert" className="text-danger-700">
          Historii nelze načíst.
        </p>
      )}
      <div className="space-y-3">
        {data?.map((c) => {
          const s: any = Array.isArray(c.consultation_summaries)
            ? c.consultation_summaries[0]
            : c.consultation_summaries;
          return (
            <Link
              key={c.id}
              href={`/consultations/${c.id}`}
              className="block border rounded-lg p-4 bg-white hover:border-primary-400"
            >
              <div className="flex justify-between gap-3">
                <strong>
                  {[c.patient_first_name, c.patient_last_name]
                    .filter(Boolean)
                    .join(" ") || "Pacient bez jména"}
                </strong>
                <span>
                  {c.status === "completed" ? "Dokončeno" : "Zrušeno"}
                </span>
              </div>
              <p>
                {formatPrague(c.scheduled_for)} · {c.consultation_type}
              </p>
              <p className="text-sm text-neutral-500">
                {s?.summary_text ? "Záznam uložen" : "Záznam dosud nevyplněn"} ·{" "}
                {c.uploaded_documents?.length || 0} příloh
              </p>
            </Link>
          );
        })}
        {!data?.length && !error && <p>Žádné konzultace pro tento výběr.</p>}
      </div>
      <div className="flex gap-4">
        {page > 0 && (
          <Link className="underline" href={url(page - 1)}>
            Novější
          </Link>
        )}
        {(count || 0) > (page + 1) * 20 && (
          <Link className="underline" href={url(page + 1)}>
            Starší
          </Link>
        )}
      </div>
    </div>
  );
}

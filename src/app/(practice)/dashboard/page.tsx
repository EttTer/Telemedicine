import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/staff";
import { accessLog } from "@/lib/access-log";
import { createClient } from "@/lib/supabase/server";
import { RefreshDashboard } from "@/components/RefreshDashboard";
import { DaySelector } from "@/components/DaySelector";
import { CloseConsultation } from "@/components/CloseConsultation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { dayRange, formatPrague, pragueLocal, validDay } from "@/lib/schedule";
export const revalidate = 0;
export default async function Dashboard({
  searchParams: pendingSearch,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const context=await getStaffContext();
  if (!context.staff) redirect(context.status===428?"/security":"/login");
  const searchParams = await pendingSearch;
  const day =
    searchParams.day && validDay(searchParams.day)
      ? searchParams.day
      : pragueLocal().slice(0, 10);
  const [from, to] = dayRange(day),
    db = await createClient();
  const [planned, live] = await Promise.all([
    db
      .from("consultations")
      .select(
        "id,patient_first_name,patient_last_name,scheduled_for,consultation_type,status",
      )
      .eq("status", "scheduled")
      .gte("scheduled_for", from)
      .lt("scheduled_for", to)
      .order("scheduled_for"),
    db
      .from("consultations")
      .select(
        "id,patient_first_name,patient_last_name,scheduled_for,consultation_type,status,created_at,waiting_room_sessions(updated_at)",
      )
      .in("status", ["waiting", "in_progress"])
      .order("created_at", { ascending: false }),
  ]);
  await accessLog(context,"consultation_dashboard_read",undefined,{day,consultations:[...(planned.data||[]),...(live.data||[])].map(c=>c.id)});
  const waiting = live.data?.filter((c) => c.status === "waiting") || [],
    active = live.data?.filter((c) => c.status === "in_progress") || [];
  const name = (c: any) =>
    [c.patient_first_name, c.patient_last_name].filter(Boolean).join(" ") ||
    "Pacient dosud nevyplnil jméno";
  function row(c: any) {
    const w = Array.isArray(c.waiting_room_sessions)
      ? c.waiting_room_sessions[0]
      : c.waiting_room_sessions;
    return (
      <div
        key={c.id}
        className="flex flex-wrap justify-between items-center gap-3 p-3 border-b last:border-0"
      >
        <div>
          <p className="font-semibold">{name(c)}</p>
          <p className="text-sm text-neutral-500">
            {formatPrague(c.scheduled_for)} · {c.consultation_type}
          </p>
          {c.status === "waiting" && (
            <p className="text-sm">
              {Date.now() - new Date(w?.updated_at || 0).getTime() < 60000
                ? "Pacient je připojený"
                : "Pacient je bez spojení"}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <Link className="underline" href={`/consultations/${c.id}`}>
            Detail
          </Link>
          {c.status !== "scheduled" && (
            <Link className="underline" href={`/consultations/${c.id}/room`}>
              {c.status === "waiting" ? "Přijmout" : "Vrátit se do hovoru"}
            </Link>
          )}
          <CloseConsultation id={c.id} status={c.status} />
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <RefreshDashboard />
      <h1 className="text-2xl font-bold">Přehled konzultací</h1>
      <DaySelector day={day} />
      <p className="text-sm text-neutral-500">
        Časy jsou v českém časovém pásmu. Plán zobrazuje pouze vybraný den.
        Probíhající hovory a čekárna zůstávají viditelné i z jiných dnů.
      </p>
      {(planned.error || live.error) && (
        <p role="alert" className="text-danger-700">
          Konzultace se nepodařilo načíst.
        </p>
      )}
      {active.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Probíhající hovory ({active.length})</CardTitle>
          </CardHeader>
          <CardContent>{active.map(row)}</CardContent>
        </Card>
      )}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Čekárna ({waiting.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {waiting.length ? waiting.map(row) : <p>Nikdo nečeká.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              Plánované konzultace ({planned.data?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {planned.data?.length ? (
              planned.data.map(row)
            ) : (
              <p>Na tento den nejsou naplánované konzultace.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

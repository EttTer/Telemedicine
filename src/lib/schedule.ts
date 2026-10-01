export const practiceTimeZone = "Europe/Prague";
export const formatPrague = (value: string) =>
  new Date(value).toLocaleString("cs-CZ", {
    timeZone: practiceTimeZone,
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
export function pragueLocal(value: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: practiceTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const p = (name: string) => parts.find((x) => x.type === name)!.value;
  return `${p("year")}-${p("month")}-${p("day")}T${p("hour")}:${p("minute")}`;
}
export function localToUTC(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new Error("Zvolte datum a čas.");
  const nominal = Date.parse(value + "Z");
  if (!Number.isFinite(nominal)) throw new Error("Neplatný termín.");
  // Prague has UTC+1/+2; verify round-trip, rejecting the spring DST gap.
  const matches = [nominal - 7200000, nominal - 3600000].filter(
    (t) => pragueLocal(new Date(t)) === value,
  );
  if (!matches.length)
    throw new Error(
      "Tento čas v českém časovém pásmu neexistuje. Zvolte jiný čas.",
    );
  return new Date(matches[0]).toISOString();
}
export function validDay(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function dayRange(value: string) {
  if (!validDay(value)) throw new Error("Neplatné datum.");
  const next = new Date(Date.parse(value) + 86400000)
    .toISOString()
    .slice(0, 10);
  return [localToUTC(value + "T00:00"), localToUTC(next + "T00:00")];
}

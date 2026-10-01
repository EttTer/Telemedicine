"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { WherebyRoom } from "@/components/WherebyRoom";
import { PatientDocuments } from "@/components/PatientDocuments";
import { Button } from "@/components/ui/Button";

type State = {
  status: string;
  acknowledged?: boolean;
  note?: string;
  roomUrl?: string;
};
export function PatientWaitingRoom({ token }: { token: string }) {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [retry, setRetry] = useState(0);
  const [join, setJoin] = useState(false);
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    setBlocked(false);
    const poll = async () => {
      let stop = false;
      try {
        const response = await fetch(`/api/patient/${token}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "heartbeat" }),
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            stop = true;
            if (!disposed) {
              setState(null);
              setBlocked(true);
            }
          }
          throw new Error(data.error);
        }
        if (!disposed) {
          setState(data);
          setError("");
        }
        if (["completed", "cancelled"].includes(data.status)) stop = true;
      } catch (e) {
        if (!disposed)
          setError(
            e instanceof Error
              ? e.message
              : "Spojení se serverem se přerušilo.",
          );
      }
      if (!disposed && !stop) timer = setTimeout(poll, 5000);
    };
    poll();
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [token, retry]);
  const ended = state && ["completed", "cancelled"].includes(state.status);
  return (
    <div className="space-y-6 py-8">
      <h1 className="text-2xl font-bold">
        {ended
          ? "Konzultace byla ukončena"
          : state?.status === "in_progress"
            ? "Lékař vás zve do hovoru"
            : "Virtuální čekárna"}
      </h1>
      {error && (
        <div
          role="alert"
          className="rounded-lg bg-danger-50 p-4 text-danger-700"
        >
          <p>{error}</p>
          <Button variant="secondary" onClick={() => setRetry((x) => x + 1)}>
            Zkusit znovu
          </Button>
        </div>
      )}
      {blocked && (
        <Link href={`/consultation/${token}/checkin`} className="underline">
          Zpět na vstupní údaje
        </Link>
      )}
      {!state && !error && <p>Ověřuji stav konzultace…</p>}
      {state && !ended && !state.acknowledged && (
        <Link
          href={`/consultation/${token}/instructions`}
          className="underline"
        >
          Nejprve potvrďte poučení pacienta
        </Link>
      )}
      {state?.status === "waiting" && (
        <p>
          Jste v čekárně. Nechte tuto stránku otevřenou; jakmile lékař zahájí
          hovor, objeví se tlačítko pro připojení.
        </p>
      )}
      {state?.note && !ended && (
        <div className="bg-white p-4 border rounded-lg">
          <h2 className="font-semibold">Vzkaz ordinace</h2>
          <p className="whitespace-pre-wrap">{state.note}</p>
        </div>
      )}
      {ended && <p>Děkujeme. Tuto stránku můžete zavřít.</p>}
      {!ended &&
        state?.roomUrl &&
        (join ? (
          <WherebyRoom url={state.roomUrl} />
        ) : (
          <Button onClick={() => setJoin(true)}>Připojit se k lékaři</Button>
        ))}
      {state?.status === "in_progress" && !state.roomUrl && (
        <p>Místnost již není dostupná. Kontaktujte ordinaci.</p>
      )}
      {!ended && state?.acknowledged && <PatientDocuments token={token} />}
      {!ended && (
        <p className="text-sm text-neutral-500">
          Kamera a mikrofon se zapínají až při připojení k hovoru.
        </p>
      )}
    </div>
  );
}

"use client";
import { useParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { ClinicalRecord, RecordHandle } from "@/components/ClinicalRecord";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { WherebyRoom } from "@/components/WherebyRoom";

import { ConnectionNotice } from "@/components/ConnectionNotice";

export default function StaffRoom() {
  const params = useParams<{ id: string }>();
  const recordRef = useRef<RecordHandle>(null);
  const [retry, setRetry] = useState(0);
  const [room, setRoom] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(false);
  const [ended, setEnded] = useState(false);
  useEffect(() => {
    let disposed = false;
    setError("");
    fetch(`/api/consultations/${params.id}/video`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (!disposed && response.ok) {
          setRoom(data.hostRoomUrl || "");
          setEnded(data.status === "completed");
          setActive(data.status === "in_progress");
        }
      })
      .catch(() => {
        if (!disposed) setError("Stav hovoru se nepodařilo načíst.");
      });
    return () => {
      disposed = true;
    };
  }, [params.id, retry]);
  async function act(action: "start" | "end") {
    if (action === "end" && !(await recordRef.current?.flush())) {
      setError("Nejprve uložte rozepsané poznámky.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/consultations/${params.id}/video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (action === "start") {
        setRoom(data.hostRoomUrl);
        setActive(true);
      } else {
        setRoom("");
        setEnded(true);
        setActive(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operace se nezdařila.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5">
      <ConnectionNotice notes />
      <Link href={`/consultations/${params.id}`} className="underline">
        Zpět na detail konzultace
      </Link>
      <h1 className="text-2xl font-bold">
        {ended ? "Konzultace byla ukončena" : "Videohovor"}
      </h1>
      {error && (
        <p role="alert" className="text-danger-700">
          {error}
          <button className="block underline" onClick={() => setRetry(x => x + 1)}>Znovu načíst stav hovoru</button>
        </p>
      )}
      {!ended && !room && !active && (
        <>
          <p>
            Hovor lze zahájit, když pacient dokončí vstup a čeká s otevřenou
            čekárnou.
          </p>
          <Button isLoading={busy} onClick={() => act("start")}>
            Zahájit hovor a pozvat pacienta
          </Button>
        </>
      )}
      {active && !room && (
        <>
          <p>
            Místnost již není dostupná. Dokončete konzultaci tlačítkem níže.
          </p>
          <Button variant="danger" isLoading={busy} onClick={() => act("end")}>
            Ukončit konzultaci
          </Button>
        </>
      )}
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="space-y-4 min-w-0">
          {room && (
            <>
              <p className="text-sm">
                Pacient se připojuje jako host. V místnosti Whereby jej vpusťte
                a ověřte jeho totožnost před zdravotní konzultací.
              </p>
              <WherebyRoom url={room} />
              <Button
                variant="danger"
                isLoading={busy}
                onClick={() => act("end")}
              >
                Ukončit konzultaci pro všechny
              </Button>
              <p className="text-sm text-neutral-500">
                Pouhé zavření okna konzultaci neukončí. Použijte tlačítko výše.
              </p>
            </>
          )}
        </div>
        <ClinicalRecord id={params.id} ref={recordRef} />
      </div>
    </div>
  );
}

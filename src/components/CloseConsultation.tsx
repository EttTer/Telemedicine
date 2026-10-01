"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
export function CloseConsultation({
  id,
  status,
  beforeClose,
}: {
  id: string;
  status: string;
  beforeClose?: () => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState(false);
  const router = useRouter();
  if (!["scheduled", "waiting", "in_progress"].includes(status)) return null;
  const active = status === "in_progress";
  async function close() {
    setBusy(true);
    setError("");
    try {
      if (beforeClose && !(await beforeClose()))
        throw new Error("Nejprve uložte rozepsaný záznam.");
      const r = await fetch(
        `/api/consultations/${id}/${active ? "video" : "record"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: active ? "end" : "cancel" }),
        },
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setConfirm(false);
      router.refresh();
      router.push(`/consultations/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Konzultaci nelze uzavřít.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      {error && (
        <p role="alert" className="text-danger-700">
          {error}
        </p>
      )}
      {confirm ? (
        <div className="flex flex-wrap items-center gap-2">
          <span>
            {active ? "Ukončit hovor pro všechny?" : "Zrušit tuto konzultaci?"}
          </span>
          <Button variant="danger" size="sm" isLoading={busy} onClick={close}>
            Potvrdit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => setConfirm(false)}
          >
            Zpět
          </Button>
        </div>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setConfirm(true)}>
          {active ? "Ukončit hovor" : "Zrušit konzultaci"}
        </Button>
      )}
    </div>
  );
}

"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { formatPrague, localToUTC, pragueLocal } from "@/lib/schedule";
export function RescheduleConsultation({
  id,
  scheduled,
  onChange,
}: {
  id: string;
  scheduled: string;
  onChange: (v: string) => void;
}) {
  const [value, setValue] = useState(pragueLocal(new Date(scheduled))),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const scheduled_for = localToUTC(value);
      const r = await fetch(`/api/consultations/${id}/record`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reschedule", scheduled_for }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      onChange(scheduled_for);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Termín nelze změnit.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} className="space-y-2">
      <p>Termín: {formatPrague(scheduled)}</p>
      <label className="block">
        Změnit datum a čas (český čas)
        <input
          type="datetime-local"
          required
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="block rounded border p-2"
        />
      </label>
      <Button size="sm" variant="secondary" type="submit" isLoading={busy}>
        Uložit termín
      </Button>
      {error && (
        <p role="alert" className="text-danger-700">
          {error}
        </p>
      )}
      <p className="text-sm">
        Při změně termínu informujte pacienta. Již prošlou pozvánku obnovte
        tlačítkem níže.
      </p>
    </form>
  );
}

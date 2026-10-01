"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
export function PatientDocuments({ token }: { token: string }) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const r = await fetch(`/api/patient/${token}/documents`, {
          cache: "no-store",
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        if (!stopped) setData(d);
      } catch (e) {
        if (!stopped)
          setError(e instanceof Error ? e.message : "Přílohy nelze načíst.");
      }
      if (!stopped) timer = setTimeout(poll, 5000);
    }
    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [token]);
  async function upload(e: React.FormEvent) {
    e.preventDefault();
    const file = input.current?.files?.[0];
    if (!file) return;
    setError("");
    setMessage("");
    if (file.size > 3 * 1024 * 1024) {
      setError("Soubor může mít nejvýše 3 MB.");
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const r = await fetch(`/api/patient/${token}/documents`, {
        method: "POST",
        body,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setData((v: any) => ({
        ...v,
        documents: [
          ...v.documents,
          { id: d.id, file_name: file.name, file_size: file.size },
        ],
      }));
      if (input.current) input.current.value = "";
      setMessage("Příloha je uložená a dostupná ordinaci.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Soubor se nepodařilo nahrát.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="bg-white border rounded-lg p-4 space-y-3">
      <h2 className="font-semibold">Dokumenty pro ordinaci</h2>
      {error && (
        <p role="alert" className="text-danger-700">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {data?.enabled ? (
        <form onSubmit={upload} className="space-y-3">
          <p>
            Ordinace žádá o dokumenty. Nahrajte PDF, JPG nebo PNG do 3 MB
            (nejvýše 10 příloh).
          </p>
          <input
            ref={input}
            aria-label="Příloha pro ordinaci"
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            required
            disabled={busy || data.documents.length >= 10}
          />
          <Button
            type="submit"
            isLoading={busy}
            disabled={data.documents.length >= 10}
          >
            Nahrát dokument
          </Button>
        </form>
      ) : (
        <p>
          Jakmile ordinace požádá o dokumenty, objeví se zde možnost nahrání.
        </p>
      )}
      {!!data?.documents.length && (
        <>
          <h3 className="font-medium">Nahrané dokumenty</h3>
          <ul>
            {data.documents.map((d: any) => (
              <li key={d.id}>
                {d.file_name} · {Math.ceil(d.file_size / 1024)} kB
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

"use client";
import { useEffect, useState } from "react";
export function ConnectionNotice({ notes = false }: { notes?: boolean }) {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(typeof navigator !== "undefined" && navigator.onLine === false);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  if (!offline) return null;
  return <div role="alert" className="rounded-lg bg-warning-50 border border-warning-200 p-4 text-sm">
    <p className="font-semibold">Připojení k internetu se přerušilo.</p>
    <p>Nechte stránku otevřenou a zkontrolujte připojení. Po obnovení internetu se aktualizace obnoví.</p>
    {notes && <p>Rozepsané poznámky zůstávají v tomto okně. Dokud není uvedeno „Uloženo“, stránku neobnovujte ani nezavírejte.</p>}
  </div>;
}

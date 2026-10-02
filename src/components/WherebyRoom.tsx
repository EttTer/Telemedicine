"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
export function WherebyRoom({ url }: { url: string }) {
  const [attempt, setAttempt] = useState(0);
  let room: URL;
  try { room = new URL(url); } catch { return <p role="alert">Neplatná adresa hovoru.</p>; }
  if (room.protocol !== "https:" || !room.hostname.endsWith(".whereby.com")) return <p role="alert">Neplatná adresa hovoru.</p>;
  room.searchParams.set("minimal", ""); room.searchParams.set("lang", "cs");
  room.searchParams.set("leaveButton", "on"); room.searchParams.set("chat", "off");
  return <div className="space-y-3 min-w-0">
    <iframe key={attempt} title="Videohovor Whereby" src={room.toString()} className="w-full rounded-xl border bg-neutral-900 h-[70vh] min-h-[300px] sm:min-h-[420px]" allow="camera; microphone; fullscreen; display-capture; autoplay" referrerPolicy="no-referrer" allowFullScreen />
    <details className="text-sm"><summary>Pomoc s kamerou, mikrofonem a připojením</summary><p className="mt-2">Povolte kameru a mikrofon v nastavení oprávnění této stránky v prohlížeči. Zkontrolujte výběr zařízení ve videohovoru a zavřete jiné aplikace, které je používají. Při výpadku počkejte na obnovení internetu a zkuste znovu připojit hovor.</p><p className="mt-2">Obnovení připojení znovu načte pouze videohovor; poznámky zůstanou otevřené. Může být potřeba znovu vstoupit do místnosti.</p></details>
    <Button variant="secondary" size="sm" onClick={() => setAttempt(x => x + 1)}>Znovu připojit videohovor</Button>
  </div>;
}

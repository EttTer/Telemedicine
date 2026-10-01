"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
export function MfaSetup() {
  const router = useRouter(), [client] = useState(() => createClient());
  const [factor, setFactor] = useState(""), [qr, setQr] = useState(""), [secret, setSecret] = useState(""), [code, setCode] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false), [ready, setReady] = useState(false), [verified, setVerified] = useState(false);
  useEffect(() => { let live = true; (async () => {
    const [aal, factors] = await Promise.all([client.auth.mfa.getAuthenticatorAssuranceLevel(), client.auth.mfa.listFactors()]);
    if (!live) return;
    if (aal.error || factors.error) { setError("Zabezpečení účtu nelze načíst. Zkuste obnovit stránku."); return; }
    setVerified(aal.data.currentLevel === "aal2");
    setFactor(factors.data.totp.find(f => f.status === "verified")?.id || ""); setReady(true);
  })().catch(() => { if (live) setError("Zabezpečení účtu nelze načíst."); }); return () => { live = false; }; }, [client]);
  async function enroll() {
    setBusy(true); setError("");
    try {
      const existing = await client.auth.mfa.listFactors(); if (existing.error) throw existing.error;
      for (const f of existing.data.all.filter(f => f.factor_type === "totp" && f.status === "unverified")) { const r = await client.auth.mfa.unenroll({ factorId: f.id }); if (r.error) throw r.error; }
      const r = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: "Telemedicínská ordinace", issuer: "EasyTelemedicine" });
      if (r.error) throw r.error;
      setFactor(r.data.id); setQr(r.data.totp.qr_code); setSecret(r.data.totp.secret);
    } catch { setError("Druhý faktor se nepodařilo připravit. Ověřte dostupnost TOTP v nastavení Supabase Auth."); } finally { setBusy(false); }
  }
  async function complete() {
    const audit=await fetch("/api/auth/event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"mfa_login"})});
    if(!audit.ok) throw new Error("audit");
    router.replace("/dashboard");router.refresh();
  }
  async function continueToPractice() {setBusy(true);setError("");try{await complete()}catch{setError("Ověření je platné, ale evidenci přihlášení se nepodařilo uložit. Zkuste pokračovat znovu.")}finally{setBusy(false)}}
  async function verify(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const r = await client.auth.mfa.challengeAndVerify({ factorId: factor, code }); if (r.error) throw r.error;
      setQr(""); setSecret(""); setCode("");
      setVerified(true);
      await complete();
    } catch { setError("Ověření se nezdařilo. Zkontrolujte aktuální šestimístný kód a čas telefonu; pokud přetrvává chyba, zkuste znovu."); } finally { setBusy(false); }
  }
  return <main className="max-w-xl mx-auto p-6 space-y-5"><h1 className="text-2xl font-bold">Zabezpečení účtu ordinace</h1><p>Přístup k pacientským údajům vyžaduje heslo a druhý faktor. Použijte ověřovací aplikaci v telefonu, například Microsoft Authenticator, Google Authenticator nebo jinou podporující TOTP.</p>{error && <p role="alert" className="text-danger-700">{error}</p>}
    {!ready && !error && <p>Načítám…</p>}
    {ready && verified ? <><p>Druhý faktor je pro toto přihlášení ověřen.</p><Button isLoading={busy} onClick={continueToPractice}>Pokračovat do ordinace</Button></> : ready && <>
      {!factor && <Button isLoading={busy} onClick={enroll}>Nastavit ověřovací aplikaci</Button>}
      {qr && <div className="space-y-3"><p>Naskenujte QR kód ověřovací aplikací a ověřte první kód. QR ani tajný klíč nikomu neposílejte.</p>{/* Auth enrollment response, never logged or persisted by this app. */}<Image unoptimized width={224} height={224} src={qr} alt="QR kód pro nastavení druhého faktoru" className="w-56 h-56" /><details><summary>Ruční zadání místo QR</summary><code className="break-all">{secret}</code></details></div>}
      {factor && <form onSubmit={verify} className="space-y-3"><label className="block">Šestimístný kód z ověřovací aplikace<input autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} className="block border rounded p-2 mt-2" /></label><Button type="submit" isLoading={busy}>Ověřit a pokračovat</Button></form>}
    </>}
    <p className="text-sm text-neutral-600">Při ztrátě ověřovací aplikace kontaktujte správce provozu. Obnova musí proběhnout po ověření totožnosti; tato stránka neumožňuje druhý faktor obejít. Správce účtu může v Supabase provést obnovu přístupu.</p>
    <form action="/auth/signout" method="post"><Button type="submit" variant="ghost">Odhlásit se</Button></form>
  </main>;
}

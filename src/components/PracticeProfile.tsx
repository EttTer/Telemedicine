"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
export const profileLabels: Record<string, string> = {
  legal_name: "Právní název poskytovatele / správce údajů", ico: "IČO", address: "Sídlo a místo poskytování zdravotních služeb",
  privacy_contact: "Kontakt pro dotazy a uplatnění práv (pověřenec, je-li ustanoven)",
  practitioner_identity_method: "Domluvený způsob ověření totožnosti lékaře pacientem",
  legal_basis_notice: "Účely a právní důvody zpracování, rozsah údajů, povinné údaje a důsledky jejich neposkytnutí",
  vendor_notice: "Příjemci, zpracovatelé, jejich role, předávání do zahraničí a použité záruky",
  retention_notice: "Doby uchování poznámek, dokumentace, příloh, exportů a evidence přístupů",
};
export function PracticeProfile() {
  const [profile, setProfile] = useState<Record<string,string>>({}), [edit, setEdit] = useState(false), [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  useEffect(() => { fetch("/api/practice-profile", { cache: "no-store" }).then(async r => { const d=await r.json(); if (!r.ok) throw new Error(d.error); setProfile(d.profile || {}); setEdit(d.can_edit); setReady(true); }).catch(() => setMessage("Profil nelze načíst.")); }, []);
  async function save(e: React.FormEvent) { e.preventDefault(); setBusy(true); setMessage(""); try { const r=await fetch("/api/practice-profile", { method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(Object.fromEntries(Object.keys(profileLabels).map(k=>[k,profile[k]||""]))) }); const d=await r.json(); if (!r.ok) throw new Error(d.error); setProfile(d.profile); setMessage("Uloženo. Údaje jsou dostupné pacientům u pozvánky."); } catch(e) { setMessage(e instanceof Error?e.message:"Uložení se nezdařilo."); } finally { setBusy(false); } }
  return <div className="max-w-3xl space-y-5"><h1 className="text-2xl font-bold">Profil a informace ordinace</h1><p>Vyplňte pouze ověřené údaje. Texty o zpracování osobních údajů musí odpovídat skutečným smlouvám a provozu; tento formulář právní soulad nepotvrzuje. Prázdné položky se pacientovi zobrazí jako nedoplněné.</p><p>Dokončení podkladu zápisu vyžaduje název poskytovatele, IČO a adresu. Další údaje potřebné pro zdravotnickou dokumentaci doplňuje ordinace ve svém dokumentačním systému.</p>{message && <p role="status">{message}</p>}{ready && <form onSubmit={save} className="space-y-4">{Object.entries(profileLabels).map(([key,label])=><label key={key} className="block font-medium">{label}<textarea rows={key.endsWith("notice")?4:2} maxLength={key==="ico"?8:key.endsWith("notice")?3000:key==="legal_name"?300:key==="address"?500:key==="privacy_contact"?500:200} value={profile[key]||""} disabled={!edit||busy} onChange={e=>setProfile(p=>({...p,[key]:e.target.value}))} className="block mt-2 w-full border rounded p-3 font-normal" /></label>)}{edit?<Button type="submit" isLoading={busy}>Uložit profil</Button>:<p>Profil může měnit správce; pokud v ordinaci není přiřazen správce, může jej doplnit lékař.</p>}</form>}</div>;
}

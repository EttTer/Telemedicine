"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { formatPrague } from "@/lib/schedule";

export function DocumentPanel({ id, documents, editable, onLabel }: {
  id: string; documents: any[]; editable: boolean; onLabel: (documentId: string, label: string) => void;
}) {
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<string[]>([]);
  const [preview, setPreview] = useState<any>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (seen.current === null) { seen.current = new Set(documents.map(d => d.id)); return; }
    const newIds = documents.filter(d => !seen.current!.has(d.id)).map(d => d.id);
    if (newIds.length) {
      setFresh(current => [...new Set([...current, ...newIds])]);
      newIds.forEach(key => seen.current!.add(key));
    }
  }, [documents]);
  useEffect(() => {
    if (!preview) return;
    closeRef.current?.focus();
    let disposed = false;
    const controller = new AbortController();
    let objectUrl = "";
    (async () => {
      try {
        const r = await fetch(`/api/consultations/${id}/documents/${preview.id}?preview=1`, { cache: "no-store", signal: controller.signal });
        if (!r.ok) throw new Error((await r.json()).error || "Náhled nelze načíst.");
        const blob = await r.blob();
        if (!disposed) { objectUrl = URL.createObjectURL(blob); setPreviewUrl(objectUrl); }
      } catch (e) { if (!disposed) setError(e instanceof Error ? e.message : "Náhled není dostupný."); }
    })();
    return () => { disposed = true; controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [preview, id]);
  function close() { setPreview(null); setPreviewUrl(""); returnFocus.current?.focus(); }
  function markRead(documentId: string) { setFresh(current => current.filter(key => key !== documentId)); }
  async function saveLabel(documentId: string) {
    setBusy(true); setError("");
    try {
      const r = await fetch(`/api/consultations/${id}/record`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "label_document", document_id: documentId, label: label.trim() }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error);
      onLabel(documentId, d.label); setEditing(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Popis se nepodařilo uložit."); }
    finally { setBusy(false); }
  }
  return <section className="space-y-3">
    <h3 className="font-semibold">Přílohy pacienta ({documents.length}/10)</h3>
    {error && <p role="alert" className="text-danger-700">{error}</p>}
    {!!fresh.length && <p role="status" className="text-primary-700 font-medium">Nově nahrané přílohy: {fresh.length}</p>}
    {!documents.length && <p className="text-sm">Zatím nejsou nahrané žádné přílohy.</p>}
    <ul className="space-y-3">{documents.map(d => <li key={d.id} className="rounded-lg border p-3 space-y-2 min-w-0">
      <div className="flex flex-wrap items-center gap-2"><span className="font-medium break-all">{d.label || d.file_name}</span>
        {fresh.includes(d.id) && <span className="text-xs rounded bg-primary-50 text-primary-700 px-2 py-1">Nově nahráno</span>}</div>
      {d.label && <p className="text-sm text-neutral-500 break-all">Soubor: {d.file_name}</p>}
      <p className="text-sm text-neutral-500">{d.file_type === "application/pdf" ? "PDF" : d.file_type === "image/png" ? "PNG" : "JPG"} · {Math.ceil(d.file_size / 1024)} kB
        {d.uploaded_at && ` · ${formatPrague(d.uploaded_at)}`}{d.context && ` · ${d.context === "waiting_room" ? "z čekárny" : "během hovoru"}`}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={e => { returnFocus.current = e.currentTarget; setError(""); setPreviewUrl(""); setPreview(d); markRead(d.id); }}>Náhled</Button>
        <a className="underline text-primary-700 text-sm" href={`/api/consultations/${id}/documents/${d.id}`} download onClick={() => markRead(d.id)}>Stáhnout</a>
        {editable && <Button variant="ghost" size="sm" disabled={busy} onClick={() => { setEditing(d.id); setLabel(d.label || ""); }}>Upravit popis</Button>}
      </div>
      {editing === d.id && editable && <form className="space-y-2" onSubmit={e => { e.preventDefault(); void saveLabel(d.id); }}>
        <label className="block text-sm">Popis dokumentu (volitelné)<input className="block w-full border rounded p-2" value={label} maxLength={200} disabled={busy} onChange={e => setLabel(e.target.value)} placeholder="Např. Laboratorní výsledky ze září" /></label>
        <div className="flex gap-2"><Button type="submit" size="sm" isLoading={busy}>Uložit popis</Button><Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setEditing(null)}>Zrušit</Button></div>
      </form>}
    </li>)}</ul>
    {preview && <div className="fixed inset-0 z-50 bg-neutral-900/60 p-3 sm:p-6 flex items-center justify-center" onClick={e => { if (e.target === e.currentTarget) close(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="document-preview-title" className="bg-white rounded-xl p-4 w-full max-w-4xl max-h-[90dvh] overflow-y-auto space-y-3" onKeyDown={e => { if (e.key === "Escape") close(); if (e.key === "Tab" && e.target === closeRef.current) { e.preventDefault(); closeRef.current?.focus(); } }}>
        <div className="flex items-start justify-between gap-3"><h3 id="document-preview-title" className="font-semibold break-all">{preview.label || preview.file_name}</h3><Button ref={closeRef} variant="secondary" size="sm" onClick={close}>Zavřít</Button></div>
        {!previewUrl && !error && <p role="status">Načítám náhled…</p>}
        {error && <p role="alert" className="text-danger-700">{error}</p>}
        {previewUrl && (preview.file_type === "application/pdf"
          ? <iframe title={`Náhled ${preview.file_name}`} src={previewUrl} sandbox="" className="w-full h-[65dvh] rounded border" />
          : <Image unoptimized src={previewUrl} width={1200} height={1600} alt={preview.label || preview.file_name} className="w-full h-auto max-h-[70dvh] object-contain" />)}
        <p className="text-sm">Pokud prohlížeč náhled PDF nezobrazí, zavřete jej a stáhněte dokument.</p>
      </section>
    </div>}
  </section>;
}

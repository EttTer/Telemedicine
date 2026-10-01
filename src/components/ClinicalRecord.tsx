"use client";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { formatPrague } from "@/lib/schedule";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { recordText, identityVerified } from "@/lib/record-text";
const AUTOSAVE_PAUSE_MS = 5000;
export type RecordHandle = { flush: () => Promise<boolean> };
export const ClinicalRecord = forwardRef<RecordHandle, { id: string }>(
  function ClinicalRecord({ id }, ref) {
    const [record, setRecord] = useState<any>(null),
      [text, setText] = useState(""),
      [status, setStatus] = useState("Načítám…"),
      [error, setError] = useState(""),
      [busy, setBusy] = useState(false),
      [method, setMethod] = useState(""), [reason,setReason]=useState(""), [historical,setHistorical]=useState<any>(null);
    const draft = useRef(""),
      saved = useRef(""),
      lastEdit = useRef(0),
      revision = useRef(0),
      initialized = useRef(false),
      mounted = useRef(true),
      conflict = useRef(false),
      saving = useRef<Promise<boolean> | null>(null),
      timer = useRef<ReturnType<typeof setTimeout>>();
    const flush = useCallback(async (drain = true): Promise<boolean> => {
      if (drain) clearTimeout(timer.current);
      if (!initialized.current || conflict.current) return false;
      const remainingPause = AUTOSAVE_PAUSE_MS - (Date.now() - lastEdit.current);
      if (!drain && remainingPause > 0) {
        clearTimeout(timer.current);
        timer.current = setTimeout(() => void flush(false), remainingPause);
        return true;
      }
      if (saving.current) {
        const ok = await saving.current;
        return ok ? flush(drain) : false;
      }
      if (draft.current === saved.current) return true;
      const value = draft.current,
        version = revision.current;
      if (mounted.current) {
        setStatus("Ukládám…");
        setError("");
      }
      const work = (async () => {
        try {
          const r = await fetch(`/api/consultations/${id}/record`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "save",
              summary: value,
              revision: version,
            }),
          });
          const d = await r.json();
          if (!r.ok) {
            if (r.status === 409) conflict.current = true;
            throw new Error(d.error);
          }
          saved.current = value;
          revision.current = d.revision;
          if (mounted.current)
            setStatus(draft.current === value ? "Uloženo" : "Čeká na uložení");
          return true;
        } catch (e) {
          if (mounted.current) {
            setStatus("Neuloženo");
            setError(e instanceof Error ? e.message : "Záznam není uložen.");
          }
          return false;
        }
      })();
      saving.current = work;
      const ok = await work;
      saving.current = null;
      if (ok && draft.current !== saved.current) {
        if (drain) return flush();
        clearTimeout(timer.current);
        timer.current = setTimeout(() => void flush(false),
          Math.max(0, AUTOSAVE_PAUSE_MS - (Date.now() - lastEdit.current)));
      }
      return ok;
    }, [id]);
    useImperativeHandle(ref, () => ({ flush }), [flush]);
    function updateDraft(value: string) {
      draft.current = value;
      lastEdit.current = Date.now();
      setText(value);
      setStatus("Čeká na uložení");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(false), AUTOSAVE_PAUSE_MS);
    }
    useEffect(() => {
      mounted.current = true;
      let disposed = false;
      let poll: ReturnType<typeof setTimeout>;
      async function load() {
        try {
          const r = await fetch(`/api/consultations/${id}/record`, {
            cache: "no-store",
          });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error);
          if (!disposed) {
            setRecord(d);
            if (!initialized.current) setMethod(d.identity?.method || d.consultation.identity_verification_method || "");
            if (
              !initialized.current ||
              (draft.current === saved.current &&
                !saving.current &&
                d.revision !== revision.current)
            ) {
              draft.current = d.summary || "";
              saved.current = draft.current;
              revision.current = d.revision;
              setText(draft.current);
              initialized.current = true;
              setStatus("Uloženo");
              setError("");
            }
          }
        } catch (e) {
          if (!disposed && !initialized.current)
            setError(e instanceof Error ? e.message : "Záznam nelze načíst.");
        }
        if (!disposed) poll = setTimeout(load, 5000);
      }
      load();
      const warn = (e: BeforeUnloadEvent) => {
        if (draft.current !== saved.current) {
          e.preventDefault();
          e.returnValue = "";
        }
      };
      const navigate = async (e: MouseEvent) => {
        const a = (e.target as Element)?.closest?.("a");
        if (
          !a ||
          a.target === "_blank" ||
          a.hasAttribute("download") ||
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey ||
          e.button !== 0 ||
          draft.current === saved.current
        )
          return;
        const u = new URL(a.href, window.location.href);
        if (u.origin !== window.location.origin) return;
        e.preventDefault();
        e.stopPropagation();
        if (await flush()) window.location.assign(u.href);
      };
      window.addEventListener("beforeunload", warn);
      document.addEventListener("click", navigate, true);
      return () => {
        disposed = true;
        mounted.current = false;
        clearTimeout(poll);
        clearTimeout(timer.current);
        window.removeEventListener("beforeunload", warn);
        document.removeEventListener("click", navigate, true);
      };
    }, [id, flush]);
    async function action(action: string, data: Record<string,unknown> = {}) {
      setBusy(true);
      setError("");
      try {
        if (!(await flush())) return;
        const r = await fetch(`/api/consultations/${id}/record`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...data,
            ...(["finalize","reopen"].includes(action) ? {revision:revision.current} : {}) }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        if (["request","revoke"].includes(action)) setRecord((p:any)=>({...p,upload_enabled:action==="request"}));
        else { await reload(); setReason(""); }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Akce se nezdařila.");
      } finally {
        setBusy(false);
      }
    }
    async function reload() {
      setBusy(true);
      try {
        const r = await fetch(`/api/consultations/${id}/record`, {
          cache: "no-store",
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        saved.current = d.summary || "";
        draft.current = saved.current;
        revision.current = d.revision;
        conflict.current = false;
        setText(saved.current);
        setRecord(d);
        setError("");
        setStatus("Uloženo");
      } catch {
        setError("Uložený záznam nelze načíst.");
      } finally {
        setBusy(false);
      }
    }
    async function copy() {
      setBusy(true);
      try {
        if (!(await flush())) return;
        const r = await fetch(`/api/consultations/${id}/record?purpose=copy`, {
          cache: "no-store",
        });
        if (!r.ok) throw new Error("load");
        const d = await r.json();
        await navigator.clipboard.writeText(recordText(d));
        setStatus("Uloženo · záznam zkopírován");
      } catch {
        setError("Kopírování není dostupné. Stáhněte textový záznam.");
      } finally {
        setBusy(false);
      }
    }
    async function download(format: string) {
      if (!(await flush())) return;
      setBusy(true);
      setError("");
      try {
        const r = await fetch(
          `/api/consultations/${id}/export?format=${format}`,
          { cache: "no-store" },
        );
        if (!r.ok) throw new Error((await r.json()).error);
        if (format === "zip") {
          const d = await r.json();
          window.location.assign(d.url);
          return;
        }
        const url = URL.createObjectURL(await r.blob());
        const a = document.createElement("a");
        a.href = url;
        a.download = format === "text" ? "zaznam.txt" : "konzultace.zip";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Export se nezdařil.");
      } finally {
        setBusy(false);
      }
    }
    return (
      <Card>
        <CardHeader>
          <CardTitle>Záznam a přílohy konzultace</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p role="alert" className="text-danger-700 whitespace-pre-wrap">
              {error}
            </p>
          )}
          {record && (
            <>
              <label className="block">Metoda skutečně provedeného ověření totožnosti
                <input type="text" value={method} maxLength={200} disabled={!record.can_edit || busy} onChange={e=>setMethod(e.target.value)} className="block border rounded p-2 w-full" placeholder="Např. předem domluvené údaje a kontrolní otázka" />
              </label>
              <label className="flex items-start gap-2">
                <input type="checkbox" checked={record.identity?.status === "verified"} disabled={!record.can_edit || busy || method.trim().length<5 || !["in_progress","completed"].includes(record.consultation.status)} onChange={e=>void action("verify_identity",{verified:e.target.checked,method:method.trim()})}/>
                <span>Totožnost pacienta byla ověřena uvedenou metodou</span>
              </label>
              {record.identity?.verified_at && <p className="text-sm">Zaznamenal/a {record.identity.verified_by_name} · {formatPrague(record.identity.verified_at)} · {record.identity.method}</p>}
              {!record.identity && identityVerified(text) && <p className="text-sm">Starší zápis obsahuje textové potvrzení. Čas a autor ověření v něm nejsou evidovány.</p>}
              <p className="text-sm text-neutral-500">Potvrďte skutečné ověření během nebo po hovoru. Vstupní údaje ani přístupový odkaz samy totožnost neprokazují.</p>
              <label className="block font-medium" htmlFor={`notes-${id}`}>
                Poznámky a souhrn pro dokumentaci
              </label>
              <textarea
                id={`notes-${id}`}
                rows={10}
                maxLength={50000}
                value={text}
                disabled={!record.can_edit || busy}
                onChange={(e) => updateDraft(e.target.value)}
                className="w-full border rounded-lg p-3"
                placeholder="Anamnéza, nález, závěr, doporučení…"
              />
              <p aria-live="polite" className="text-sm">
                {status}
              </p>
              {record.can_edit && <p className="text-sm text-neutral-500">Automatické uložení proběhne 5 sekund po přerušení psaní. Uložit můžete i tlačítkem níže.</p>}
              {record.can_edit && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() => void flush()}
                >
                  Uložit nyní
                </Button>
              )}
              {conflict.current && (
                <div className="bg-warning-50 rounded p-3 space-y-2">
                  <p>
                    Rozepsaný text zůstal v poli. Před načtením uložené verze si
                    jej zkopírujte.
                  </p>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(draft.current);
                        setStatus("Rozepsaný text zkopírován");
                      } catch {
                        setError("Označte text v poli a zkopírujte jej ručně.");
                      }
                    }}
                  >
                    Kopírovat rozepsaný text
                  </Button>
                  <Button variant="ghost" disabled={busy} onClick={reload}>
                    Načíst uloženou verzi
                  </Button>
                </div>
              )}
              {record.finalization ? <div className="bg-primary-50 p-3 rounded space-y-2">
                <p>Dokončený podklad · verze {record.finalization.revision} · {formatPrague(record.finalization.finalized_at)} · {record.finalization.by_name}</p>
                {record.edit_role && <><label className="block">Důvod opravy<input type="text" className="block w-full border rounded p-2" value={reason} maxLength={1000} onChange={e=>setReason(e.target.value)} /></label><Button disabled={busy||reason.trim().length<3} variant="secondary" onClick={()=>void action("reopen",{reason:reason.trim()})}>Otevřít opravu</Button></>}
              </div> : record.consultation.status === "completed" && record.can_edit && <Button disabled={busy} onClick={()=>void action("finalize")}>Dokončit podklad pro dokumentaci</Button>}
              {record.amendment_reason && <p>Důvod aktuální opravy: {record.amendment_reason}</p>}
              <p className="text-sm text-neutral-500">Dokončení zachová neměnnou verzi. Další oprava bude mít vlastní verzi a důvod. Podklad je potřeba přenést a autorizovat ve vašem systému zdravotnické dokumentace.</p>
              {!!record.versions?.length && <details><summary>Historie zápisu (posledních 20 verzí)</summary><ul className="space-y-2">{record.versions.map((v:any)=><li key={v.revision}><button type="button" className="underline" disabled={busy} onClick={async()=>{try{const r=await fetch(`/api/consultations/${id}/record?revision=${v.revision}`,{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error);setHistorical(d)}catch(e){setError(e instanceof Error?e.message:"Verzi nelze načíst.")}}}>Verze {v.revision} · {formatPrague(v.saved_at)} · {v.author || "Autor neuveden"}</button>{v.source==="baseline"&&<span> · výchozí dochovaný stav</span>}{v.amendment_reason&&<p>Oprava: {v.amendment_reason}</p>}</li>)}</ul></details>}
              {historical&&<section className="border rounded p-3"><h3 className="font-semibold">Dochovaná verze {historical.revision}</h3><pre className="whitespace-pre-wrap font-sans">{historical.summary}</pre><Button variant="ghost" onClick={()=>setHistorical(null)}>Zavřít náhled verze</Button></section>}
              <h3 className="font-semibold">
                Přílohy pacienta ({record.documents.length}/10)
              </h3>
              <ul className="space-y-2">
                {record.documents.map((d: any) => (
                  <li key={d.id}>
                    <a
                      href={`/api/consultations/${id}/documents/${d.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="underline text-primary-700"
                    >
                      {d.file_name}
                    </a>{" "}
                    <span className="text-sm text-neutral-500">
                      ({Math.ceil(d.file_size / 1024)} kB)
                    </span>
                  </li>
                ))}
              </ul>
              {!record.documents.length && (
                <p className="text-sm">Zatím nejsou nahrané žádné přílohy.</p>
              )}
              {["scheduled", "waiting", "in_progress"].includes(
                record.consultation.status,
              ) && (
                <div className="space-y-2">
                  <p>
                    {record.upload_enabled
                      ? "Pacient může nahrávat dokumenty v čekárně i během hovoru."
                      : "Nahrávání dokumentů pacientem je vypnuté."}
                  </p>
                  <Button
                    variant="secondary"
                    isLoading={busy}
                    onClick={() =>
                      action(record.upload_enabled ? "revoke" : "request")
                    }
                  >
                    {record.upload_enabled
                      ? "Ukončit žádost o dokumenty"
                      : "Požádat pacienta o dokumenty"}
                  </Button>
                  <p className="text-sm text-neutral-500">
                    PDF, JPG nebo PNG, nejvýše 3 MB na soubor. Již nahrané
                    přílohy zůstávají v záznamu.
                  </p>
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-3 border-t">
                <Button disabled={busy} onClick={copy}>
                  Kopírovat záznam
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => download("text")}
                >
                  Stáhnout text
                </Button>
                <Button
                  variant="secondary"
                  isLoading={busy}
                  onClick={() => download("zip")}
                >
                  Stáhnout záznam s přílohami (ZIP)
                </Button>
              </div>
              <p className="text-sm text-neutral-500">
                Text vložte do své zdravotnické dokumentace a přílohy importujte
                z balíčku. Přímé propojení s vaším dokumentačním systémem zatím
                není nastavené.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    );
  },
);

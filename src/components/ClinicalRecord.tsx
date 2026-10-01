"use client";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { recordText } from "@/lib/record-text";
export type RecordHandle = { flush: () => Promise<boolean> };
export const ClinicalRecord = forwardRef<RecordHandle, { id: string }>(
  function ClinicalRecord({ id }, ref) {
    const [record, setRecord] = useState<any>(null),
      [text, setText] = useState(""),
      [status, setStatus] = useState("Načítám…"),
      [error, setError] = useState(""),
      [busy, setBusy] = useState(false);
    const draft = useRef(""),
      saved = useRef(""),
      revision = useRef(0),
      initialized = useRef(false),
      mounted = useRef(true),
      conflict = useRef(false),
      saving = useRef<Promise<boolean> | null>(null),
      timer = useRef<ReturnType<typeof setTimeout>>();
    const flush = useCallback(async (): Promise<boolean> => {
      clearTimeout(timer.current);
      if (!initialized.current || conflict.current) return false;
      if (saving.current) {
        const ok = await saving.current;
        return ok ? flush() : false;
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
      if (ok && draft.current !== saved.current) return flush();
      return ok;
    }, [id]);
    useImperativeHandle(ref, () => ({ flush }), [flush]);
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
    async function action(action: string) {
      setBusy(true);
      setError("");
      try {
        const r = await fetch(`/api/consultations/${id}/record`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setRecord((p: any) => ({ ...p, upload_enabled: action === "request" }));
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
        const r = await fetch(`/api/consultations/${id}/record`, {
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
              <label className="block font-medium" htmlFor={`notes-${id}`}>
                Poznámky a souhrn pro dokumentaci
              </label>
              <textarea
                id={`notes-${id}`}
                rows={10}
                maxLength={50000}
                value={text}
                disabled={!record.can_edit || busy}
                onChange={(e) => {
                  draft.current = e.target.value;
                  setText(e.target.value);
                  setStatus("Čeká na uložení");
                  clearTimeout(timer.current);
                  timer.current = setTimeout(() => void flush(), 800);
                }}
                className="w-full border rounded-lg p-3"
                placeholder="Anamnéza, nález, závěr, doporučení…"
              />
              <p aria-live="polite" className="text-sm">
                {status}
              </p>
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

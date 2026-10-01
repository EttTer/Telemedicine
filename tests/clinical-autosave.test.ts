import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClinicalRecord, type RecordHandle } from "@/components/ClinicalRecord";
const id = "11111111-1111-4111-8111-111111111111";
let renderer: ReactTestRenderer, ref: React.RefObject<RecordHandle>;
let remote: any = {
  consultation: { status: "in_progress" },
  can_edit: true,
  summary: "Saved before call",
  revision: 1,
  documents: [],
  upload_enabled: false,
};
const fetchMock = vi.fn();
const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const saves = () =>
  fetchMock.mock.calls
    .filter(([, opts]) => opts?.method === "POST")
    .map(([, opts]) => JSON.parse(opts.body));
async function mount() {
  ref = React.createRef<RecordHandle>();
  await act(async () => {
    renderer = create(React.createElement(ClinicalRecord, { id, ref }));
  });
}
async function type(value: string) {
  await act(async () => {
    renderer.root.findByType("textarea").props.onChange({ target: { value } });
  });
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("React", React);
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal(
    "window",
    Object.assign(new EventTarget(), {
      location: {
        href: "https://app.example/room",
        origin: "https://app.example",
        assign: vi.fn(),
      },
    }),
  );
  vi.stubGlobal("document", new EventTarget());
  remote = { ...remote, summary: "Saved before call", revision: 1, identity:null, consultation:{status:"in_progress",identity_verification_method:"Domluvená kontrolní otázka"} };
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (_url, opts) => {
    if (opts?.method === "POST") {
      const p = JSON.parse(opts.body);
      if (p.action === "verify_identity") remote = {...remote,identity:{status:p.verified?"verified":"rejected",method:p.method}};
      else remote = { ...remote, summary: p.summary, revision: remote.revision + 1 };
      return response({ revision: remote.revision });
    }
    return response(remote);
  });
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("critical notes during consultation", () => {
  it("stores structured identity evidence without changing clinical notes", async () => {
    await mount();
    expect(renderer.root.findByProps({type:"checkbox"}).props.checked).toBe(false);
    await act(async () => {
      renderer.root.findByProps({type:"checkbox"}).props.onChange({ target: { checked: true } });
      await vi.advanceTimersByTimeAsync(800);
    });
    expect(remote.summary).toBe("Saved before call");
    expect(remote.identity).toEqual({status:"verified",method:"Domluvená kontrolní otázka"});
    expect(saves()[0]).toEqual({action:"verify_identity",verified:true,method:"Domluvená kontrolní otázka"});
    expect(renderer.root.findByProps({type:"checkbox"}).props.checked).toBe(true);
    await act(async () => {
      renderer.root.findByProps({type:"checkbox"}).props.onChange({ target: { checked: false } });
      await ref.current!.flush();
    });
    expect(remote.summary).toBe("Saved before call");
  });
  it("loads saved notes and debounces typing into one persisted update", async () => {
    await mount();
    expect(renderer.root.findByType("textarea").props.value).toBe(
      "Saved before call",
    );
    await type("A");
    await type("Clinical note");
    expect(saves()).toHaveLength(0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    expect(saves()).toEqual([
      { action: "save", summary: "Clinical note", revision: 1 },
    ]);
    expect(JSON.stringify(renderer.toJSON())).toContain("Uloženo");
  });
  it("flushes the last keystrokes before ending or navigating away", async () => {
    await mount();
    await type("Final sentence");
    let ok = false;
    await act(async () => {
      ok = await ref.current!.flush();
    });
    expect(ok).toBe(true);
    expect(remote.summary).toBe("Final sentence");
    expect(saves()).toHaveLength(1);
  });
  it("keeps unsaved text and blocks completion after network failure, then permits retry", async () => {
    await mount();
    await type("Must not lose");
    fetchMock.mockRejectedValueOnce(new Error("Network failed"));
    let ok = true;
    await act(async () => {
      ok = await ref.current!.flush();
    });
    expect(ok).toBe(false);
    expect(renderer.root.findByType("textarea").props.value).toBe(
      "Must not lose",
    );
    expect(JSON.stringify(renderer.toJSON())).toContain("Neuloženo");
    await act(async () => {
      ok = await ref.current!.flush();
    });
    expect(ok).toBe(true);
    expect(remote.summary).toBe("Must not lose");
  });
  it("preserves draft and prevents blind overwrite on revision conflict", async () => {
    await mount();
    await type("Local draft");
    fetchMock.mockResolvedValueOnce(
      response({ error: "Záznam mezitím změnil jiný uživatel." }, 409),
    );
    await act(async () => {
      expect(await ref.current!.flush()).toBe(false);
    });
    expect(renderer.root.findByType("textarea").props.value).toBe(
      "Local draft",
    );
    const n = saves().length;
    await act(async () => {
      expect(await ref.current!.flush()).toBe(false);
    });
    expect(saves()).toHaveLength(n);
    expect(JSON.stringify(renderer.toJSON())).toContain(
      "Načíst uloženou verzi",
    );
  });
  it("serializes further edits made while an earlier save is in flight", async () => {
    await mount();
    await type("First");
    let resolve!: (r: Response) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((r) => {
          resolve = r;
        }),
    );
    let result!: Promise<boolean>;
    await act(async () => {
      result = ref.current!.flush();
    });
    await type("First and second");
    await act(async () => {
      remote = { ...remote, summary: "First", revision: 2 };
      resolve(response({ revision: 2 }));
      await result;
    });
    expect(saves()).toEqual([
      { action: "save", summary: "First", revision: 1 },
      { action: "save", summary: "First and second", revision: 2 },
    ]);
    expect(remote.summary).toBe("First and second");
  });
  it("updates a clean record from another window without replacing an active draft", async () => {
    await mount();
    remote = { ...remote, summary: "Remote update", revision: 2 };
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(renderer.root.findByType("textarea").props.value).toBe(
      "Remote update",
    );
    await type("Local pending");
    remote = { ...remote, summary: "Another remote update", revision: 3 };
    fetchMock.mockResolvedValueOnce(response({ error: "Conflict" }, 409));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(renderer.root.findByType("textarea").props.value).toBe(
      "Local pending",
    );
  });
});

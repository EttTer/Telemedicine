import { describe, expect, it } from "vitest";
import { identityConfirmation, identityVerified, recordText, withIdentityConfirmation } from "../src/lib/record-text";

const record = {
  consultation: { scheduled_for: "2026-10-01T08:00:00Z", status: "completed", consultation_type: "video", identity_verification_method: "Ověření lékařem v hovoru" },
  summary: "Doporučení: kontrola.", documents: [],
  video: { started_at: "2026-10-01T08:00:00Z", ended_at: "2026-10-01T08:12:34Z" },
};
describe("clinical record identity and duration", () => {
  it("puts clinical content first and retains labeled filenames and administrative evidence", () => {
    const output = recordText({...record, documents:[{file_name:"lab.pdf",label:"Laboratoř"}], provider:{legal_name:"Test practice"}, patient:{reason_for_visit:"Kontrola"}});
    expect(output.indexOf("Důvod konzultace: Kontrola")).toBeLessThan(output.indexOf("LÉKAŘSKÝ ZÁZNAM"));
    expect(output.indexOf(record.summary)).toBeLessThan(output.indexOf("Poskytovatel:"));
    expect(output).toContain("Laboratoř (lab.pdf)");
    expect(output).toContain("Poskytovatel: Test practice");
  });
  it("does not infer verification from the chosen method or a completed call", () => {
    expect(recordText(record)).toContain("Ověření totožnosti: Nepotvrzeno.");
    expect(recordText(record)).toContain("Trvání hovoru: 12 min 34 s");
  });
  it("exports the doctor's confirmation once and preserves clinical notes", () => {
    const summary = withIdentityConfirmation(record.summary, true);
    expect(identityVerified(summary)).toBe(true);
    const output = recordText({ ...record, summary });
    expect(output.split(identityConfirmation)).toHaveLength(2);
    expect(output).toContain(record.summary);
    expect(withIdentityConfirmation(summary, false)).toBe(record.summary);
  });
  it("does not invent a duration for unfinished or inconsistent calls", () => {
    expect(recordText({ ...record, video: { started_at: record.video.started_at } })).toContain("Trvání hovoru: Nezaznamenáno");
    expect(recordText({ ...record, video: { ...record.video, ended_at: "2026-09-30T08:00:00Z" } })).toContain("Trvání hovoru: Nezaznamenáno");
  });
});

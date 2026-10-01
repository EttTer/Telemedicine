// Disposable PostgreSQL tests only: no network, no live patient records.
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import assert from "node:assert/strict";
const db = new PGlite();
let checks = 0;
const check = (a, b) => {
  assert.deepEqual(a, b);
  checks++;
};
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const hash = (c) => c.repeat(64);
const data = {
  first_name: "Test",
  last_name: "Patient",
  date_of_birth: "2000-01-01",
  contact_info: "test@example.invalid",
  reason_for_visit: "Synthetic only",
};
const staff = async (id, c, action, p = {}) =>
  (
    await db.query("select public.tm_staff_action($1,$2,$3,$4) as result", [
      uid(id),
      c,
      action,
      p,
    ])
  ).rows[0].result;
const patient = async (t, s, action, p = {}) =>
  (
    await db.query("select public.tm_patient_action($1,$2,$3,$4) as result", [
      hash(t),
      hash(s),
      action,
      p,
    ])
  ).rows[0].result;
const fail = async (fn, match) => {
  await assert.rejects(
    fn,
    match ? (e) => e.message.includes(match) : undefined,
  );
  checks++;
};
try {
  await db.exec(
    await readFile(
      new URL("./restoration_fixture.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec(
    "create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);",
  );
  const migrations = await readdir(new URL("../migrations/", import.meta.url));
  for (const suffix of [
    "restore_practice_read_access.sql",
    "consultation_workflow.sql",
    "clinical_workspace.sql",
  ]) {
    const file = migrations.find((f) => f.endsWith(suffix));
    assert.ok(file);
    await db.exec(
      await readFile(new URL(`../migrations/${file}`, import.meta.url), "utf8"),
    );
  }
  await db.exec(`insert into auth.users values ('${uid(1)}'),('${uid(2)}'),('${uid(3)}');
 insert into practices(id,name) values ('${uid(11)}','A'),('${uid(12)}','B');
 insert into staff(id,practice_id,role,first_name,last_name) values ('${uid(1)}','${uid(11)}','doctor','A','A'),('${uid(2)}','${uid(12)}','doctor','B','B'),('${uid(3)}','${uid(11)}','nurse','C','C');`);
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set role ${role}`);
    await fail(() => staff(1, null, "create"), "permission denied");
    await fail(() => patient("a", "b", "checkin", data), "permission denied");
    for (const table of ["patient_sessions", "video_room_claims"]) {
      await fail(
        () => db.query(`select * from public.${table}`),
        "permission denied",
      );
      await fail(
        () => db.query(`delete from public.${table}`),
        "permission denied",
      );
    }
    await db.exec("reset role");
  }
  await db.exec("set role service_role");
  const created = await staff(1, null, "create", {
    consultation_type: "Test",
    identity_verification_method: "In call",
    token_hash: hash("a"),
  });
  const c = created.id;
  check(typeof c, "string");
  await fail(
    () => staff(2, c, "invite", { token_hash: hash("c") }),
    "not_found",
  );
  await fail(
    () => staff(1, c, "claim", { claim_id: uid(101) }),
    "patient_not_waiting",
  );
  await fail(
    () => patient("a", "b", "join", { acknowledged: true }),
    "invalid_session",
  );
  await fail(() => patient("a", "b", "status"), "invalid_session");
  await patient("a", "b", "checkin", data);
  check(
    (
      await db.query(
        "select is_used from consultation_tokens where consultation_id=$1",
        [c],
      )
    ).rows[0].is_used,
    true,
  );
  await fail(() => patient("a", "c", "checkin", data), "invalid_invitation");
  await patient("a", "b", "checkin", { ...data, first_name: "Updated" });
  check(
    (
      await db.query(
        "select count(*)::int as n from patients where consultation_id=$1",
        [c],
      )
    ).rows[0].n,
    1,
  );
  check((await patient("a", "b", "status")).acknowledged, false);
  await fail(
    () => patient("a", "b", "join", { acknowledged: false }),
    "invalid_state",
  );
  await patient("a", "b", "join", { acknowledged: true });
  await patient("a", "b", "join", { acknowledged: true });
  check(
    (
      await db.query(
        "select count(*)::int as n from audit_logs where action='instructions_acknowledged'",
      )
    ).rows[0].n,
    1,
  );
  check((await patient("a", "b", "heartbeat")).status, "waiting");
  await fail(() => staff(3, c, "claim", { claim_id: uid(101) }), "forbidden");
  await db.query(
    "update waiting_room_sessions set updated_at=now()-interval '2 minutes' where consultation_id=$1",
    [c],
  );
  await fail(
    () => staff(1, c, "claim", { claim_id: uid(101) }),
    "patient_not_waiting",
  );
  await patient("a", "b", "heartbeat");
  check((await staff(1, c, "claim", { claim_id: uid(101) })).claimed, true);
  await fail(() => staff(1, c, "claim", { claim_id: uid(102) }), "room_busy");
  // Reissuing during an external room request invalidates both the session and claim.
  await staff(1, c, "invite", { token_hash: hash("c") });
  await fail(() => patient("a", "b", "status"), "invalid_session");
  await fail(() => patient("a", "b", "checkin", data), "invalid_invitation");
  await fail(() => staff(1, c, "start", { claim_id: uid(101) }), "stale_claim");
  await patient("c", "d", "checkin", data);
  await patient("c", "d", "join", { acknowledged: true });
  await staff(1, c, "claim", { claim_id: uid(103) });
  await fail(() => staff(1, c, "start", { claim_id: uid(102) }), "stale_claim");
  await staff(1, c, "start", {
    claim_id: uid(103),
    meetingId: "meeting-test",
    roomUrl: "https://test.whereby.com/guest",
    hostRoomUrl: "https://test.whereby.com/host?key=secret",
    expiry: new Date(Date.now() + 3600000).toISOString(),
  });
  const status = await patient("c", "d", "status");
  check(status.status, "in_progress");
  check(status.roomUrl, "https://test.whereby.com/guest");
  check(JSON.stringify(status).includes("host"), false);
  check(JSON.stringify(status).includes("secret"), false);
  check(
    (await staff(1, c, "claim", { claim_id: uid(104) })).hostRoomUrl,
    "https://test.whereby.com/host?key=secret",
  );
  await fail(() => staff(2, c, "room"), "not_found");
  await fail(() => staff(3, c, "room"), "forbidden");
  await fail(
    () => staff(1, c, "invite", { token_hash: hash("e") }),
    "invalid_state",
  );
  await fail(() => patient("c", "d", "checkin", data), "invalid_invitation");
  await staff(1, c, "end");
  check((await patient("c", "d", "status")).status, "completed");
  check((await patient("c", "d", "status")).roomUrl, undefined);
  check((await staff(1, c, "room")).hostRoomUrl, null);
  await staff(1, c, "end");
  await fail(
    () => staff(1, c, "claim", { claim_id: uid(105) }),
    "patient_not_waiting",
  );
  // Failure in token insertion must roll back the new consultation and audit.
  const before = (
    await db.query("select count(*)::int as n from consultations")
  ).rows[0].n;
  await fail(
    () =>
      staff(1, null, "create", {
        consultation_type: "Test",
        identity_verification_method: "Test",
        token_hash: hash("a"),
      }),
    "duplicate",
  );
  check(
    (await db.query("select count(*)::int as n from consultations")).rows[0].n,
    before,
  );
  const exp = await staff(1, null, "create", {
    consultation_type: "Expiry",
    identity_verification_method: "Test",
    token_hash: hash("e"),
  });
  await db.query(
    "update consultation_tokens set expires_at=now()-interval '1 second' where consultation_id=$1",
    [exp.id],
  );
  await fail(() => patient("e", "f", "checkin", data), "invalid_invitation");
  await db.query(
    "update patient_sessions set expires_at=now()-interval '1 second' where consultation_id=$1",
    [c],
  );
  await fail(() => patient("c", "d", "status"), "invalid_session");
  console.log(`Workflow PostgreSQL: ${checks} assertions passed`);
} finally {
  await db.close();
}
